// Polling helpers for integration tests running against the Firebase Emulators.
//
// The emulator is strongly consistent per request, but the JS SDK propagates
// auth-token changes and snapshot updates asynchronously, and a cold-started
// emulator is measurably slower on its first operations. A single read taken
// immediately after a write (or immediately after a sign-in) therefore races
// those propagations. These helpers retry until a condition holds instead of
// asserting once against a fixed, too-short timeout.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_INTERVAL_MS = 100;

/**
 * Polls `check` until it returns a truthy value, then resolves with that value.
 * Rejects with a descriptive error once `timeoutMs` elapses — never silently
 * resolves a fallback, so a genuine failure surfaces as a failure.
 */
export async function waitFor<T>(
  check: () => Promise<T | undefined | null | false> | T | undefined | null | false,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    intervalMs = DEFAULT_INTERVAL_MS,
    description = 'condition',
  }: { timeoutMs?: number; intervalMs?: number; description?: string } = {}
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result as T;
    } catch (err) {
      // Swallow transient errors (e.g. permission-denied while a fresh auth
      // token is still propagating to Firestore) and retry until the deadline.
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const suffix = lastError ? ` Last error: ${String(lastError)}` : '';
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}.${suffix}`);
}
