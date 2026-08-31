import { describe, it, expect } from 'vitest';
import {
  getHour24,
  getLocalDateInTimezone,
  parseLocalTime,
  getUtcForLocalDateTime,
  getUtcForSlot,
  getTimezoneCode,
  isSlotAvailable,
} from '../timezoneHelpers';

describe('timezoneHelpers in @pcn/shared', () => {
  describe('getHour24', () => {
    it('converts 12-hour AM/PM parts correctly', () => {
      const amParts = [
        { type: 'hour', value: '9' },
        { type: 'dayPeriod', value: 'AM' },
      ] as Intl.DateTimeFormatPart[];
      expect(getHour24(amParts)).toBe(9);

      const pmParts = [
        { type: 'hour', value: '5' },
        { type: 'dayPeriod', value: 'PM' },
      ] as Intl.DateTimeFormatPart[];
      expect(getHour24(pmParts)).toBe(17);

      const noonParts = [
        { type: 'hour', value: '12' },
        { type: 'dayPeriod', value: 'PM' },
      ] as Intl.DateTimeFormatPart[];
      expect(getHour24(noonParts)).toBe(12);

      const midnightParts = [
        { type: 'hour', value: '12' },
        { type: 'dayPeriod', value: 'AM' },
      ] as Intl.DateTimeFormatPart[];
      expect(getHour24(midnightParts)).toBe(0);
    });
  });

  describe('getLocalDateInTimezone', () => {
    it('returns a Date matching the local day in the target timezone', () => {
      const utcDate = new Date('2026-06-01T00:00:00Z');
      const localDate = getLocalDateInTimezone(utcDate, 'America/New_York');
      expect(localDate).toBeInstanceOf(Date);
      expect(localDate.getFullYear()).toBe(2026);
      expect(localDate.getMonth()).toBe(4); // May (0-indexed)
      expect(localDate.getDate()).toBe(31);
    });
  });

  describe('parseLocalTime', () => {
    it('parses standard 12-hour formatted time strings', () => {
      expect(parseLocalTime('9:30 AM')).toEqual({ hour: 9, minute: 30 });
      expect(parseLocalTime('12:00 PM')).toEqual({ hour: 12, minute: 0 });
      expect(parseLocalTime('5:45 PM')).toEqual({ hour: 17, minute: 45 });
      expect(parseLocalTime('12:15 AM')).toEqual({ hour: 0, minute: 15 });
    });

    it('returns { hour: 0, minute: 0 } for invalid format strings', () => {
      expect(parseLocalTime('invalid time')).toEqual({ hour: 0, minute: 0 });
      expect(parseLocalTime('25:99')).toEqual({ hour: 0, minute: 0 });
    });
  });

  describe('getUtcForLocalDateTime', () => {
    it('computes exact UTC Date for year, month, day, hour, minute, and timezone', () => {
      const utcDate = getUtcForLocalDateTime(2026, 9, 1, 10, 0, 'UTC');
      expect(utcDate.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    });

    it('handles offset timezones correctly (e.g. Asia/Kolkata +05:30)', () => {
      const utcDate = getUtcForLocalDateTime(2026, 9, 1, 10, 0, 'Asia/Kolkata');
      expect(utcDate.toISOString()).toBe('2026-09-01T04:30:00.000Z');
    });
  });

  describe('getUtcForSlot', () => {
    it('computes UTC Date for a slot date and hour', () => {
      const d = new Date(2026, 8, 1);
      const slotUtc = getUtcForSlot(d, 14, 'UTC');
      expect(slotUtc.toISOString()).toBe('2026-09-01T14:00:00.000Z');
    });
  });

  describe('getTimezoneCode', () => {
    it('returns abbreviation or formatted offset for timezone', () => {
      const d = new Date('2026-06-01T12:00:00Z');
      const code = getTimezoneCode(d, 'UTC');
      expect(code).toBe('UTC');
    });
  });

  describe('isSlotAvailable', () => {
    const availableSlots = ['2026-09-01T10:00:00.000Z', '2026-09-01T10:30:00.000Z'];

    it('returns true if requested slot is covered by 30-minute intervals', () => {
      const slotStart = new Date('2026-09-01T10:00:00.000Z');
      const slotEnd = new Date('2026-09-01T11:00:00.000Z');
      expect(isSlotAvailable(availableSlots, slotStart, slotEnd)).toBe(true);
    });

    it('returns false if requested slot is outside available intervals', () => {
      const slotStart = new Date('2026-09-01T11:00:00.000Z');
      const slotEnd = new Date('2026-09-01T11:30:00.000Z');
      expect(isSlotAvailable(availableSlots, slotStart, slotEnd)).toBe(false);
    });

    it('returns false for empty available slots', () => {
      expect(isSlotAvailable([], new Date(), new Date())).toBe(false);
    });
  });
});
