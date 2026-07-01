import { describe, it, expect } from 'vitest';
import { mulberry32, seededShuffle } from '../seededShuffle';

describe('seededShuffle', () => {
  it('should generate deterministic results for the same seed', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const seed = 'test-seed';
    
    const shuffle1 = seededShuffle(list, seed);
    const shuffle2 = seededShuffle(list, seed);
    
    expect(shuffle1).toEqual(shuffle2);
  });

  it('should generate different shuffles for different seeds', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffle1 = seededShuffle(list, 'seed-a');
    const shuffle2 = seededShuffle(list, 'seed-b');
    
    expect(shuffle1).not.toEqual(shuffle2);
  });

  it('should not mutate the original array', () => {
    const list = [1, 2, 3];
    const copy = [...list];
    
    seededShuffle(list, 'seed');
    expect(list).toEqual(copy);
  });

  it('should return empty array when input is empty', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
  });
});

describe('mulberry32', () => {
  it('should generate deterministic values between 0 and 1', () => {
    const rand1 = mulberry32('seed-abc');
    const rand2 = mulberry32('seed-abc');
    
    expect(rand1()).toBe(rand2());
    expect(rand1()).toBe(rand2());
    
    const val = rand1();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });
});
