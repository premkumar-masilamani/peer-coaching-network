import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  setGoogleToken,
  getGoogleToken,
  clearGoogleToken,
  hasExpiredGoogleToken
} from '../googleToken';

describe('googleToken manager', () => {
  beforeEach(() => {
    clearGoogleToken();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('correctly sets and gets the token', () => {
    expect(getGoogleToken()).toBeNull();
    setGoogleToken('test-token');
    expect(getGoogleToken()).toBe('test-token');
  });

  it('correctly clears the token', () => {
    setGoogleToken('test-token');
    expect(getGoogleToken()).toBe('test-token');
    clearGoogleToken();
    expect(getGoogleToken()).toBeNull();
  });

  it('handles null token setting', () => {
    setGoogleToken('test-token');
    setGoogleToken(null);
    expect(getGoogleToken()).toBeNull();
  });

  it('restores from sessionStorage cache on page reload (losing in-memory token)', () => {
    // Clear in-memory token (this also clears sessionStorage, which is fine as we write to it next)
    clearGoogleToken();
    
    // Simulate page reload by setting cached keys in sessionStorage
    sessionStorage.setItem('google_access_token', 'cached-token');
    sessionStorage.setItem('google_token_obtained_at', Date.now().toString());

    // We expect getGoogleToken to restore it
    expect(getGoogleToken()).toBe('cached-token');
  });

  it('detects token expiry after 3500 seconds (safety margin threshold)', () => {
    setGoogleToken('test-token');
    expect(getGoogleToken()).toBe('test-token');

    // Advance time by 3499 seconds - should still be valid
    vi.advanceTimersByTime(3499 * 1000);
    expect(getGoogleToken()).toBe('test-token');
    expect(hasExpiredGoogleToken()).toBe(false);

    // Advance by 2 more seconds (total 3501 seconds) - should be expired
    vi.advanceTimersByTime(2 * 1000);
    expect(hasExpiredGoogleToken()).toBe(true);
    expect(getGoogleToken()).toBeNull();
  });

  it('hasExpiredGoogleToken is false when no token has ever been set', () => {
    expect(hasExpiredGoogleToken()).toBe(false);
  });

  it('hasExpiredGoogleToken is false right after a token is obtained', () => {
    setGoogleToken('test-token');
    expect(hasExpiredGoogleToken()).toBe(false);
  });

  it('hasExpiredGoogleToken stays false after the token is cleared', () => {
    setGoogleToken('test-token');
    vi.advanceTimersByTime(3600 * 1000);
    clearGoogleToken();
    // No obtained-at marker remains, so no forced-reauth redirect is triggered.
    expect(hasExpiredGoogleToken()).toBe(false);
  });
});

