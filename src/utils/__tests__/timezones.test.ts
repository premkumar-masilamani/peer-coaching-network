/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { COUNTRY_TIMEZONE_MAP, getFormattedTimezones, getTimezonesForCountry } from '../timezones';

describe('timezones', () => {
  it('exports a country timezone map record', () => {
    expect(COUNTRY_TIMEZONE_MAP).toBeTypeOf('object');
    expect(Object.keys(COUNTRY_TIMEZONE_MAP).length).toBeGreaterThan(0);
    expect(COUNTRY_TIMEZONE_MAP['Afghanistan']).toEqual([
      { value: 'Asia/Kabul', label: 'Asia/Kabul (GMT+4:30)' }
    ]);
  });

  describe('getFormattedTimezones', () => {
    it('returns a formatted list of all unique timezones', () => {
      const formatted = getFormattedTimezones();
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
      
      const first = formatted[0];
      expect(first).toHaveProperty('value');
      expect(first).toHaveProperty('label');
      expect(typeof first.value).toBe('string');
      expect(typeof first.label).toBe('string');
    });

    it('falls back to timezone names if formatToParts throws in internal getTimezoneCode', () => {
      const originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;
      Intl.DateTimeFormat.prototype.formatToParts = function() {
        throw new Error('mocked error');
      };
      try {
        const formatted = getFormattedTimezones();
        expect(formatted.length).toBeGreaterThan(0);
        // Under fallback, label should contain just timezone value without code or timezone value itself
        // e.g. "Asia/Kabul (Asia/Kabul)"
        const kab = formatted.find(f => f.value === 'Asia/Kabul');
        expect(kab?.label).toBe('Asia/Kabul (Asia/Kabul)');
      } finally {
        Intl.DateTimeFormat.prototype.formatToParts = originalFormatToParts;
      }
    });

    it('falls back to static timezone list if Intl.supportedValuesOf throws', () => {
      const originalSupportedValuesOf = Intl.supportedValuesOf;
      (Intl as any).supportedValuesOf = () => {
        throw new Error('not supported');
      };
      try {
        const formatted = getFormattedTimezones();
        expect(formatted.length).toBeGreaterThan(0);
        const values = formatted.map(f => f.value);
        expect(values).toContain('UTC');
        expect(values).toContain('America/New_York');
      } finally {
        Intl.supportedValuesOf = originalSupportedValuesOf;
      }
    });
  });

  describe('getTimezonesForCountry', () => {
    it('returns timezones for a specific country', () => {
      const tzs = getTimezonesForCountry('Afghanistan');
      expect(tzs).toEqual([
        { value: 'Asia/Kabul', label: 'Asia/Kabul (GMT+4:30)' }
      ]);
    });

    it('returns all formatted timezones if country is empty/null/undefined', () => {
      const all = getFormattedTimezones();
      expect(getTimezonesForCountry('')).toEqual(all);
      // @ts-expect-error - testing null country fallback input
      expect(getTimezonesForCountry(null)).toEqual(all);
    });

    it('returns all formatted timezones if country is not found in map', () => {
      const all = getFormattedTimezones();
      expect(getTimezonesForCountry('NonExistentCountry')).toEqual(all);
    });
  });
});
