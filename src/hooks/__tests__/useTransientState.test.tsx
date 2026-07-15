import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useTransientState } from '../useTransientState';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let captured: {
  value: unknown;
  set: (next: unknown, resetAfterMs?: number) => void;
} | null = null;

const Harness = ({ defaultValue }: { defaultValue: unknown }) => {
  const [value, set] = useTransientState(defaultValue);
  useEffect(() => { captured = { value, set }; }, [value, set]);
  return null;
};

describe('useTransientState', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    captured = null;
  });

  afterEach(() => {
    act(() => { root!.unmount(); });
    document.body.removeChild(container!);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sets a value then auto-resets to the default after the delay', () => {
    act(() => { root!.render(<Harness defaultValue={''} />); });
    act(() => { captured!.set('saved', 2000); });
    expect(captured!.value).toBe('saved');

    act(() => { vi.advanceTimersByTime(1999); });
    expect(captured!.value).toBe('saved');

    act(() => { vi.advanceTimersByTime(1); });
    expect(captured!.value).toBe('');
  });

  it('a second set clears the prior timer so it cannot clobber the newer value', () => {
    act(() => { root!.render(<Harness defaultValue={null} />); });
    act(() => { captured!.set('first', 2000); });
    act(() => { vi.advanceTimersByTime(1500); });
    // Second action within the first timer's window.
    act(() => { captured!.set('second', 2000); });

    // The FIRST timer's original deadline passes — must NOT reset the value.
    act(() => { vi.advanceTimersByTime(500); });
    expect(captured!.value).toBe('second');

    // The SECOND timer completes its full 2000ms and resets.
    act(() => { vi.advanceTimersByTime(1500); });
    expect(captured!.value).toBe(null);
  });

  it('setting without a delay is persistent and cancels any pending reset', () => {
    act(() => { root!.render(<Harness defaultValue={''} />); });
    act(() => { captured!.set('temp', 2000); });
    act(() => { captured!.set('permanent'); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(captured!.value).toBe('permanent');
  });

  it('does not throw when its timer would fire after unmount', () => {
    act(() => { root!.render(<Harness defaultValue={''} />); });
    act(() => { captured!.set('bye', 2000); });
    act(() => { root!.unmount(); });
    // The pending timer was cleared on unmount; advancing must be a no-op.
    expect(() => { act(() => { vi.advanceTimersByTime(5000); }); }).not.toThrow();
    root = createRoot(document.createElement('div')); // avoid double-unmount in afterEach
  });
});
