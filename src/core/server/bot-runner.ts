/**
 * Server-Side Persistent Background Trading Bot Engine
 * Keeps running Deriv trading even when the user closes their tab, locks their phone, or goes offline.
 */

// Native WebSocket supported in Node 22+

export interface ServerBotConfig {
  token: string;
  accountId: string;
  symbol: string;
  symbolName: string;
  currency: string;
  stake: number;
  takeProfit: number;
  stopLoss: number;
  targetRuns: number;
}

export interface ServerTrade {
  id: string;
  contractId: string;
  symbol: string;
  symbolName: string;
  type: 'CALL' | 'PUT';
  stake: number;
  payout: number;
  status: 'WIN' | 'LOSS';
  profit: number;
  entryPrice: number;
  exitPrice: number;
  timestamp: string;
}

export interface ServerBotStatus {
  isRunning: boolean;
  config: ServerBotConfig | null;
  currentStake: number;
  totalProfit: number;
  winCount: number;
  lossCount: number;
  trades: ServerTrade[];
  stoppedReason: string | null;
  lastUpdate: number;
  balance?: number;
}

class ServerBotManager {
  private config: ServerBotConfig | null = null;
  private isRunning = false;
  private currentStake = 1.0;
  private totalProfit = 0;
  private winCount = 0;
  private lossCount = 0;
  private trades: ServerTrade[] = [];
  private stoppedReason: string | null = null;
  private lastUpdate = Date.now();
  private balance: number | undefined = undefined;

