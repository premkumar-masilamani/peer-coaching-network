import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockLogger = vi.hoisted(() => ({ error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn() }));
vi.mock('../../utils/logger', () => ({ logger: mockLogger }));

import { ErrorBoundary } from '../ErrorBoundary';

const Boom = () => {
  throw new Error('kaboom');
};

describe('ErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // React logs caught errors to console.error; silence it for clean output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('renders children when nothing throws', () => {
    act(() => root.render(<ErrorBoundary><span>all good</span></ErrorBoundary>));

    expect(container.textContent).toContain('all good');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders the fallback UI and logs when a child throws', () => {
    act(() => root.render(<ErrorBoundary><Boom /></ErrorBoundary>));

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Something went wrong');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Uncaught render error:',
      expect.any(Error),
      expect.anything(),
    );
  });

  it('renders a custom fallback when provided', () => {
    act(() =>
      root.render(
        <ErrorBoundary fallback={<div>custom fallback</div>}>
          <Boom />
        </ErrorBoundary>,
      ),
    );

    expect(container.textContent).toContain('custom fallback');
    expect(container.textContent).not.toContain('Something went wrong');
  });
});
