import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * State that can auto-reset to a default value after a delay, with the pending
 * timer safely managed.
 *
 * Motivation: "clear this message after N seconds" timers were created with bare
 * `setTimeout` and never stored/cleared. They fired after unmount (a setState
 * no-op that also retains the closure until the timer fires) and, on rapid repeat
 * actions, an earlier timer could clobber a later action's freshly-set value.
 *
 * The returned setter stores the timeout id in a ref, clears any prior timer
 * before scheduling a new one, and the hook clears the timer on unmount. Call the
 * setter with a `resetAfterMs` to auto-reset, or without one to set a persistent
 * value (e.g. an error that stays until the next action) while still cancelling
 * any in-flight reset.
 *
 * @param defaultValue The value to reset back to (use a stable primitive/ref).
 */
export function useTransientState<T>(
  defaultValue: T
): [T, (next: T, resetAfterMs?: number) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clear any pending timer when the component using this state unmounts.
  useEffect(() => clearTimer, [clearTimer]);

  const set = useCallback(
    (next: T, resetAfterMs?: number) => {
      clearTimer();
      setValue(next);
      if (resetAfterMs !== undefined) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setValue(defaultValue);
        }, resetAfterMs);
      }
    },
    [clearTimer, defaultValue]
  );

  return [value, set];
}
