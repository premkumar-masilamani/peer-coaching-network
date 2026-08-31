// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorBoundary } from '../ErrorBoundary';
import { USER_MESSAGES } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ThrowingComponent = () => {
  throw new Error('Test render explosion');
};

describe('ErrorBoundary', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    vi.restoreAllMocks();
    container = null;
    root = null;
  });

  it('renders children when no error occurs', async () => {
    await act(async () => {
      root!.render(
        <ErrorBoundary>
          <div>Safe Content</div>
        </ErrorBoundary>
      );
    });

    expect(container?.textContent).toContain('Safe Content');
  });

  it('renders fallback error UI when child throws error', async () => {
    await act(async () => {
      root!.render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
    });

    expect(container?.textContent).toContain(USER_MESSAGES.SYSTEM.SOMETHING_WENT_WRONG);
    expect(container?.textContent).toContain(USER_MESSAGES.SYSTEM.RELOAD_BUTTON);
  });
});
