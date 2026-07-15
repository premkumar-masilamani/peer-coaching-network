import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useNow } from '../useNow';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let capturedNow = 0;
const Harness = ({ intervalMs }: { intervalMs?: number }) => {
  const now = useNow(intervalMs);
  useEffect(() => { capturedNow = now; }, [now]);
  return null;
};

describe('useNow', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root!.unmount(); });
    document.body.removeChild(container!);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the current time and advances on each interval tick', () => {
    const base = Date.parse('2030-01-01T00:00:00.000Z');
    act(() => { root!.render(<Harness intervalMs={1000} />); });
    expect(capturedNow).toBe(base);

    // advanceTimersByTime moves the fake clock, so Date.now() inside the tick
    // reflects it; one interval fires per 1000ms.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(capturedNow).toBe(base + 1000);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(capturedNow).toBe(base + 2000);
  });

  it('refreshes on window focus', () => {
    act(() => { root!.render(<Harness intervalMs={60000} />); });
    act(() => { vi.setSystemTime(new Date('2030-01-01T00:10:00.000Z')); window.dispatchEvent(new Event('focus')); });
    expect(capturedNow).toBe(Date.parse('2030-01-01T00:10:00.000Z'));
  });

  it('clears its interval and focus listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    act(() => { root!.render(<Harness intervalMs={1000} />); });
    act(() => { root!.unmount(); });
    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    const frozen = capturedNow;
    // No further updates after unmount.
    act(() => { vi.setSystemTime(new Date('2030-01-01T01:00:00.000Z')); vi.advanceTimersByTime(5000); });
    expect(capturedNow).toBe(frozen);
    root = createRoot(document.createElement('div')); // avoid double-unmount in afterEach
  });
});
