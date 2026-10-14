// server.ts
import express from "express";
import next from "next";
import { parse } from "url";
import dotenv from "dotenv";

// src/core/server/bot-runner.ts
var ServerBotManager = class {
  config = null;
  isRunning = false;
  currentStake = 1;
  totalProfit = 0;
  winCount = 0;
  lossCount = 0;
  trades = [];
  stoppedReason = null;
  lastUpdate = Date.now();
  balance = void 0;
  ws = null;
  ticks = [];
  isTradeInFlight = false;
  tradeTimer = null;
  reqIdCounter = 100;
  pendingRequests = /* @__PURE__ */ new Map();
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      currentStake: this.currentStake,
      totalProfit: +this.totalProfit.toFixed(2),
      winCount: this.winCount,
      lossCount: this.lossCount,
      trades: this.trades,
      stoppedReason: this.stoppedReason,
      lastUpdate: this.lastUpdate,
      balance: this.balance
    };
  }
  async start(config) {
    this.stop("restarted");
    this.config = config;
    this.isRunning = true;
    this.currentStake = config.stake;
    this.totalProfit = 0;
    this.winCount = 0;
    this.lossCount = 0;
    this.trades = [];
    this.stoppedReason = null;
    this.lastUpdate = Date.now();
    this.ticks = [];
    this.isTradeInFlight = false;
    console.log(`[ServerBot] Started persistent bot for account ${config.accountId} on ${config.symbol} (Stake: $${config.stake})`);
    this.initWebSocket();
    return this.getStatus();
  }
  stop(reason = "user_action") {
    if (!this.isRunning) return this.getStatus();
    console.log(`[ServerBot] Stopped persistent bot. Reason: ${reason}`);
    this.isRunning = false;
    this.stoppedReason = reason;
    this.lastUpdate = Date.now();
    if (this.tradeTimer) {
      clearInterval(this.tradeTimer);
      this.tradeTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
      }
      this.ws = null;
    }
    return this.getStatus();
  }
  initWebSocket() {
    if (!this.isRunning || !this.config) return;
    try {
      const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=33E1sj7WNaMsjg5MAxPyS&l=en&brand=deriv`;
      const WS = globalThis.WebSocket || (typeof WebSocket !== "undefined" ? WebSocket : null);
      if (!WS) throw new Error("WebSocket not available in environment");
      this.ws = new WS(wsUrl);
      this.ws.onopen = async () => {
        console.log("[ServerBot] Connected to Deriv WS. Authorizing...");
        try {
          const authRes = await this.sendWS({ authorize: this.config.token });
          if (authRes?.authorize?.balance) {
            this.balance = authRes.authorize.balance;
          }
          this.sendWS({ ticks: this.config.symbol, subscribe: 1 }).catch(() => {
          });
          this.sendWS({ balance: 1, subscribe: 1 }).catch(() => {
          });
          this.startTradingLoop();
        } catch (err) {
          console.error("[ServerBot] Auth failed:", err.message);
          this.stop(`Auth error: ${err.message}`);
        }
      };
      this.ws.onmessage = (event) => {
        try {
          const raw = event.data !== void 0 ? event.data : event;
          const data = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(raw.toString());
          this.handleWSMessage(data);
        } catch (e) {
        }
      };
      this.ws.onclose = () => {
        if (this.isRunning) {
          console.log("[ServerBot] WS closed unexpectedly. Reconnecting in 3s...");
          setTimeout(() => {
            if (this.isRunning) this.initWebSocket();
          }, 3e3);
        }
      };
      this.ws.onerror = (err) => {
        console.error("[ServerBot] WS error:", err?.message || err);
      };
    } catch (e) {
      console.error("[ServerBot] Failed to create WS:", e.message);
    }
  }
  handleWSMessage(data) {
    if (data.req_id && this.pendingRequests.has(data.req_id)) {
      const { resolve, reject } = this.pendingRequests.get(data.req_id);
      this.pendingRequests.delete(data.req_id);
      if (data.error) {
        reject(new Error(data.error.message || "Deriv error"));
      } else {
        resolve(data);
      }
    }
    if (data.tick?.quote) {
      this.ticks.push(data.tick.quote);
      if (this.ticks.length > 30) this.ticks.shift();
    }
    if (data.balance?.balance) {
      this.balance = data.balance.balance;
    }
    if (data.proposal_open_contract) {
      const poc = data.proposal_open_contract;
      if (poc.is_sold === 1) {
        this.handleContractSettled(poc);
      }
    }
  }
  sendWS(payload) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        return reject(new Error("WebSocket not connected"));
      }
      const req_id = this.reqIdCounter++;
      this.pendingRequests.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...payload, req_id }));
    });
  }
  startTradingLoop() {
    if (this.tradeTimer) clearInterval(this.tradeTimer);
    this.executeNextTrade();
    this.tradeTimer = setInterval(() => {
      if (this.isRunning && !this.isTradeInFlight) {
        this.executeNextTrade();
      }
    }, 4500);
  }
  async executeNextTrade() {
    if (!this.isRunning || !this.config || this.isTradeInFlight) return;
    if (this.totalProfit >= this.config.takeProfit) {
      this.stop("take_profit");
      return;
    }
    if (this.totalProfit <= -this.config.stopLoss) {
      this.stop("stop_loss");
      return;
    }
    if (this.trades.length >= this.config.targetRuns) {
      this.stop("max_runs");
      return;
    }
    this.isTradeInFlight = true;
    const contractType = this.calculateSignal();
    const stake = this.currentStake;
    try {
      console.log(`[ServerBot] Placing order: ${contractType} $${stake} on ${this.config.symbol}`);
      const buyRes = await this.sendWS({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: "stake",
          contract_type: contractType,
          currency: this.config.currency || "USD",
          duration: 5,
          duration_unit: "t",
          symbol: this.config.symbol
        }
      });
      if (buyRes?.buy?.contract_id) {
        const contractId = buyRes.buy.contract_id;
        if (typeof buyRes.buy.balance_after === "number") {
          this.balance = buyRes.buy.balance_after;
        }
        this.sendWS({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }).catch(() => {
        });
      } else {
        throw new Error("No contract_id in buy response");
      }
    } catch (err) {
      console.error("[ServerBot] Buy error:", err.message);
      this.isTradeInFlight = false;
      this.stop(`Buy error: ${err.message}`);
    }
  }
  calculateSignal() {
    const n = this.ticks.length;
    if (n < 3) return "CALL";
    const current = this.ticks[n - 1];
    const mean = this.ticks.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(this.ticks.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n) || 1e-3;
    const z = (current - mean) / stdDev;
    const high = Math.max(...this.ticks);
    const low = Math.min(...this.ticks);
    const k = high !== low ? (current - low) / (high - low) * 100 : 50;
    if (k < 25 || z > 0.6) return "CALL";
    if (k > 75 || z < -0.6) return "PUT";
    return current >= this.ticks[n - 2] ? "CALL" : "PUT";
  }
  handleContractSettled(poc) {
    this.isTradeInFlight = false;
    const isWin = poc.status === "won";
    const profit = Number(poc.profit || 0);
    const trade = {
      id: Math.random().toString(36).substring(2, 9),
      contractId: String(poc.contract_id),
      symbol: this.config?.symbol || "",
      symbolName: this.config?.symbolName || "",
      type: poc.contract_type || "CALL",
      stake: this.currentStake,
      payout: Number(poc.payout || 0),
      status: isWin ? "WIN" : "LOSS",
      profit,
      entryPrice: Number(poc.entry_tick || 0),
      exitPrice: Number(poc.exit_tick || 0),
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString()
    };
    this.trades.unshift(trade);
    this.totalProfit = +(this.totalProfit + profit).toFixed(2);
    this.lastUpdate = Date.now();
    if (isWin) {
      this.winCount++;
      this.currentStake = this.config?.stake || 1;
    } else {
      this.lossCount++;
      this.currentStake = +(this.currentStake * 1.5).toFixed(2);
    }
    console.log(`[ServerBot] Trade settled: ${trade.status} (${profit >= 0 ? "+" : ""}$${profit}). Net: $${this.totalProfit}`);
    if (this.config && this.totalProfit >= this.config.takeProfit) {
      this.stop("take_profit");
    } else if (this.config && this.totalProfit <= -this.config.stopLoss) {
      this.stop("stop_loss");
    } else if (this.config && this.trades.length >= this.config.targetRuns) {
      this.stop("max_runs");
    }
  }
};
var globalForBot = globalThis;
var serverBotManager = globalForBot.serverBotManager || new ServerBotManager();
if (process.env.NODE_ENV !== "production") {
  globalForBot.serverBotManager = serverBotManager;
} else {
  globalForBot.serverBotManager = serverBotManager;
}

// server.ts
dotenv.config();
var dev = process.env.NODE_ENV !== "production";
var app = next({ dev });
var handle = app.getRequestHandler();
var PORT = Number(process.env.PORT) || 3e3;
var HOST = "0.0.0.0";
var DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.VITE_DERIV_APP_ID || "33E1sj7WNaMsjg5MAxPyS";
var DERIV_ENV = process.env.NEXT_PUBLIC_DERIV_ENV || "production";
var DERIV_OAUTH_URL = DERIV_ENV === "staging" ? "https://staging-oauth.deriv.com" : "https://oauth.deriv.com";
var DERIV_API_URL = DERIV_ENV === "staging" ? "https://staging-api.deriv.com" : "https://api.deriv.com";
app.prepare().then(() => {
  const server = express();
  server.use(express.json());
  server.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      app: "G-Squad",
      framework: "Next.js 15 App Router",
      domain: "g-squad.buzz",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  server.post("/api/deriv/token", async (req, res) => {
    try {
      const { code, code_verifier, client_id, redirect_uri } = req.body;
      if (!code || !code_verifier) {
        return res.status(400).json({ error: "Missing code or code_verifier" });
      }
      const params = new URLSearchParams();
      params.set("grant_type", "authorization_code");
      params.set("client_id", client_id || DERIV_APP_ID);
      params.set("code", code);
      params.set("redirect_uri", redirect_uri || "https://g-squad.buzz");
      params.set("code_verifier", code_verifier);
      const response = await fetch(`${DERIV_OAUTH_URL}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Error exchanging Deriv token:", error);
      res.status(500).json({ error: error?.message || "Internal server error exchanging token" });
    }
  });
  server.get("/api/deriv/accounts", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const appId = req.headers["x-deriv-app-id"] || DERIV_APP_ID;
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }
      const response = await fetch(`${DERIV_API_URL}/trading/v1/options/accounts`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Deriv-App-ID": String(appId)
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Error fetching Deriv accounts:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch Deriv accounts" });
    }
  });
  server.post("/api/deriv/otp", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { account_id, app_id } = req.body;
      if (!authHeader || !account_id) {
        return res.status(400).json({ error: "Missing account_id or Authorization header" });
      }
      const response = await fetch(`${DERIV_API_URL}/trading/v1/options/accounts/${account_id}/otp`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Deriv-App-ID": String(app_id || DERIV_APP_ID),
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Error fetching Deriv OTP:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch Deriv OTP" });
    }
  });
  server.get("/api/bot/status", (req, res) => {
    res.json(serverBotManager.getStatus());
  });
  server.post("/api/bot/start", async (req, res) => {
    try {
      const status = await serverBotManager.start(req.body);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to start bot" });
    }
  });
  server.post("/api/bot/stop", (req, res) => {
    try {
      const status = serverBotManager.stop(req.body?.reason || "user_action");
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to stop bot" });
    }
  });
  server.get("/registerSW.js", (req, res) => {
    res.type("application/javascript").send(`if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}`);
  });
  server.get("/sw.js", (req, res) => {
    res.type("application/javascript").send(`self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});`);
  });
  server.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  server.listen(PORT, HOST, () => {
    console.log(`> G-Squad Next.js full-stack server running on http://${HOST}:${PORT}`);
    console.log(`> Persistent background trading bot is ACTIVE`);
  });
}).catch((err) => {
  console.error("Error starting G-Squad Next.js server:", err);
  process.exit(1);
});
