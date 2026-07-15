import { GOOGLE_TOKEN_STATUS, type GoogleTokenStatus } from '../config';

// In-memory holder for the Google OAuth access token.
//
// The token is deliberately NOT persisted to localStorage so it cannot be
// easily exfiltrated across sessions. It is stored in sessionStorage to survive
// page reloads within the same tab/session, and is automatically cleared when
// the tab/session ends or expires.

let googleAccessToken: string | null = null;
const EXPIRY_THRESHOLD_MS = 3500 * 1000; // 58 minutes safety margin

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

export const getGoogleTokenExpiryStatus = (): GoogleTokenStatus => {
  const token = sessionStorage.getItem('google_access_token');
  const obtainedAtStr = sessionStorage.getItem('google_token_obtained_at');
  if (!token || !obtainedAtStr) {
    return GOOGLE_TOKEN_STATUS.DISCONNECTED;
  }
  const obtainedAt = parseInt(obtainedAtStr, 10);
  if (isNaN(obtainedAt)) {
    return GOOGLE_TOKEN_STATUS.DISCONNECTED;
  }
  if (Date.now() - obtainedAt > EXPIRY_THRESHOLD_MS) {
    return GOOGLE_TOKEN_STATUS.EXPIRED;
  }
  return GOOGLE_TOKEN_STATUS.CONNECTED;
};

