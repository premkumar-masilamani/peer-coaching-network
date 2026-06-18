/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { sanitizeHttpsUrl, sanitizeMeetLink, sanitizeImageUrl } from '../url';

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
      } as any;
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
      } as any;
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
});
