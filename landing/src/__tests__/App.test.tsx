// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from '../App';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Landing App Routing', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.history.pushState({}, '', '/');
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
    container = null;
    root = null;
  });

  it('renders home page by default', async () => {
    await act(async () => {
      root!.render(<App />);
    });

    expect(container?.textContent).toContain('Peer Coaching Network');
    expect(container?.textContent).toContain('A Trusted Space for Coaches & Trainees to Practice and Grow');
  });

  it('navigates to privacy page on popstate or URL path /privacy', async () => {
    window.history.pushState({}, '', '/privacy');

    await act(async () => {
      root!.render(<App />);
    });

    expect(container?.textContent).toContain('Privacy Policy');
    expect(container?.textContent).toContain('Google API Services & Limited Use Disclosure');
  });

  it('navigates to terms page on URL path /terms', async () => {
    window.history.pushState({}, '', '/terms');

    await act(async () => {
      root!.render(<App />);
    });

    expect(container?.textContent).toContain('Terms of Service');
  });
});
