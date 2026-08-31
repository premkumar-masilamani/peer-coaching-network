import { describe, it, expect } from 'vitest';
import { mulberry32, seededShuffle } from '../seededShuffle';

describe('seededShuffle', () => {
  it('produces identical output for identical seeds', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const shuffle1 = seededShuffle(list, 'fixed-seed-123');
    const shuffle2 = seededShuffle(list, 'fixed-seed-123');
    expect(shuffle1).toEqual(shuffle2);
  });

  it('produces different permutations for different seeds', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffle1 = seededShuffle(list, 'seed-A');
    const shuffle2 = seededShuffle(list, 'seed-B');
    expect(shuffle1).not.toEqual(shuffle2);
  });

  it('handles empty and single-element arrays', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
    expect(seededShuffle(['single'], 'seed')).toEqual(['single']);
  });

  it('mulberry32 returns deterministic pseudorandom numbers in [0, 1)', () => {
    const rand = mulberry32('seed-abc');
    const n1 = rand();
    const n2 = rand();
    expect(n1).toBeGreaterThanOrEqual(0);
    expect(n1).toBeLessThan(1);
    expect(n2).toBeGreaterThanOrEqual(0);
    expect(n2).toBeLessThan(1);
  });
});
