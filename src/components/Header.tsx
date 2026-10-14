import React from 'react';
import { AccountType, DerivAccount } from '../types';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';

interface HeaderProps {
  balance: number | null;
  accountType: AccountType;
  onToggleAccount: (type: AccountType) => void;
  isConnected: boolean;
  activeAccount?: DerivAccount | null;
  isLoggedIn?: boolean;
  onConnectClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  balance,
  accountType,
  onToggleAccount,
  isConnected,
  activeAccount,
  isLoggedIn = false,
  onConnectClick,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 tracking-tight text-sm">G-Squad</span>
              {isLoggedIn ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  accountType === 'demo' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {accountType}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600">
                  Guest
                </span>
              )}
              {isLoggedIn && activeAccount && (
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                  {activeAccount.account_id}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isConnected ? 'Deriv WS Live' : 'Disconnected'}</span>
              {isLoggedIn && (
                <span className="text-emerald-600 font-semibold text-[10px] flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  OAuth
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn && balance !== null ? (
            /* Connected Balance Button */
            <button
              onClick={() => onToggleAccount(accountType === 'demo' ? 'real' : 'demo')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              title="Click to toggle between Demo and Real account"
            >
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
              <span>${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </button>
          ) : (
            /* Disconnected / Prompt to Connect */
            <button
              onClick={onConnectClick}
              className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              title="Connect Deriv account to show balance"
            >
              <Wallet className="w-3.5 h-3.5 text-slate-500" />
              <span>Connect Deriv</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
