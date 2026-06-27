import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useFocusRefresh } from '../useFocusRefresh';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A minimal component that exercises the hook
const HookHarness = ({ callback }: { callback: () => void }) => {
  useFocusRefresh(callback);
  return null;
};

describe('useFocusRefresh', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => { root!.unmount(); });
    document.body.removeChild(container!);
    vi.restoreAllMocks();
  });

  it('registers a focus event listener on mount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const callback = vi.fn();
    act(() => { root!.render(<HookHarness callback={callback} />); });
    expect(addSpy).toHaveBeenCalledWith('focus', expect.any(Function));
  });

  it('invokes the callback when the window focus event fires', () => {
    const callback = vi.fn();
    act(() => { root!.render(<HookHarness callback={callback} />); });
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('invokes callback again each time focus fires', () => {
    const callback = vi.fn();
    act(() => { root!.render(<HookHarness callback={callback} />); });
    act(() => { window.dispatchEvent(new Event('focus')); });
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('removes the focus event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const callback = vi.fn();
    act(() => { root!.render(<HookHarness callback={callback} />); });
    act(() => { root!.unmount(); });
    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    // Prevent afterEach from double-unmounting
    root = createRoot(document.createElement('div'));
  });

  it('does not invoke the callback after unmount', () => {
    const callback = vi.fn();
    act(() => { root!.render(<HookHarness callback={callback} />); });
    act(() => { root!.unmount(); });
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(callback).not.toHaveBeenCalled();
    // Prevent afterEach from double-unmounting
    root = createRoot(document.createElement('div'));
  });
});
