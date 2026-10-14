'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardTab } from './components/DashboardTab';
import { SettingsTab } from './components/SettingsTab';
import { ToastContainer } from './components/ToastContainer';
import { TabType, AccountType, BotConfig, MarketSymbol, Trade, DerivAccount, ToastItem, AuthInfo } from './types';
import { storage } from './core/auth/storage';
import { DERIV_CONFIG } from './core/config/urls';
import { initiateLogin, handleOAuthCallback } from './core/auth/oauth';
import { fetchAccounts, getWebSocketOTP } from './core/auth/accounts';
import { useDerivWS } from './core/react/useDerivWS';
import { soundAlerts } from './core/audio/alerts';
import { MomentumStochasticEngine } from './core/strategy/momentum-stochastic';

// Static Market Symbols (defined at module scope to prevent re-allocations)
const DEFAULT_SYMBOLS: MarketSymbol[] = [
  { id: 'R_10', name: 'Volatility 10 Index', price: 6124.50, change: 0.24, category: 'Volatility' },
  { id: 'R_25', name: 'Volatility 25 Index', price: 4832.10, change: -0.12, category: 'Volatility' },
  { id: 'R_50', name: 'Volatility 50 Index', price: 9245.80, change: 0.45, category: 'Volatility' },
  { id: 'R_75', name: 'Volatility 75 Index', price: 14280.35, change: 1.15, category: 'Volatility' },
  { id: 'R_100', name: 'Volatility 100 Index', price: 8930.20, change: -0.38, category: 'Volatility' },
  { id: 'BOOM1000', name: 'Boom 1000 Index', price: 12450.00, change: 0.85, category: 'Boom/Crash' },
  { id: 'CRASH1000', name: 'Crash 1000 Index', price: 11200.50, change: -0.65, category: 'Boom/Crash' },
];

