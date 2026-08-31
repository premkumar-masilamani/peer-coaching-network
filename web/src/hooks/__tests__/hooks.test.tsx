// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useNow } from '../useNow';
import { useFocusRefresh } from '../useFocusRefresh';
import { useTransientState } from '../useTransientState';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TestHooksComponent = ({ onRefresh }: { onRefresh: () => void }) => {
  const now = useNow();
  useFocusRefresh(onRefresh);
  const [transientVal, setTransientVal] = useTransientState('initial');

  return (
    <div>
      <span id="now-time">{String(now)}</span>
      <span id="transient-val">{transientVal}</span>
      <button type="button" onClick={() => setTransientVal('temporary', 1000)}>
        Trigger Transient
      </button>
    </div>
  );
};

describe('Custom hooks', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.useRealTimers();
    container = null;
    root = null;
  });

  it('useTransientState reverts back to initial state after timeout', async () => {
    await act(async () => {
      root!.render(<TestHooksComponent onRefresh={mockRefresh} />);
    });

    expect(container?.querySelector('#transient-val')?.textContent).toBe('initial');

    const btn = container?.querySelector('button');
    await act(async () => {
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.querySelector('#transient-val')?.textContent).toBe('temporary');

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(container?.querySelector('#transient-val')?.textContent).toBe('initial');
  });

  it('useFocusRefresh triggers callback on window focus', async () => {
    await act(async () => {
      root!.render(<TestHooksComponent onRefresh={mockRefresh} />);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(mockRefresh).toHaveBeenCalled();
  });
});
