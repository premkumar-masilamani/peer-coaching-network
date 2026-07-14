import { describe, it, expect, vi } from 'vitest';
import { sanitizeHttpsUrl, sanitizeMeetLink, sanitizeImageUrl, navigateToProfile, clearProfileFromUrl } from '../url';

describe('url', () => {
  describe('sanitizeHttpsUrl', () => {
    it('returns undefined if url is missing, null, or empty', () => {
      expect(sanitizeHttpsUrl()).toBeUndefined();
      expect(sanitizeHttpsUrl(null)).toBeUndefined();
      expect(sanitizeHttpsUrl('')).toBeUndefined();
    });

    it('returns the URL if it is a valid https URL', () => {
      expect(sanitizeHttpsUrl('https://example.com/foo')).toBe('https://example.com/foo');
      expect(sanitizeHttpsUrl('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('returns undefined if protocol is not https', () => {
      expect(sanitizeHttpsUrl('http://example.com/foo')).toBeUndefined();
      expect(sanitizeHttpsUrl('ftp://example.com')).toBeUndefined();
      expect(sanitizeHttpsUrl('javascript:alert(1)')).toBeUndefined();
    });

    it('returns undefined for malformed URL strings', () => {
      expect(sanitizeHttpsUrl(':::')).toBeUndefined();
    });

    it('returns undefined if URL constructor throws an error', () => {
      const originalURL = globalThis.URL;
      // Force URL to throw on any instantiation
      globalThis.URL = function() {
        throw new Error('mocked error');
      } as unknown as typeof URL;
      try {
        expect(sanitizeHttpsUrl('https://example.com')).toBeUndefined();
      } finally {
        globalThis.URL = originalURL;
      }
    });
  });

  describe('sanitizeMeetLink', () => {
    it('returns undefined if link is missing, null, or empty', () => {
      expect(sanitizeMeetLink()).toBeUndefined();
      expect(sanitizeMeetLink(null)).toBeUndefined();
      expect(sanitizeMeetLink('')).toBeUndefined();
    });

    it('returns the URL if it is a valid https Google Meet link', () => {
      expect(sanitizeMeetLink('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
      expect(sanitizeMeetLink('https://meet.google.com/abc-defg-hij?authuser=0')).toBe('https://meet.google.com/abc-defg-hij?authuser=0');
    });

    it('returns undefined if hostname is not meet.google.com', () => {
      expect(sanitizeMeetLink('https://google.com/abc-defg-hij')).toBeUndefined();
      expect(sanitizeMeetLink('https://meet.google.com.attacker.com/abc')).toBeUndefined();
    });

    it('returns undefined if protocol is not https', () => {
      expect(sanitizeMeetLink('http://meet.google.com/abc-defg-hij')).toBeUndefined();
    });

    it('returns undefined for malformed URL strings', () => {
      expect(sanitizeMeetLink(':::')).toBeUndefined();
    });

    it('returns undefined if URL constructor throws an error in sanitizeMeetLink', () => {
      const originalURL = globalThis.URL;
      let count = 0;
      globalThis.URL = function(u: string, base?: string) {
        count++;
        if (count > 1) {
          throw new Error('mocked error');
        }
        return new originalURL(u, base);
      } as unknown as typeof URL;
      try {
        expect(sanitizeMeetLink('https://meet.google.com/abc-defg-hij')).toBeUndefined();
      } finally {
        globalThis.URL = originalURL;
      }
    });
  });

  describe('sanitizeImageUrl', () => {
    it('returns fallback if url is missing, null, or invalid', () => {
      expect(sanitizeImageUrl()).toBe('https://api.dicebear.com/7.x/bottts/svg');
      expect(sanitizeImageUrl(null)).toBe('https://api.dicebear.com/7.x/bottts/svg');
      expect(sanitizeImageUrl('')).toBe('https://api.dicebear.com/7.x/bottts/svg');
      expect(sanitizeImageUrl('http://example.com/img.png')).toBe('https://api.dicebear.com/7.x/bottts/svg');
    });

    it('returns target URL if valid https', () => {
      expect(sanitizeImageUrl('https://example.com/img.png')).toBe('https://example.com/img.png');
    });

    it('uses custom fallback if provided and target is invalid', () => {
      expect(sanitizeImageUrl('http://example.com/img.png', 'https://fallback.com/custom.png')).toBe('https://fallback.com/custom.png');
    });
  });

  describe('profile navigation', () => {

    it('navigateToProfile sets query param, calls pushState, and dispatches popstate event', () => {
      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      navigateToProfile('user-123');

      expect(pushStateSpy).toHaveBeenCalled();
      const pushCall = pushStateSpy.mock.calls[0];
      expect(pushCall[2]).toContain('profile=user-123');

      expect(dispatchSpy).toHaveBeenCalled();
      const event = dispatchSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(PopStateEvent);
      expect(event.type).toBe('popstate');

      pushStateSpy.mockRestore();
      dispatchSpy.mockRestore();
    });

    it('clearProfileFromUrl deletes query param and dispatches popstate if profile was set', () => {
      const originalUrl = window.location.href;
      // Set the query parameter manually first
      const url = new URL(window.location.href);
      url.searchParams.set('profile', 'user-123');
      window.history.pushState({}, '', url.toString());

      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      clearProfileFromUrl();

      expect(pushStateSpy).toHaveBeenCalled();
      const pushCall = pushStateSpy.mock.calls[0];
      expect(pushCall[2]).not.toContain('profile=');

      expect(dispatchSpy).toHaveBeenCalled();
      const event = dispatchSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(PopStateEvent);
      expect(event.type).toBe('popstate');

      pushStateSpy.mockRestore();
      dispatchSpy.mockRestore();

      // Reset URL back to original
      window.history.pushState({}, '', originalUrl);
    });

    it('clearProfileFromUrl does nothing if profile was not set', () => {
      const originalUrl = window.location.href;
      const url = new URL(window.location.href);
      url.searchParams.delete('profile');
      window.history.pushState({}, '', url.toString());

      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      clearProfileFromUrl();

      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalled();

      pushStateSpy.mockRestore();
      dispatchSpy.mockRestore();

      window.history.pushState({}, '', originalUrl);
    });
  });
});
