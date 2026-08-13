import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setGoogleToken, getGoogleToken, clearGoogleToken, hasExpiredGoogleToken } from '../googleToken';

describe('googleToken service', () => {
  beforeEach(() => {
    // Clear token state before each test
    clearGoogleToken();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set and get the token correctly', () => {
    setGoogleToken('test-token');
    expect(getGoogleToken()).toBe('test-token');
    expect(sessionStorage.getItem('google_access_token')).toBe('test-token');
    expect(sessionStorage.getItem('google_token_obtained_at')).toBeDefined();
  });

  it('should return null when token is not set', () => {
    expect(getGoogleToken()).toBeNull();
  });

  it('should clear the token correctly', () => {
    setGoogleToken('test-token');
    clearGoogleToken();
    expect(getGoogleToken()).toBeNull();
    expect(sessionStorage.getItem('google_access_token')).toBeNull();
    expect(sessionStorage.getItem('google_token_obtained_at')).toBeNull();
  });

  it('should detect when token is expired', () => {
    setGoogleToken('test-token');
    expect(hasExpiredGoogleToken()).toBe(false);

    // Fast-forward time by 59 minutes (expiry safety margin is 58 minutes)
    vi.advanceTimersByTime(59 * 60 * 1000);

    expect(hasExpiredGoogleToken()).toBe(true);
    expect(getGoogleToken()).toBeNull();
  });

  it('should return null for getGoogleToken when stored token is expired', () => {
    setGoogleToken('test-token');
    expect(getGoogleToken()).toBe('test-token');

    // Manually modify sessionStorage obtained_at to be older than 58 mins
    const expiredTime = Date.now() - (60 * 60 * 1000);
    sessionStorage.setItem('google_token_obtained_at', expiredTime.toString());

    // Force fallback checks (clear in-memory cache to force reading from sessionStorage)
    clearGoogleToken();

    // Re-set in sessionStorage manually to simulate page reload scenario
    sessionStorage.setItem('google_access_token', 'test-token');
    sessionStorage.setItem('google_token_obtained_at', expiredTime.toString());

    expect(getGoogleToken()).toBeNull();
  });
});
