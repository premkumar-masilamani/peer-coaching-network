import { useState, useEffect } from 'react';

/**
 * Returns a periodically-updating "current time" (ms since epoch).
 *
 * Classifying sessions as upcoming vs past against a timestamp captured once at
 * mount means a long-lived tab keeps showing ended sessions as upcoming/joinable.
 * This hook re-reads the clock every `intervalMs` and whenever the window regains
 * focus (so returning to a backgrounded tab re-classifies immediately). The timer
 * and listener are cleaned up on unmount.
 *
 * @param intervalMs How often to tick, in milliseconds (default 60s).
 */
export const useNow = (intervalMs = 60_000): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);

  return now;
};
