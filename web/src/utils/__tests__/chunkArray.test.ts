import { describe, it, expect } from 'vitest';
import { chunkArray } from '../chunkArray';

describe('chunkArray', () => {
  it('splits array into even chunks', () => {
    const list = [1, 2, 3, 4, 5, 6];
    expect(chunkArray(list, 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it('handles remainder chunk properly', () => {
    const list = [1, 2, 3, 4, 5];
    expect(chunkArray(list, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns empty array when input is empty', () => {
    expect(chunkArray([], 10)).toEqual([]);
  });

  it('handles chunk size larger than array length', () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
  });
});
