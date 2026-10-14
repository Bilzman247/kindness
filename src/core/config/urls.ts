/**
 * Deriv Endpoints & Configuration
 */

export interface DerivConfig {
  appId: string;
  redirectUri: string;
  appName: string;
  showAppName: boolean;
  referralLink: string;
  oauthScopes: string;
  env: 'production' | 'staging';
}

// Read env variables safely in Node / Next.js (process.env)
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[key]) return process.env[key]!;
      if (process.env[`NEXT_PUBLIC_${key}`]) return process.env[`NEXT_PUBLIC_${key}`]!;
      if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`]!;
    }
  } catch (e) {
    // ignore
  }

  return defaultValue;
};

// Default redirect URI fallback: use current origin if available, otherwise https://g-squad.buzz
const getDefaultRedirectUri = (): string => {
  const envUri = getEnvVar('DERIV_REDIRECT_URI', '');
  if (envUri) return envUri;

  if (typeof window !== 'undefined' && window.location) {
    // If running on a domain that is not localhost or empty, use window.location.origin
    return window.location.origin;
  }
  return 'https://g-squad.buzz';
};

export const DERIV_CONFIG: DerivConfig = {
  appId: getEnvVar('DERIV_APP_ID', '33E1sj7WNaMsjg5MAxPyS'),
  redirectUri: getDefaultRedirectUri(),
  appName: getEnvVar('DERIV_APP_NAME', 'G-Squad'),
  showAppName: getEnvVar('DERIV_SHOW_APP_NAME', 'true') === 'true',
  referralLink: getEnvVar('DERIV_REFERRAL_LINK', 'https://t.deriv.link?t=AJAQ5SJZLES4'),
  oauthScopes: getEnvVar('DERIV_OAUTH_SCOPES', 'trade,account_manage'),
  env: (getEnvVar('DERIV_ENV', 'production') as 'production' | 'staging') || 'production',
};

export const DERIV_ENDPOINTS = {
  production: {
    oauth: 'https://oauth.deriv.com',
    api: 'https://api.deriv.com',
    ws: 'wss://ws.derivws.com/websockets/v3',
  },
  staging: {
    oauth: 'https://staging-oauth.deriv.com',
    api: 'https://staging-api.deriv.com',
    ws: 'wss://staging-ws.derivws.com/websockets/v3',
  },
};

export const getEndpoints = (env: 'production' | 'staging' = DERIV_CONFIG.env) => {
  return DERIV_ENDPOINTS[env] || DERIV_ENDPOINTS.production;
};
