import { describe, it, expect } from 'vitest';
import { chunkArray } from '../arrayUtils';

describe('arrayUtils - chunkArray', () => {
  it('splits an array into chunks of the specified size', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = chunkArray(input, 3);
    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]);
  });

  it('handles remainder chunks correctly', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = chunkArray(input, 3);
    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8]
    ]);
  });

  it('returns empty array when input is empty', () => {
    const result = chunkArray([], 5);
    expect(result).toEqual([]);
  });

  it('returns whole array as a single chunk if size is larger than length', () => {
    const input = [1, 2, 3];
    const result = chunkArray(input, 5);
    expect(result).toEqual([[1, 2, 3]]);
  });
});
