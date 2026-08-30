/**
 * Local image caching service using browser CacheStorage API and in-memory Blob URLs.
 * Stores downloaded avatar images locally to avoid repeated network hits and handle
 * temporary network or CDN hiccups gracefully.
 */

const CACHE_NAME = 'pcn-avatars-v1';
const memoryCache = new Map<string, string>();
const inFlightRequests = new Map<string, Promise<string | null>>();

const isCacheSupported = (): boolean => {
  return typeof window !== 'undefined' && 'caches' in window;
};

/**
 * Returns the cached Blob URL if present in memory or CacheStorage.
 * Returns null if not cached yet.
 */
export const getCachedAvatar = async (url: string): Promise<string | null> => {
  if (!url) return null;

  // 1. Check in-memory cache first for instant synchronous resolution
  const memHit = memoryCache.get(url);
  if (memHit) return memHit;

  if (!isCacheSupported()) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse && cachedResponse.ok) {
      const blob = await cachedResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      memoryCache.set(url, blobUrl);
      return blobUrl;
    }
  } catch (e) {
    console.debug('Error reading avatar from cache:', e);
  }

  return null;
};

/**
 * Fetches and caches the avatar image locally, returning the Blob URL.
 */
export const fetchAndCacheAvatar = async (url: string): Promise<string | null> => {
  if (!url) return null;

  // Check if there's already an in-flight request for this URL to deduplicate
  const existingPromise = inFlightRequests.get(url);
  if (existingPromise) return existingPromise;

  const fetchPromise = (async (): Promise<string | null> => {
    // Check if already in cache
    const cached = await getCachedAvatar(url);
    if (cached) return cached;

    if (!isCacheSupported()) return url;

    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return null;

      const responseClone = response.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, responseClone);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      memoryCache.set(url, blobUrl);
      return blobUrl;
    } catch (err) {
      console.debug('Failed to fetch and cache avatar:', err);
      return null;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
};

/**
 * Clears the avatar memory and CacheStorage caches.
 */
export const clearAvatarCache = async (): Promise<void> => {
  memoryCache.forEach((blobUrl) => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Ignore
    }
  });
  memoryCache.clear();
  inFlightRequests.clear();

  if (isCacheSupported()) {
    try {
      await caches.delete(CACHE_NAME);
    } catch {
      // Ignore
    }
  }
};
