import { describe, it, expect } from 'vitest';
import {
  getHour24,
  getLocalDateInTimezone,
  parseLocalTime,
  getUtcForLocalDateTime,
  getUtcForSlot,
  getTimezoneCode
} from '../timezoneHelpers';

describe('timezoneHelpers', () => {
  describe('getHour24', () => {
    it('handles AM / PM correctly', () => {
      const partsPM: Intl.DateTimeFormatPart[] = [
        { type: 'hour', value: '2' },
        { type: 'dayPeriod', value: 'PM' }
      ];
      expect(getHour24(partsPM)).toBe(14);

      const partsAM: Intl.DateTimeFormatPart[] = [
        { type: 'hour', value: '12' },
        { type: 'dayPeriod', value: 'AM' }
      ];
      expect(getHour24(partsAM)).toBe(0);

      const partsAMNormal: Intl.DateTimeFormatPart[] = [
        { type: 'hour', value: '8' },
        { type: 'dayPeriod', value: 'AM' }
      ];
      expect(getHour24(partsAMNormal)).toBe(8);

      const partsPM12: Intl.DateTimeFormatPart[] = [
        { type: 'hour', value: '12' },
        { type: 'dayPeriod', value: 'PM' }
      ];
      expect(getHour24(partsPM12)).toBe(12);
    });
  });

  describe('getLocalDateInTimezone', () => {
    it('returns correct local date for timezones', () => {
      const date = new Date(Date.UTC(2026, 5, 18, 2, 0, 0)); // UTC 2026-06-18 02:00
      // In New York (UTC-4), it is still 2026-06-17 22:00
      const nyDate = getLocalDateInTimezone(date, 'America/New_York');
      expect(nyDate.getFullYear()).toBe(2026);
      expect(nyDate.getMonth()).toBe(5); // 0-indexed, so 5 is June
      expect(nyDate.getDate()).toBe(17);

      // In Tokyo (UTC+9), it is 2026-06-18 11:00
      const tokyoDate = getLocalDateInTimezone(date, 'Asia/Tokyo');
      expect(tokyoDate.getFullYear()).toBe(2026);
      expect(tokyoDate.getMonth()).toBe(5);
      expect(tokyoDate.getDate()).toBe(18);
    });
  });

  describe('parseLocalTime', () => {
    it('parses AM/PM formats correctly', () => {
      expect(parseLocalTime('10:30 AM')).toEqual({ hour: 10, minute: 30 });
      expect(parseLocalTime('12:15 PM')).toEqual({ hour: 12, minute: 15 });
      expect(parseLocalTime('12:00 AM')).toEqual({ hour: 0, minute: 0 });
      expect(parseLocalTime('11:59 PM')).toEqual({ hour: 23, minute: 59 });
    });

    it('parses 24h formats correctly', () => {
      expect(parseLocalTime('14:30')).toEqual({ hour: 14, minute: 30 });
      expect(parseLocalTime('08:05')).toEqual({ hour: 8, minute: 5 });
      expect(parseLocalTime('00:00')).toEqual({ hour: 0, minute: 0 });
    });

    it('returns 0:0 for invalid times', () => {
      expect(parseLocalTime('invalid')).toEqual({ hour: 0, minute: 0 });
      expect(parseLocalTime('25:00')).toEqual({ hour: 0, minute: 0 });
      expect(parseLocalTime('10:60')).toEqual({ hour: 0, minute: 0 });
      expect(parseLocalTime('13:00 AM')).toEqual({ hour: 0, minute: 0 });
    });
  });

  describe('getUtcForLocalDateTime', () => {
    it('converts local time to UTC correctly', () => {
      // 10:00 AM in America/New_York (EST, UTC-5)
      // 2026-01-18T10:00:00 America/New_York -> 2026-01-18T15:00:00Z
      const utcDate = getUtcForLocalDateTime(2026, 1, 18, 10, 0, 'America/New_York');
      expect(utcDate.getUTCHours()).toBe(15);
      expect(utcDate.getUTCMinutes()).toBe(0);
      expect(utcDate.getUTCDate()).toBe(18);
    });

    it('handles DST transition correctly', () => {
      // 10:00 AM in America/New_York during DST (EDT, UTC-4)
      // 2026-06-18T10:00:00 America/New_York -> 2026-06-18T14:00:00Z
      const utcDate = getUtcForLocalDateTime(2026, 6, 18, 10, 0, 'America/New_York');
      expect(utcDate.getUTCHours()).toBe(14);
      expect(utcDate.getUTCMinutes()).toBe(0);
      expect(utcDate.getUTCDate()).toBe(18);
    });
  });

  describe('getUtcForSlot', () => {
    it('calculates UTC Date for active date and slot hour', () => {
      const baseDate = new Date(2026, 5, 18);
      const slotUtc = getUtcForSlot(baseDate, 10, 'Asia/Kolkata'); // UTC+5:30
      // 2026-06-18 10:00 in Asia/Kolkata -> 2026-06-18 04:30 UTC
      expect(slotUtc.getUTCHours()).toBe(4);
      expect(slotUtc.getUTCMinutes()).toBe(30);
    });
  });

  describe('getTimezoneCode', () => {
    it('returns time zone abbreviation or timeZone ID', () => {
      const date = new Date(2026, 5, 18);
      const code = getTimezoneCode(date, 'America/New_York');
      // In summer, EDT or EST depending on node runtime representation, typically "EDT"
      expect(['EDT', 'EST', 'America/New_York']).toContain(code);

      // Invalid timezone should fall back to timezone name
      expect(getTimezoneCode(date, 'Invalid/Tz')).toBe('Invalid/Tz');
    });

    it('falls back to timeZone ID if timeZoneName part is not found in parts', () => {
      const date = new Date(2026, 5, 18);
      const originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
      Intl.DateTimeFormat.prototype.formatToParts = function() {
        return [{ type: 'literal', value: 'foo' }];
      };
      try {
        expect(getTimezoneCode(date, 'America/New_York')).toBe('America/New_York');
      } finally {
        Intl.DateTimeFormat.prototype.formatToParts = originalFormatToParts;
      }
    });
  });
});