  private ws: any = null;
  private ticks: number[] = [];
  private isTradeInFlight = false;
  private tradeTimer: any = null;
  private reqIdCounter = 100;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  public getStatus(): ServerBotStatus {
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
      balance: this.balance,
    };
  }

  public async start(config: ServerBotConfig): Promise<ServerBotStatus> {
    this.stop('restarted');

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

  public stop(reason: string = 'user_action'): ServerBotStatus {
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
        // ignore
      }
      this.ws = null;
    }

    return this.getStatus();
  }

  private initWebSocket() {
    if (!this.isRunning || !this.config) return;

    try {
      const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=33E1sj7WNaMsjg5MAxPyS&l=en&brand=deriv`;
      const WS = (globalThis as any).WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);
      if (!WS) throw new Error('WebSocket not available in environment');
      this.ws = new WS(wsUrl);

      this.ws.onopen = async () => {
        console.log('[ServerBot] Connected to Deriv WS. Authorizing...');
        try {
          const authRes = await this.sendWS({ authorize: this.config!.token });
          if (authRes?.authorize?.balance) {
            this.balance = authRes.authorize.balance;
          }

          // Subscribe to live ticks
          this.sendWS({ ticks: this.config!.symbol, subscribe: 1 }).catch(() => {});
          // Subscribe to balance
          this.sendWS({ balance: 1, subscribe: 1 }).catch(() => {});

          // Start loop
          this.startTradingLoop();
        } catch (err: any) {
          console.error('[ServerBot] Auth failed:', err.message);
          this.stop(`Auth error: ${err.message}`);
        }
      };

      this.ws.onmessage = (event: any) => {
        try {
          const raw = event.data !== undefined ? event.data : event;
          const data = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
          this.handleWSMessage(data);
        } catch (e) {
          // ignore
        }
      };

      this.ws.onclose = () => {
        if (this.isRunning) {
          console.log('[ServerBot] WS closed unexpectedly. Reconnecting in 3s...');
          setTimeout(() => {
            if (this.isRunning) this.initWebSocket();
          }, 3000);
        }
      };

      this.ws.onerror = (err: any) => {
        console.error('[ServerBot] WS error:', err?.message || err);
      };
    } catch (e: any) {
      console.error('[ServerBot] Failed to create WS:', e.message);
    }
  }

  private handleWSMessage(data: any) {
    if (data.req_id && this.pendingRequests.has(data.req_id)) {
      const { resolve, reject } = this.pendingRequests.get(data.req_id)!;
      this.pendingRequests.delete(data.req_id);
      if (data.error) {
        reject(new Error(data.error.message || 'Deriv error'));
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

  private sendWS(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        return reject(new Error('WebSocket not connected'));
      }
      const req_id = this.reqIdCounter++;
      this.pendingRequests.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...payload, req_id }));
    });
  }

  private startTradingLoop() {
    if (this.tradeTimer) clearInterval(this.tradeTimer);

    // Initial trade
    this.executeNextTrade();

    this.tradeTimer = setInterval(() => {
      if (this.isRunning && !this.isTradeInFlight) {
        this.executeNextTrade();
      }
    }, 4500);
  }

  private async executeNextTrade() {
    if (!this.isRunning || !this.config || this.isTradeInFlight) return;

    // 1. Risk limit checks
    if (this.totalProfit >= this.config.takeProfit) {
      this.stop('take_profit');
      return;
    }

    if (this.totalProfit <= -this.config.stopLoss) {
      this.stop('stop_loss');
      return;
    }

    if (this.trades.length >= this.config.targetRuns) {
      this.stop('max_runs');
      return;
    }

    this.isTradeInFlight = true;

    // 2. Momentum Volatility Breakout & Stochastic Decision
    const contractType = this.calculateSignal();
    const stake = this.currentStake;

    try {
      console.log(`[ServerBot] Placing order: ${contractType} $${stake} on ${this.config.symbol}`);
      const buyRes = await this.sendWS({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: contractType,
          currency: this.config.currency || 'USD',
          duration: 5,
          duration_unit: 't',
          symbol: this.config.symbol,
        },
      });

      if (buyRes?.buy?.contract_id) {
        const contractId = buyRes.buy.contract_id;
        if (typeof buyRes.buy.balance_after === 'number') {
          this.balance = buyRes.buy.balance_after;
        }

        // Subscribe to open contract updates
        this.sendWS({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }).catch(() => {});
      } else {
        throw new Error('No contract_id in buy response');
      }
    } catch (err: any) {
      console.error('[ServerBot] Buy error:', err.message);
      this.isTradeInFlight = false;
      this.stop(`Buy error: ${err.message}`);
    }
  }

  private calculateSignal(): 'CALL' | 'PUT' {
    const n = this.ticks.length;
    if (n < 3) return 'CALL';

    const current = this.ticks[n - 1];
    const mean = this.ticks.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(this.ticks.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n) || 0.001;
    const z = (current - mean) / stdDev;

    const high = Math.max(...this.ticks);
    const low = Math.min(...this.ticks);
    const k = high !== low ? ((current - low) / (high - low)) * 100 : 50;

    if (k < 25 || z > 0.6) return 'CALL';
    if (k > 75 || z < -0.6) return 'PUT';
    return current >= this.ticks[n - 2] ? 'CALL' : 'PUT';
  }

  private handleContractSettled(poc: any) {
    this.isTradeInFlight = false;
    const isWin = poc.status === 'won';
    const profit = Number(poc.profit || 0);

    const trade: ServerTrade = {
      id: Math.random().toString(36).substring(2, 9),
      contractId: String(poc.contract_id),
      symbol: this.config?.symbol || '',
      symbolName: this.config?.symbolName || '',
      type: poc.contract_type || 'CALL',
      stake: this.currentStake,
      payout: Number(poc.payout || 0),
      status: isWin ? 'WIN' : 'LOSS',
      profit,
      entryPrice: Number(poc.entry_tick || 0),
      exitPrice: Number(poc.exit_tick || 0),
      timestamp: new Date().toLocaleTimeString(),
    };

    this.trades.unshift(trade);
    this.totalProfit = +(this.totalProfit + profit).toFixed(2);
    this.lastUpdate = Date.now();

    if (isWin) {
      this.winCount++;
      this.currentStake = this.config?.stake || 1.0;
    } else {
      this.lossCount++;
      // Multiply stake by 1.5x on loss
      this.currentStake = +(this.currentStake * 1.5).toFixed(2);
    }

    console.log(`[ServerBot] Trade settled: ${trade.status} (${profit >= 0 ? '+' : ''}$${profit}). Net: $${this.totalProfit}`);

    // Check risk limits after settlement
    if (this.config && this.totalProfit >= this.config.takeProfit) {
      this.stop('take_profit');
    } else if (this.config && this.totalProfit <= -this.config.stopLoss) {
      this.stop('stop_loss');
    } else if (this.config && this.trades.length >= this.config.targetRuns) {
      this.stop('max_runs');
    }
  }
}

// Singleton preservation across Next.js hot reloads and Route Handlers
const globalForBot = globalThis as unknown as { serverBotManager?: ServerBotManager };
export const serverBotManager = globalForBot.serverBotManager || new ServerBotManager();
if (process.env.NODE_ENV !== 'production') {
  globalForBot.serverBotManager = serverBotManager;
} else {
  globalForBot.serverBotManager = serverBotManager;
}
