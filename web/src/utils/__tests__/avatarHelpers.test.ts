import { describe, it, expect } from 'vitest';
import { getInitials, getAvatarColor } from '../avatarHelpers';

describe('avatarHelpers', () => {
  describe('getInitials', () => {
    it('returns two initials for two-word names', () => {
      expect(getInitials('Premkumar Masilamani')).toBe('PM');
      expect(getInitials('Kalaiyarasi Masilamani')).toBe('KM');
      expect(getInitials('Aradhana Premkumar')).toBe('AP');
    });

    it('returns first and last initials for multi-word names', () => {
      expect(getInitials('John Michael Doe')).toBe('JD');
    });

    it('returns up to two letters for single-word names', () => {
      expect(getInitials('Premkumar')).toBe('PR');
      expect(getInitials('A')).toBe('A');
    });

    it('extracts initials from email addresses', () => {
      expect(getInitials('premkumar.masilamani.2020@gmail.com')).toBe('PM');
      expect(getInitials('aradhana@example.com')).toBe('AR');
    });

    it('handles empty, null, or undefined gracefully', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials(null)).toBe('?');
      expect(getInitials(undefined)).toBe('?');
    });
  });

  describe('getAvatarColor', () => {
    it('returns deterministic HSL color for the same input', () => {
      const color1 = getAvatarColor('Premkumar Masilamani');
      const color2 = getAvatarColor('Premkumar Masilamani');
      expect(color1).toBe(color2);
      expect(color1).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
    });

    it('returns default color for null or undefined', () => {
      const defaultColor = getAvatarColor(null);
      expect(defaultColor).toBeDefined();
      expect(defaultColor).toBe(getAvatarColor(undefined));
    });
  });
});
