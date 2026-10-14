/**
 * PKCE Cryptographic Helpers for OAuth 2.0 PKCE Flow
 */

// Generate random string using Web Crypto API
export function generateRandomString(length: number = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(values);
  } else {
    // Fallback for Node.js / non-browser environments
    for (let i = 0; i < length; i++) {
      values[i] = Math.floor(Math.random() * 256);
    }
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

// Generate code verifier (standard PKCE: 43 to 128 characters)
export function generateCodeVerifier(length: number = 64): string {
  return generateRandomString(Math.min(128, Math.max(43, length)));
}

// Generate code challenge from verifier using SHA-256 and base64url encoding
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);

  let bytes: Uint8Array;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    bytes = new Uint8Array(digest);
  } else {
    // Fallback for environments without SubtleCrypto
    const { createHash } = await import('crypto');
    bytes = new Uint8Array(createHash('sha256').update(data).digest());
  }

  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Base64url encoding: replace '+' with '-', '/' with '_', and remove '='
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate state parameter for CSRF mitigation
export function generateState(length: number = 32): string {
  return generateRandomString(length);
}
