import React, { useState, useEffect } from 'react';
import { AccountType, BotConfig, MarketSymbol, DerivAccount } from '../types';
import { Sliders, RotateCcw, LogIn, LogOut, CheckCircle2, ExternalLink, ShieldCheck, User, Smartphone } from 'lucide-react';
import { getSignUpUrl } from '../core/auth/oauth';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsTabProps {
  accountType: AccountType;
  onToggleAccount: (type: AccountType) => void;
  balance: number | null;
  onRefreshBalance?: () => void;
  botConfig: BotConfig;
  onChangeConfig: (config: BotConfig) => void;
  symbols: MarketSymbol[];
  isLoggedIn?: boolean;
  activeAccount?: DerivAccount | null;
  accounts?: DerivAccount[];
  onLogin?: () => void;
  onLogout?: () => void;
  onSelectAccount?: (accountId: string) => void;
  isConnecting?: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  accountType,
  onToggleAccount,
  balance,
  onRefreshBalance,
  botConfig,
  onChangeConfig,
  symbols,
  isLoggedIn = false,
  activeAccount,
  accounts = [],
  onLogin,
  onLogout,
  onSelectAccount,
  isConnecting = false,
}) => {
  // Smooth string buffers for numeric inputs to avoid jumping/locking while typing
  const [stakeStr, setStakeStr] = useState<string>(String(botConfig.stake));
  const [tpStr, setTpStr] = useState<string>(String(botConfig.takeProfit));
  const [slStr, setSlStr] = useState<string>(String(botConfig.stopLoss));
  const [runsStr, setRunsStr] = useState<string>(String(botConfig.targetRuns || 50));

  useEffect(() => {
    setStakeStr(String(botConfig.stake));
  }, [botConfig.stake]);

  useEffect(() => {
    setTpStr(String(botConfig.takeProfit));
  }, [botConfig.takeProfit]);

  useEffect(() => {
    setSlStr(String(botConfig.stopLoss));
  }, [botConfig.stopLoss]);

  useEffect(() => {
    setRunsStr(String(botConfig.targetRuns || 50));
  }, [botConfig.targetRuns]);

  const handleStakeChange = (val: string) => {
    setStakeStr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      onChangeConfig({ ...botConfig, stake: parsed });
    }
  };

  const handleRunsChange = (val: string) => {
    setRunsStr(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onChangeConfig({ ...botConfig, targetRuns: parsed });
    }
  };

  const handleTpChange = (val: string) => {
    setTpStr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      onChangeConfig({ ...botConfig, takeProfit: parsed });
    }
  };

  const handleSlChange = (val: string) => {
    setSlStr(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      onChangeConfig({ ...botConfig, stopLoss: parsed });
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 space-y-4 pb-12 select-none font-sans">
      
      {/* 1. Real Deriv OAuth Connection Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Deriv Account Connection</h3>
              <p className="text-[11px] text-slate-500">Official OAuth 2.0 & WebSocket API</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isLoggedIn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {isLoggedIn ? 'Connected' : 'Guest Mode'}
          </span>
        </div>

        {isLoggedIn ? (
          <div className="space-y-3 pt-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>{activeAccount?.account_id || 'Deriv Account'}</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded uppercase">
                      {activeAccount?.is_virtual ? 'Demo' : 'Real'}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Currency: <span className="font-semibold">{activeAccount?.currency || 'USD'}</span> • Live Synchronized
                  </div>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>

            {/* Account Selector if multiple accounts exist */}
            {accounts.length > 1 && onSelectAccount && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Switch Deriv Account</label>
                <select
                  value={activeAccount?.account_id || ''}
                  onChange={(e) => onSelectAccount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.account_id} ({acc.is_virtual ? 'Demo' : 'Real'}) - {acc.currency}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onLogout}
              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect Deriv Account</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-600 leading-relaxed">
              Log in with your official Deriv account via OAuth 2.0 PKCE to trade with your real or demo balance directly.
            </p>

            <button
              onClick={onLogin}
              disabled={isConnecting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting to Deriv...' : 'Log in with Deriv'}</span>
            </button>

            <div className="flex items-center justify-center pt-1">
              <a
                href={getSignUpUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <span>Don't have an account? Sign up</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 2. Parameters Card: Only Symbol, Stake, and Risk (Take Profit & Stop Loss) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>Trading & Risk Parameters</span>
        </h3>

        {/* 1. Market Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Synthetic Market</label>
          <select
            value={botConfig.symbol}
            onChange={(e) => onChangeConfig({ ...botConfig, symbol: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
          >
            {symbols.map((sym) => (
              <option key={sym.id} value={sym.id}>{sym.name}</option>
            ))}
          </select>
        </div>

        {/* 2. Stake Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Stake ($)</label>
          <input
            type="number"
            min="0.35"
            step="0.5"
            value={stakeStr}
            onChange={(e) => handleStakeChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
            placeholder="e.g. 1.00"
          />
        </div>

        {/* 3. Risk Inputs: Take Profit, Stop Loss & Max Runs */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Take Profit ($)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={tpStr}
              onChange={(e) => handleTpChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
              placeholder="e.g. 50"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Stop Loss ($)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={slStr}
              onChange={(e) => handleSlChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
              placeholder="e.g. 100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Max Runs</label>
            <input
              type="number"
              min="1"
              step="1"
              value={runsStr}
              onChange={(e) => handleRunsChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
              placeholder="e.g. 50"
            />
          </div>
        </div>
      </div>

      {/* 3. Account Preferences */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">App Preferences</h3>

        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div>
            <div className="font-bold text-xs text-slate-900">Account Mode</div>
            <div className="text-[11px] text-slate-500">
              {isLoggedIn ? `Active: ${accountType.toUpperCase()} (${activeAccount?.account_id || ''})` : 'Connect account to toggle'}
            </div>
          </div>
          {isLoggedIn ? (
            <button
              onClick={() => onToggleAccount(accountType === 'demo' ? 'real' : 'demo')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition"
            >
              Switch to {accountType === 'demo' ? 'Real' : 'Demo'}
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">Not Connected</span>
          )}
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-bold text-xs text-slate-900">Live Balance Sync</div>
            <div className="text-[11px] text-slate-500">
              {isLoggedIn && balance !== null
                ? `Current: $${balance.toFixed(2)} (${activeAccount?.currency || 'USD'})`
                : 'Balance only shown upon connecting Deriv'}
            </div>
          </div>
          {isLoggedIn && onRefreshBalance ? (
            <button
              onClick={onRefreshBalance}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sync Balance</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 italic">—</span>
          )}
        </div>
      </div>

      {/* 4. Install Mobile App (APK / PWA) Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-600" />
          <span>Install Mobile App (APK)</span>
        </h3>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Install G-Squad onto your phone for a full-screen native experience, home screen launcher icon, and persistent background trading.
        </p>
        <PWAInstallButton />
      </div>

    </div>
  );
};
