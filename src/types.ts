export type TabType = 'dashboard' | 'settings';

export type AccountType = 'demo' | 'real';

export type StrategyType = 'martingale' | 'dalembert' | 'rsi' | 'accumulator';

export interface BotConfig {
  strategy: StrategyType;
  stake: number;
  takeProfit: number;
  stopLoss: number;
  multiplier: number;
  targetRuns: number;
  symbol: string;
  predictionDigit?: number;
}

export interface Trade {
  id: string;
  contractId: string;
  symbol: string;
  symbolName: string;
  type: 'CALL' | 'PUT';
  stake: number;
  payout: number;
  status: 'WIN' | 'LOSS' | 'PENDING';
  profit: number;
  entryPrice: number;
  exitPrice: number;
  timestamp: string;
}

export interface MarketSymbol {
  id: string;
  name: string;
  price: number;
  change: number;
  category: 'Volatility' | 'Boom/Crash' | 'Step';
}

export interface DerivAccount {
  account_id: string;
  currency: string;
  is_virtual: boolean | number;
  balance?: number;
  email?: string;
}

export interface AuthInfo {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  acquired_at?: number;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}
