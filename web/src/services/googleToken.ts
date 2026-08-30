import { GOOGLE_TOKEN_LIFETIME_MS, GOOGLE_TOKEN_EXPIRY_BUFFER_MS } from '../config';

// In-memory holder for the Google OAuth access token.
//
// The token is deliberately NOT persisted to localStorage so it cannot be
// easily exfiltrated across sessions. It is stored in sessionStorage to survive
// page reloads within the same tab/session, and is automatically cleared when
// the tab/session ends or expires.

let googleAccessToken: string | null = null;
const EXPIRY_THRESHOLD_MS = GOOGLE_TOKEN_LIFETIME_MS - GOOGLE_TOKEN_EXPIRY_BUFFER_MS;

export const setGoogleToken = (token: string | null): void => {
  googleAccessToken = token;
  if (token) {
    sessionStorage.setItem('google_access_token', token);
    sessionStorage.setItem('google_token_obtained_at', Date.now().toString());
  } else {
    sessionStorage.removeItem('google_access_token');
    sessionStorage.removeItem('google_token_obtained_at');
  }
};

export const getGoogleToken = (): string | null => {
  if (googleAccessToken) {
    // Check if in-memory token is expired
    const obtainedAtStr = sessionStorage.getItem('google_token_obtained_at');
    if (obtainedAtStr) {
      const obtainedAt = parseInt(obtainedAtStr, 10);
      if (!isNaN(obtainedAt) && Date.now() - obtainedAt > EXPIRY_THRESHOLD_MS) {
        return null;
      }
    }
    return googleAccessToken;
  }

  // Fallback to sessionStorage
  const cachedToken = sessionStorage.getItem('google_access_token');
  const obtainedAtStr = sessionStorage.getItem('google_token_obtained_at');
  if (cachedToken && obtainedAtStr) {
    const obtainedAt = parseInt(obtainedAtStr, 10);
    if (!isNaN(obtainedAt)) {
      if (Date.now() - obtainedAt > EXPIRY_THRESHOLD_MS) {
        return null;
      }
      googleAccessToken = cachedToken;
      return googleAccessToken;
    }
  }

  return null;
};

export const clearGoogleToken = (): void => {
  googleAccessToken = null;
  sessionStorage.removeItem('google_access_token');
  sessionStorage.removeItem('google_token_obtained_at');
};

/**
 * Returns the remaining milliseconds before the Google token expires.
 * Returns 0 if token is expired, not set, or invalid.
 */
export const getGoogleTokenRemainingMs = (): number => {
  const token = sessionStorage.getItem('google_access_token') || googleAccessToken;
  const obtainedAtStr = sessionStorage.getItem('google_token_obtained_at');
  if (!token || !obtainedAtStr) {
    return 0;
  }
  const obtainedAt = parseInt(obtainedAtStr, 10);
  if (isNaN(obtainedAt)) {
    return 0;
  }
  const remaining = EXPIRY_THRESHOLD_MS - (Date.now() - obtainedAt);
  return remaining > 0 ? remaining : 0;
};

/**
 * Checks if the Google token is valid and active.
 */
export const isGoogleTokenValid = (): boolean => {
  return getGoogleToken() !== null;
};

// True only when a token was obtained in this session AND it has since crossed
// the expiry threshold. Used to decide whether to prompt or force a fresh Google OAuth
// re-authentication when the user touches Calendar features.
export const hasExpiredGoogleToken = (): boolean => {
  const token = sessionStorage.getItem('google_access_token');
  const obtainedAtStr = sessionStorage.getItem('google_token_obtained_at');
  if (!token || !obtainedAtStr) {
    return false;
  }
  const obtainedAt = parseInt(obtainedAtStr, 10);
  if (isNaN(obtainedAt)) {
    return false;
  }
  return Date.now() - obtainedAt > EXPIRY_THRESHOLD_MS;
};

