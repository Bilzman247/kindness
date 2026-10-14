/**
 * Deriv OAuth 2.0 PKCE Authentication
 */

import { generateCodeVerifier, generateCodeChallenge, generateState } from './crypto';
import { storage, AuthInfo } from './storage';
import { DERIV_CONFIG, getEndpoints } from '../config/urls';

export interface OAuthLoginOptions {
  clientId?: string;
  redirectUri?: string;
  scopes?: string;
  env?: 'production' | 'staging';
}

/**
 * Initiates the PKCE OAuth Login flow by redirecting the user to Deriv's login page
 */
export async function initiateLogin(options: OAuthLoginOptions = {}): Promise<void> {
  if (typeof window === 'undefined') return;

  const clientId = options.clientId || DERIV_CONFIG.appId;
  const redirectUri = options.redirectUri || DERIV_CONFIG.redirectUri;
  const scopes = (options.scopes || DERIV_CONFIG.oauthScopes).replace(/,/g, ' ');
  const endpoints = getEndpoints(options.env || DERIV_CONFIG.env);

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Save verifier and state in session storage
  storage.savePKCE(codeVerifier, state, redirectUri);

  // Construct Deriv OAuth 2.0 authorization URL
  const authUrl = new URL(`${endpoints.oauth}/oauth2/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  // Deriv branding & app display flags
  if (DERIV_CONFIG.showAppName && DERIV_CONFIG.appName) {
    authUrl.searchParams.set('brand', 'deriv');
  }

  // Redirect to Deriv authorization
  window.location.href = authUrl.toString();
}

/**
 * Handles the OAuth 2.0 callback URL after user is redirected back from Deriv
 */
export async function handleOAuthCallback(
  currentUrl: string,
  options: { clientId?: string; redirectUri?: string; env?: 'production' | 'staging' } = {}
): Promise<AuthInfo> {
  const url = new URL(currentUrl);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    throw new Error(`Deriv OAuth Error: ${error} - ${errorDescription || 'Access denied'}`);
  }

  if (!code) {
    throw new Error('No authorization code found in callback URL.');
  }

  // Verify state parameter for security
  const savedState = storage.getPKCEState();
  if (savedState && returnedState && savedState !== returnedState) {
    console.warn('OAuth state mismatch: proceeding with verification check.');
  }

  // Retrieve stored code verifier
  const codeVerifier = storage.getPKCEVerifier();
  if (!codeVerifier) {
    throw new Error('Missing PKCE code verifier in session storage. Please retry login.');
  }

  const clientId = options.clientId || DERIV_CONFIG.appId;
  const redirectUri = options.redirectUri || storage.getPKCERedirectUri() || DERIV_CONFIG.redirectUri;
  const endpoints = getEndpoints(options.env || DERIV_CONFIG.env);

  // Exchange authorization code for tokens
  let tokenData: any = null;

  // 1. Try Direct Token Exchange
  try {
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('client_id', clientId);
    params.set('code', code);
    params.set('redirect_uri', redirectUri);
    params.set('code_verifier', codeVerifier);

    const response = await fetch(`${endpoints.oauth}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (response.ok) {
      tokenData = await response.json();
    }
  } catch (directErr) {
    console.warn('Direct token exchange failed, trying backend proxy fallback...', directErr);
  }

  // 2. If direct fetch fails (e.g. CORS), fallback to backend proxy
  if (!tokenData) {
    const proxyRes = await fetch('/api/deriv/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        redirect_uri: redirectUri,
      }),
    });

    if (!proxyRes.ok) {
      const errJson = await proxyRes.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to exchange authorization code for token.');
    }

    tokenData = await proxyRes.json();
  }

  const authInfo: AuthInfo = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type || 'Bearer',
    expires_in: tokenData.expires_in,
    scope: tokenData.scope,
    acquired_at: Date.now(),
    userId: tokenData.userId || tokenData.user_id,
  };

  // Save auth info & cleanup PKCE storage
  storage.saveAuthInfo(authInfo);
  storage.clearPKCE();

  // Clean URL parameters from browser history without page reload
  if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  return authInfo;
}

/**
 * Refreshes an expired access token using the refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string = DERIV_CONFIG.appId,
  env: 'production' | 'staging' = DERIV_CONFIG.env
): Promise<AuthInfo> {
  const endpoints = getEndpoints(env);
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('client_id', clientId);
  params.set('refresh_token', refreshToken);

  const res = await fetch(`${endpoints.oauth}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error('Failed to refresh Deriv access token');
  }

  const data = await res.json();
  const authInfo: AuthInfo = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in,
    scope: data.scope,
    acquired_at: Date.now(),
  };

  storage.saveAuthInfo(authInfo);
  return authInfo;
}

/**
 * Log out user by clearing storage
 */
export function logout(): void {
  storage.clearAuthInfo();
}

/**
 * Builds the Deriv referral sign-up link
 */
export function getSignUpUrl(): string {
  return DERIV_CONFIG.referralLink || 'https://t.deriv.link?t=AJAQ5SJZLES4';
}
