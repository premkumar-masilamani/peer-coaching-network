import { describe, it, expect, beforeEach } from 'vitest';
import {
  setGoogleToken,
  getGoogleToken,
  clearGoogleToken
} from '../googleToken';

describe('googleToken manager', () => {
  beforeEach(() => {
    clearGoogleToken();
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
});
