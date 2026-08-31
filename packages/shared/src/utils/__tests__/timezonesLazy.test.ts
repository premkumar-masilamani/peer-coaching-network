import { describe, it, expect } from 'vitest';
import { loadTimezonesForCountry } from '../timezonesLazy';

describe('timezonesLazy in @pcn/shared', () => {
  it('loads timezone list for a recognized country (e.g. India)', async () => {
    const tzList = await loadTimezonesForCountry('India');
    expect(tzList.length).toBeGreaterThan(0);
    expect(tzList.some((t) => t.value === 'Asia/Kolkata')).toBe(true);
  });

  it('falls back to all timezones when country is empty or not found', async () => {
    const tzList = await loadTimezonesForCountry('Unknown Country XYZ');
    expect(tzList.length).toBeGreaterThan(50);
  });
});
