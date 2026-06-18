import { describe, it, expect } from 'vitest';
import { COUNTRIES } from '../countries';

describe('countries', () => {
  it('exports a list of countries', () => {
    expect(Array.isArray(COUNTRIES)).toBe(true);
    expect(COUNTRIES.length).toBeGreaterThan(0);
    expect(COUNTRIES).toContain('Afghanistan');
    expect(COUNTRIES).toContain('United States');
  });
});
