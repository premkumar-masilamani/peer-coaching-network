// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ToastProvider, useToast } from '../ToastContext';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TestComponent = () => {
  const { showToast } = useToast();
  return (
    <div>
      <button type="button" onClick={() => showToast('Error occurred', 'error')}>
        Show Error
      </button>
      <button type="button" onClick={() => showToast('Saved successfully', 'success')}>
        Show Success
      </button>
    </div>
  );
};

describe('ToastContext', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  it('renders and auto-dismisses error toast after timeout', async () => {
    await act(async () => {
      root!.render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );
    });

    const errorBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Show Error')
    );

    await act(async () => {
      errorBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.textContent).toContain('Error occurred');
    expect(container?.querySelector('.pcn-toast--error')).not.toBeNull();

    // Fast-forward 6000ms
    act(() => {
      vi.advanceTimersByTime(6100);
    });

    expect(container?.querySelector('.pcn-toast--error')).toBeNull();
  });

  it('allows manual dismissal of toast by clicking close button', async () => {
    await act(async () => {
      root!.render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );
    });

    const successBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Show Success')
    );

    await act(async () => {
      successBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.textContent).toContain('Saved successfully');

    const closeBtn = container?.querySelector('.pcn-toast__close');
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.querySelector('.pcn-toast--success')).toBeNull();
  });
});
