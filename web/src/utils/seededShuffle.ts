/**
 * A simple mulberry32 seedable pseudo-random number generator.
 * Generates a floating-point number between 0 (inclusive) and 1 (exclusive) for a given seed string.
 */
export const mulberry32 = (seedStr: string): () => number => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    const char = seedStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  let h = hash;
  return () => {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Deterministic Fisher-Yates shuffle using a seeded PRNG.
 */
export const seededShuffle = <T>(array: T[], seed: string): T[] => {
  const shuffled = [...array];
  const rand = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
