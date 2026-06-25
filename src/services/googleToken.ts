// In-memory holder for the Google OAuth access token.
//
// The token is deliberately NOT persisted to sessionStorage/localStorage so it
// cannot be exfiltrated by XSS or read by other scripts on the page. It lives
// only for the lifetime of the current page (lost on reload, re-acquired via a
// fresh sign-in).

let googleAccessToken: string | null = null;

export const setGoogleToken = (token: string | null): void => {
  googleAccessToken = token;
};

export const getGoogleToken = (): string | null => {
  return googleAccessToken;
};

export const clearGoogleToken = (): void => {
  googleAccessToken = null;
};
