// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  setGoogleToken,
  getGoogleToken,
  clearGoogleToken,
  hasExpiredGoogleToken,
  getGoogleTokenRemainingMs,
  isGoogleTokenValid,
} from '../googleToken';
import { GOOGLE_TOKEN_LIFETIME_MS } from '../../config';

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
    expect(isGoogleTokenValid()).toBe(true);
    expect(getGoogleTokenRemainingMs()).toBeGreaterThan(0);
    expect(sessionStorage.getItem('google_access_token')).toBe('test-token');
    expect(sessionStorage.getItem('google_token_obtained_at')).toBeDefined();
  });

  it('should return null when token is not set', () => {
    expect(getGoogleToken()).toBeNull();
    expect(isGoogleTokenValid()).toBe(false);
    expect(getGoogleTokenRemainingMs()).toBe(0);
  });

  it('should clear the token correctly', () => {
    setGoogleToken('test-token');
    clearGoogleToken();
    expect(getGoogleToken()).toBeNull();
    expect(isGoogleTokenValid()).toBe(false);
    expect(sessionStorage.getItem('google_access_token')).toBeNull();
    expect(sessionStorage.getItem('google_token_obtained_at')).toBeNull();
  });

  it('should detect when token is expired based on lifetime buffer', () => {
    setGoogleToken('test-token');
    expect(hasExpiredGoogleToken()).toBe(false);
    expect(isGoogleTokenValid()).toBe(true);

    // Fast-forward time past token lifetime
    vi.advanceTimersByTime(GOOGLE_TOKEN_LIFETIME_MS);

    expect(hasExpiredGoogleToken()).toBe(true);
    expect(getGoogleToken()).toBeNull();
    expect(isGoogleTokenValid()).toBe(false);
    expect(getGoogleTokenRemainingMs()).toBe(0);
  });

  it('should return null for getGoogleToken when stored token is expired', () => {
    setGoogleToken('test-token');
    expect(getGoogleToken()).toBe('test-token');

    // Manually modify sessionStorage obtained_at to be older than token lifetime
    const expiredTime = Date.now() - (GOOGLE_TOKEN_LIFETIME_MS + 60000);
    sessionStorage.setItem('google_token_obtained_at', expiredTime.toString());

    // Force fallback checks (clear in-memory cache to force reading from sessionStorage)
    clearGoogleToken();

    // Re-set in sessionStorage manually to simulate page reload scenario
    sessionStorage.setItem('google_access_token', 'test-token');
    sessionStorage.setItem('google_token_obtained_at', expiredTime.toString());

    expect(getGoogleToken()).toBeNull();
    expect(isGoogleTokenValid()).toBe(false);
    expect(hasExpiredGoogleToken()).toBe(true);
  });
});

