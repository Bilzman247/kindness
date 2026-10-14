/**
 * Secure Storage Manager for Deriv OAuth & Account Sessions
 */

export interface AuthInfo {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  acquired_at?: number;
  userId?: string;
}

export interface DerivAccount {
  account_id: string;
  currency: string;
  is_virtual: boolean | number;
  balance?: number;
  email?: string;
  token?: string;
}

const STORAGE_KEYS = {
  AUTH_INFO: 'deriv_auth_info',
  PKCE_VERIFIER: 'deriv_pkce_verifier',
  PKCE_STATE: 'deriv_pkce_state',
  ACCOUNTS: 'deriv_accounts',
  ACTIVE_ACCOUNT_ID: 'deriv_active_account_id',
  REDIRECT_URI: 'deriv_redirect_uri',
  MANUAL_TOKEN: 'deriv_manual_token',
};

export const storage = {
  // Auth Info
  saveAuthInfo(authInfo: AuthInfo): void {
    if (typeof window === 'undefined') return;
    const dataWithTimestamp = {
      ...authInfo,
      acquired_at: authInfo.acquired_at || Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.AUTH_INFO, JSON.stringify(dataWithTimestamp));
  },

  getAuthInfo(): AuthInfo | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_INFO);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  clearAuthInfo(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.AUTH_INFO);
    localStorage.removeItem(STORAGE_KEYS.ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID);
    localStorage.removeItem(STORAGE_KEYS.MANUAL_TOKEN);
  },

  // PKCE Verifier & State
  savePKCE(verifier: string, state: string, redirectUri?: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEYS.PKCE_VERIFIER, verifier);
    sessionStorage.setItem(STORAGE_KEYS.PKCE_STATE, state);
    if (redirectUri) {
      sessionStorage.setItem(STORAGE_KEYS.REDIRECT_URI, redirectUri);
    }
  },

  getPKCEVerifier(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(STORAGE_KEYS.PKCE_VERIFIER);
  },

  getPKCEState(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(STORAGE_KEYS.PKCE_STATE);
  },

  getPKCERedirectUri(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(STORAGE_KEYS.REDIRECT_URI);
  },

  clearPKCE(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
    sessionStorage.removeItem(STORAGE_KEYS.PKCE_STATE);
    sessionStorage.removeItem(STORAGE_KEYS.REDIRECT_URI);
  },

  // Accounts
  saveAccounts(accounts: DerivAccount[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  },

  getAccounts(): DerivAccount[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  // Active Account
  saveActiveAccountId(accountId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID, accountId);
  },

  getActiveAccountId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID);
  },

  // Manual API Token (optional fallback)
  saveManualToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.MANUAL_TOKEN, token);
  },

  getManualToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.MANUAL_TOKEN);
  },

  // Bot Config & State Persistence across offline/tab close
  saveBotConfig(config: any): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('deriv_bot_config', JSON.stringify(config));
  },

  getBotConfig(): any | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('deriv_bot_config');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  saveBotRunning(running: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('deriv_bot_running', running ? 'true' : 'false');
  },

  getBotRunning(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('deriv_bot_running') === 'true';
  },
};
