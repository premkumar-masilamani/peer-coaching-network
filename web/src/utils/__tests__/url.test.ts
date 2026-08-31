// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeHttpsUrl,
  sanitizeMeetLink,
  sanitizeImageUrl,
  navigateToProfile,
  clearProfileFromUrl,
} from '../url';

describe('url utils', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  describe('sanitizeHttpsUrl', () => {
    it('accepts valid https URLs', () => {
      expect(sanitizeHttpsUrl('https://example.com/path')).toBe('https://example.com/path');
    });

    it('rejects http or javascript: protocol URLs', () => {
      expect(sanitizeHttpsUrl('http://insecure.com')).toBeUndefined();
      expect(sanitizeHttpsUrl('javascript:alert(1)')).toBeUndefined();
      expect(sanitizeHttpsUrl(null)).toBeUndefined();
    });
  });

  describe('sanitizeMeetLink', () => {
    it('accepts meet.google.com links', () => {
      expect(sanitizeMeetLink('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('rejects other hosts', () => {
      expect(sanitizeMeetLink('https://malicious-site.com/fake-meet')).toBeUndefined();
      expect(sanitizeMeetLink('https://zoom.us/j/123456')).toBeUndefined();
    });
  });

  describe('sanitizeImageUrl', () => {
    it('returns valid https URL or fallback', () => {
      expect(sanitizeImageUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
      expect(sanitizeImageUrl('http://insecure.com/photo.jpg')).toBe('https://api.dicebear.com/7.x/bottts/svg');
      expect(sanitizeImageUrl(null, 'custom-fallback')).toBe('custom-fallback');
    });
  });

  describe('navigateToProfile & clearProfileFromUrl', () => {
    it('updates URL search parameters and dispatches popstate', () => {
      const popListener = vi.fn();
      window.addEventListener('popstate', popListener);

      navigateToProfile('user-456');
      expect(window.location.search).toContain('profile=user-456');
      expect(popListener).toHaveBeenCalled();

      clearProfileFromUrl();
      expect(window.location.search).not.toContain('profile=user-456');
      expect(popListener).toHaveBeenCalledTimes(2);

      window.removeEventListener('popstate', popListener);
    });
  });
});