const DEFAULT_BOT_CONFIG: BotConfig = {
  strategy: 'martingale',
  stake: 1.00,
  takeProfit: 50.00,
  stopLoss: 100.00,
  multiplier: 1.5,
  targetRuns: 50,
  symbol: 'R_75',
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Toast notifications state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Deriv Authentication & Account States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<DerivAccount | null>(null);
  const [otpWsUrl, setOtpWsUrl] = useState<string | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Trading & Bot States - Balance is NULL until user connects!
  const [accountType, setAccountType] = useState<AccountType>('demo');
  const [balance, setBalance] = useState<number | null>(null);
  const [isBotRunning, setIsBotRunning] = useState<boolean>(() => storage.getBotRunning());
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [winCount, setWinCount] = useState<number>(0);
  const [lossCount, setLossCount] = useState<number>(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const latestTradeIdRef = useRef<string | null>(null);

  const handleFinishSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  const [botConfig, setBotConfig] = useState<BotConfig>(() => {
    const saved = storage.getBotConfig();
    return saved ? { ...DEFAULT_BOT_CONFIG, ...saved } : DEFAULT_BOT_CONFIG;
  });

  const [currentSymbol, setCurrentSymbol] = useState<MarketSymbol>(() => {
    const matched = DEFAULT_SYMBOLS.find(s => s.id === botConfig.symbol);
    return matched || DEFAULT_SYMBOLS[3];
  });

  // Fixed Momentum Volatility Breakout Deviation Calculator with Stochastic oscillator engine
  const strategyEngineRef = useRef<MomentumStochasticEngine>(new MomentumStochasticEngine());

  // Current dynamic stake (e.g. $1.00 base, multiplies by 1.5x on loss)
  const currentStakeRef = useRef<number>(botConfig.stake);
  useEffect(() => {
    currentStakeRef.current = botConfig.stake;
  }, [botConfig.stake]);

  // Real Deriv WebSocket Client Hook
  const { ws, isConnected, subscribe } = useDerivWS({
    url: otpWsUrl,
    appId: DERIV_CONFIG.appId,
    token: authInfo?.access_token,
  });

  // 1. Handle OAuth Callback & Existing Session on Mount
  useEffect(() => {
    const initAuth = async () => {
      // Check for OAuth Callback code in URL
      if (typeof window !== 'undefined' && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
          setIsConnecting(true);
          try {
            const auth = await handleOAuthCallback(window.location.href);
            setAuthInfo(auth);
            setIsLoggedIn(true);

            // Fetch user accounts
            const fetchedAccounts = await fetchAccounts(auth, DERIV_CONFIG.appId);
            setAccounts(fetchedAccounts);

            if (fetchedAccounts.length > 0) {
              const active = fetchedAccounts[0];
              setActiveAccount(active);
              setAccountType(active.is_virtual ? 'demo' : 'real');
              if (typeof active.balance === 'number') {
                setBalance(active.balance);
              }

              // Generate authenticated WebSocket OTP URL
              const otpUrl = await getWebSocketOTP(active.account_id, auth, DERIV_CONFIG.appId);
              setOtpWsUrl(otpUrl);

              showToast({
                type: 'success',
                title: 'Deriv Connected! 🎉',
                message: `Logged in to account ${active.account_id} with live balance.`,
              });
            }
          } catch (err: any) {
            console.error('Deriv OAuth login failed:', err);
            showToast({
              type: 'error',
              title: 'Login Failed',
              message: err?.message || 'Could not authenticate with Deriv.',
            });
          } finally {
            setIsConnecting(false);
          }
          return;
        }
      }

      // Restore existing stored session if valid (Never logged out when tab closes!)
      const existingAuth = storage.getAuthInfo();
      if (existingAuth && existingAuth.access_token) {
        setAuthInfo(existingAuth);
        setIsLoggedIn(true);

        const storedAccounts = storage.getAccounts();
        if (storedAccounts.length > 0) {
          setAccounts(storedAccounts);
          const activeId = storage.getActiveAccountId();
          const active = storedAccounts.find(a => a.account_id === activeId) || storedAccounts[0];
          setActiveAccount(active);
          setAccountType(active.is_virtual ? 'demo' : 'real');
          if (typeof active.balance === 'number') {
            setBalance(active.balance);
          }
        } else {
          // Re-fetch accounts
          fetchAccounts(existingAuth, DERIV_CONFIG.appId).then((accs) => {
            setAccounts(accs);
            if (accs.length > 0) {
              setActiveAccount(accs[0]);
              setAccountType(accs[0].is_virtual ? 'demo' : 'real');
              if (typeof accs[0].balance === 'number') {
                setBalance(accs[0].balance);
              }
            }
          }).catch(() => {});
        }
      }
    };

    initAuth();
  }, [showToast]);

  // 2. Real Deriv WebSocket Live Tick Subscription & Strategy Feed
  const prevPriceRef = useRef<number>(currentSymbol.price);
  useEffect(() => {
    if (!isConnected || !ws) return;

    strategyEngineRef.current.addTick(currentSymbol.price);

    const unsubscribe = subscribe({ ticks: currentSymbol.id }, (data: any) => {
      if (data && data.tick && typeof data.tick.quote === 'number') {
        const livePrice = data.tick.quote;
        const previous = prevPriceRef.current || livePrice;
        const priceDiff = livePrice - previous;
        const percentChange = +( (priceDiff / previous) * 100 ).toFixed(2);
        prevPriceRef.current = livePrice;

        strategyEngineRef.current.addTick(livePrice);

        setCurrentSymbol((prev) => ({
          ...prev,
          price: livePrice,
          change: percentChange || prev.change,
        }));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isConnected, ws, currentSymbol.id, subscribe]);

  // 3. Real Deriv Live Balance Subscription
  useEffect(() => {
    if (!isConnected || !ws || !isLoggedIn) return;

    const unsubBalance = subscribe({ balance: 1 }, (data: any) => {
      if (data && data.balance && typeof data.balance.balance === 'number') {
        setBalance(data.balance.balance);
      }
    });

    return () => {
      if (unsubBalance) unsubBalance();
    };
  }, [isConnected, ws, isLoggedIn, subscribe]);

  // 4. Background Persistent Bot Sync (runs even when user was offline or closed tab!)
  const syncServerBotStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (!res.ok) return;
      const status = await res.json();

      if (status.isRunning) {
        setIsBotRunning(true);
        storage.saveBotRunning(true);
        if (typeof status.totalProfit === 'number') setTotalProfit(status.totalProfit);
        if (typeof status.winCount === 'number') setWinCount(status.winCount);
        if (typeof status.lossCount === 'number') setLossCount(status.lossCount);
        if (Array.isArray(status.trades)) {
          if (status.trades.length > 0 && status.trades[0].id !== latestTradeIdRef.current) {
            const latest = status.trades[0];
            latestTradeIdRef.current = latest.id;
            if (latest.status === 'WIN') {
              soundAlerts.playWin();
            }
          }
          setTrades(status.trades);
        }
        if (typeof status.balance === 'number') setBalance(status.balance);
      } else if (storage.getBotRunning() && status.stoppedReason) {
        // Stopped on server while user was away / offline!
        setIsBotRunning(false);
        storage.saveBotRunning(false);
        if (typeof status.totalProfit === 'number') setTotalProfit(status.totalProfit);
        if (typeof status.winCount === 'number') setWinCount(status.winCount);
        if (typeof status.lossCount === 'number') setLossCount(status.lossCount);
        if (Array.isArray(status.trades)) {
          if (status.trades.length > 0 && status.trades[0].id !== latestTradeIdRef.current) {
            const latest = status.trades[0];
            latestTradeIdRef.current = latest.id;
            if (latest.status === 'WIN') {
              soundAlerts.playWin();
            }
          }
          setTrades(status.trades);
        }
        if (typeof status.balance === 'number') setBalance(status.balance);

        if (status.stoppedReason === 'take_profit') {
          soundAlerts.playTakeProfit();
          showToast({
            type: 'success',
            title: 'Take-Profit Hit! 🎯',
            message: `Target reached! Bot secured +$${status.totalProfit.toFixed(2)} while running in background.`,
            duration: 6000,
          });
        } else if (status.stoppedReason === 'stop_loss') {
          soundAlerts.playStopLoss();
          showToast({
            type: 'error',
            title: 'Stop-Loss Triggered! 🛑',
            message: `Risk limit reached (-$${Math.abs(status.totalProfit).toFixed(2)}). Bot halted to protect capital.`,
            duration: 6000,
          });
        } else if (status.stoppedReason === 'max_runs') {
          soundAlerts.playTakeProfit();
          showToast({
            type: 'info',
            title: 'Max Runs Completed! 🏁',
            message: `Executed all ${status.config?.targetRuns || 'target'} runs. Net P/L: $${status.totalProfit.toFixed(2)}.`,
            duration: 6000,
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }, [showToast]);

  // Periodic poll + window focus / online event listeners
  useEffect(() => {
    syncServerBotStatus();

    const handleFocus = () => syncServerBotStatus();
    const handleOnline = () => syncServerBotStatus();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleFocus);

    const interval = setInterval(() => {
      syncServerBotStatus();
    }, 2500);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [syncServerBotStatus]);

  // Handle toggling the bot on / off
  const handleToggleBot = async () => {
    soundAlerts.unlockAudio();

    if (!isLoggedIn || !authInfo || !activeAccount) {
      soundAlerts.playBotStop();
      showToast({
        type: 'warning',
        title: 'Connection Required ⚠️',
        message: 'Please connect your Deriv account to view your balance and trade.',
      });
      setActiveTab('settings');
      return;
    }

    if (balance === null || balance < botConfig.stake) {
      soundAlerts.playBotStop();
      showToast({
        type: 'error',
        title: 'Insufficient Balance ⚠️',
        message: `Your balance ($${balance ? balance.toFixed(2) : '0.00'}) is lower than the initial stake ($${botConfig.stake.toFixed(2)}).`,
      });
      return;
    }

    if (isBotRunning) {
      // User manual stop action
      setIsBotRunning(false);
      storage.saveBotRunning(false);
      soundAlerts.playBotStop();

      try {
        await fetch('/api/bot/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'user_action' }),
        });
      } catch (e) {
        // ignore
      }

      showToast({
        type: 'info',
        title: 'Bot Stopped ⏹️',
        message: 'Automated trading has been paused by the user.',
      });
    } else {
      // User start action - persistent background execution!
      currentStakeRef.current = botConfig.stake;
      setIsBotRunning(true);
      storage.saveBotRunning(true);
      soundAlerts.playBotStart();

      try {
        await fetch('/api/bot/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: authInfo.access_token,
            accountId: activeAccount.account_id,
            symbol: currentSymbol.id,
            symbolName: currentSymbol.name,
            currency: activeAccount.currency || 'USD',
            stake: botConfig.stake,
            takeProfit: botConfig.takeProfit,
            stopLoss: botConfig.stopLoss,
            targetRuns: botConfig.targetRuns,
          }),
        });
      } catch (e) {
        console.warn('Server bot start error:', e);
      }

      showToast({
        type: 'info',
        title: 'Bot Started 🚀',
        message: `Trading ${currentSymbol.name} in background (Max Runs: ${botConfig.targetRuns}, Stake: $${botConfig.stake.toFixed(2)}).`,
      });
    }
  };

  // Login handler
  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      await initiateLogin({
        clientId: DERIV_CONFIG.appId,
        redirectUri: DERIV_CONFIG.redirectUri,
        scopes: DERIV_CONFIG.oauthScopes,
      });
    } catch (err: any) {
      console.error('Failed to initiate Deriv login:', err);
      showToast({
        type: 'error',
        title: 'Login Error',
        message: err.message || 'Failed to start Deriv OAuth flow.',
      });
      setIsConnecting(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    storage.clearAuthInfo();
    setIsLoggedIn(false);
    setAuthInfo(null);
    setAccounts([]);
    setActiveAccount(null);
    setOtpWsUrl(undefined);
    setAccountType('demo');
    setBalance(null);
    setIsBotRunning(false);
    storage.saveBotRunning(false);
    setTrades([]);
    setTotalProfit(0);
    setWinCount(0);
    setLossCount(0);

    fetch('/api/bot/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'logout' }),
    }).catch(() => {});

    showToast({
      type: 'info',
      title: 'Logged Out',
      message: 'Deriv account disconnected. Balance hidden.',
    });
  };

  // Account switch handler
  const handleSelectAccount = async (accountId: string) => {
    const selected = accounts.find(a => a.account_id === accountId);
    if (!selected) return;

    setActiveAccount(selected);
    storage.saveActiveAccountId(accountId);
    setAccountType(selected.is_virtual ? 'demo' : 'real');
    if (typeof selected.balance === 'number') {
      setBalance(selected.balance);
    }

    if (authInfo) {
      try {
        const otpUrl = await getWebSocketOTP(accountId, authInfo, DERIV_CONFIG.appId);
        setOtpWsUrl(otpUrl);
      } catch (e) {
        console.warn('Failed to refresh OTP for account:', e);
      }
    }

    showToast({
      type: 'info',
      title: 'Account Switched',
      message: `Active account: ${selected.account_id} (${selected.is_virtual ? 'Demo' : 'Real'})`,
    });
  };

  const handleToggleAccountType = (type: AccountType) => {
    if (!isLoggedIn) {
      showToast({
        type: 'warning',
        title: 'Connect Account',
        message: 'Log in to Deriv to switch between your real and demo accounts.',
      });
      setActiveTab('settings');
      return;
    }

    setAccountType(type);
    if (accounts.length > 0) {
      const match = accounts.find(a => type === 'demo' ? a.is_virtual : !a.is_virtual);
      if (match) {
        handleSelectAccount(match.account_id);
      }
    }
  };

  // Refresh balance manually
  const handleRefreshBalance = async () => {
    if (!authInfo || !isLoggedIn) return;
    try {
      const fetchedAccounts = await fetchAccounts(authInfo, DERIV_CONFIG.appId);
      setAccounts(fetchedAccounts);
      if (activeAccount) {
        const updated = fetchedAccounts.find(a => a.account_id === activeAccount.account_id);
        if (updated && typeof updated.balance === 'number') {
          setBalance(updated.balance);
          showToast({
            type: 'success',
            title: 'Balance Synchronized',
            message: `Updated balance: $${updated.balance.toFixed(2)}`,
          });
        }
      }
    } catch (e) {
      console.warn('Balance refresh failed:', e);
    }
  };

  const handleUpdateConfig = useCallback((cfg: BotConfig) => {
    setBotConfig(cfg);
    storage.saveBotConfig(cfg);
    const matched = DEFAULT_SYMBOLS.find(s => s.id === cfg.symbol);
    if (matched) setCurrentSymbol(matched);
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleFinishSplash} />}

      {/* Mobile Device Only Container */}
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 sm:py-6 sm:px-4">
        <div className="w-full sm:max-w-[412px] h-screen sm:h-[844px] bg-slate-50 shadow-2xl sm:rounded-[40px] sm:border-[8px] sm:border-slate-800 flex flex-col overflow-hidden relative">
          
          {/* Toast Notification Container */}
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />

          {/* Header */}
          <Header
            balance={balance}
            accountType={accountType}
            onToggleAccount={handleToggleAccountType}
            isConnected={isConnected}
            activeAccount={activeAccount}
            isLoggedIn={isLoggedIn}
            onConnectClick={() => setActiveTab('settings')}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-0 bg-slate-50">
            {activeTab === 'dashboard' && (
              <DashboardTab
                balance={balance}
                isLoggedIn={isLoggedIn}
                isBotRunning={isBotRunning}
                onToggleBot={handleToggleBot}
                botConfig={botConfig}
                trades={trades}
                currentSymbol={currentSymbol}
                totalProfit={totalProfit}
                winCount={winCount}
                lossCount={lossCount}
                onNavigateSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                accountType={accountType}
                onToggleAccount={handleToggleAccountType}
                balance={balance}
                onRefreshBalance={handleRefreshBalance}
                botConfig={botConfig}
                onChangeConfig={handleUpdateConfig}
                symbols={DEFAULT_SYMBOLS}
                isLoggedIn={isLoggedIn}
                activeAccount={activeAccount}
                accounts={accounts}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onSelectAccount={handleSelectAccount}
                isConnecting={isConnecting}
              />
            )}
          </main>

          {/* Bottom Navigation */}
          <BottomNav
            activeTab={activeTab}
            onChangeTab={setActiveTab}
          />

        </div>
      </div>
    </>
  );
}
