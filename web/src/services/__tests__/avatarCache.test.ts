// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCachedAvatar, fetchAndCacheAvatar, clearAvatarCache } from '../avatarCache';

describe('avatarCache service', () => {
  beforeEach(async () => {
    await clearAvatarCache();
    vi.restoreAllMocks();
  });

  it('returns null for empty or missing URL', async () => {
    expect(await getCachedAvatar('')).toBeNull();
    expect(await fetchAndCacheAvatar('')).toBeNull();
  });

  it('fetches and caches avatar using Cache API when available', async () => {
    const mockBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const mockResponse = {
      ok: true,
      status: 200,
      clone: () => ({ ...mockResponse, blob: async () => mockBlob }),
      blob: async () => mockBlob,
    };

    const mockCache = {
      match: vi.fn().mockResolvedValue(mockResponse),
      put: vi.fn().mockResolvedValue(undefined),
    };

    const mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
      match: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
    };

    // @ts-expect-error Mock caches
    window.caches = mockCaches;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const testUrl = 'https://example.com/photo.png';
    const blobUrl = await fetchAndCacheAvatar(testUrl);

    expect(blobUrl).toBeDefined();
    expect(typeof blobUrl).toBe('string');
    expect(mockCaches.open).toHaveBeenCalledWith('pcn-avatars-v1');

    // Subsequent retrieval should hit cache
    const cachedHit = await getCachedAvatar(testUrl);
    expect(cachedHit).toBe(blobUrl);
  });
});
