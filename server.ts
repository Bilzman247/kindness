import express from 'express';
import next from 'next';
import { parse } from 'url';
import dotenv from 'dotenv';
import { serverBotManager } from './src/core/server/bot-runner';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.VITE_DERIV_APP_ID || '33E1sj7WNaMsjg5MAxPyS';
const DERIV_ENV = process.env.NEXT_PUBLIC_DERIV_ENV || 'production';
const DERIV_OAUTH_URL = DERIV_ENV === 'staging' ? 'https://staging-oauth.deriv.com' : 'https://oauth.deriv.com';
const DERIV_API_URL = DERIV_ENV === 'staging' ? 'https://staging-api.deriv.com' : 'https://api.deriv.com';

app.prepare().then(() => {
  const server = express();
  server.use(express.json());

  // Health endpoint
  server.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'G-Squad',
      framework: 'Next.js 15 App Router',
      domain: 'g-squad.buzz',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Deriv OAuth 2.0 PKCE Token Exchange Proxy
   */
  server.post('/api/deriv/token', async (req, res) => {
    try {
      const { code, code_verifier, client_id, redirect_uri } = req.body;

      if (!code || !code_verifier) {
        return res.status(400).json({ error: 'Missing code or code_verifier' });
      }

      const params = new URLSearchParams();
      params.set('grant_type', 'authorization_code');
      params.set('client_id', client_id || DERIV_APP_ID);
      params.set('code', code);
      params.set('redirect_uri', redirect_uri || 'https://g-squad.buzz');
      params.set('code_verifier', code_verifier);

      const response = await fetch(`${DERIV_OAUTH_URL}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('Error exchanging Deriv token:', error);
      res.status(500).json({ error: error?.message || 'Internal server error exchanging token' });
    }
  });

  /**
   * Deriv Accounts List Proxy
   */
  server.get('/api/deriv/accounts', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const appId = req.headers['x-deriv-app-id'] || DERIV_APP_ID;

      if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
      }

      const response = await fetch(`${DERIV_API_URL}/trading/v1/options/accounts`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Deriv-App-ID': String(appId),
        },
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('Error fetching Deriv accounts:', error);
      res.status(500).json({ error: error?.message || 'Failed to fetch Deriv accounts' });
    }
  });

  /**
   * Deriv WebSocket OTP Proxy
   */
  server.post('/api/deriv/otp', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { account_id, app_id } = req.body;

      if (!authHeader || !account_id) {
        return res.status(400).json({ error: 'Missing account_id or Authorization header' });
      }

      const response = await fetch(`${DERIV_API_URL}/trading/v1/options/accounts/${account_id}/otp`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Deriv-App-ID': String(app_id || DERIV_APP_ID),
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('Error fetching Deriv OTP:', error);
      res.status(500).json({ error: error?.message || 'Failed to fetch Deriv OTP' });
    }
  });

  /**
   * Persistent Background Bot Engine Endpoints
   * Runs in the same process, guaranteeing continuous execution even when offline
   */
  server.get('/api/bot/status', (req, res) => {
    res.json(serverBotManager.getStatus());
  });

  server.post('/api/bot/start', async (req, res) => {
    try {
      const status = await serverBotManager.start(req.body);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to start bot' });
    }
  });

  server.post('/api/bot/stop', (req, res) => {
    try {
      const status = serverBotManager.stop(req.body?.reason || 'user_action');
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to stop bot' });
    }
  });

  // Explicit service worker endpoints for PWA installation
  server.get('/registerSW.js', (req, res) => {
    res.type('application/javascript').send(`if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}`);
  });

  server.get('/sw.js', (req, res) => {
    res.type('application/javascript').send(`self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});`);
  });

  // Next.js App Router handler for all other requests
  server.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(PORT, HOST, () => {
    console.log(`> G-Squad Next.js full-stack server running on http://${HOST}:${PORT}`);
    console.log(`> Persistent background trading bot is ACTIVE`);
  });
}).catch((err) => {
  console.error('Error starting G-Squad Next.js server:', err);
  process.exit(1);
});
