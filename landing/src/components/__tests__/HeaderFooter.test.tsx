// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Header } from '../Header';
import { Footer } from '../Footer';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Landing Header and Footer', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockNavigate = vi.fn();

  beforeEach(() => {
    window.scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
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

  describe('Header', () => {
    it('renders logo and navigation links', async () => {
      await act(async () => {
        root!.render(<Header currentPath="/" onNavigate={mockNavigate} />);
      });

      expect(container?.textContent).toContain('Peer Coaching Network');
      expect(container?.textContent).toContain('How It Works');
      expect(container?.textContent).toContain('Launch App');

      // Click brand logo to navigate home
      const brandBtn = container?.querySelector('button');
      await act(async () => {
        brandBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('handles section scroll navigation when not on home path', async () => {
      await act(async () => {
        root!.render(<Header currentPath="/privacy" onNavigate={mockNavigate} />);
      });

      const navBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Who It\'s For')
      );

      await act(async () => {
        navBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Footer', () => {
    it('renders legal and resource links', async () => {
      await act(async () => {
        root!.render(<Footer onNavigate={mockNavigate} />);
      });

      expect(container?.textContent).toContain('Peer Coaching Network');
      expect(container?.textContent).toContain('Privacy Policy');
      expect(container?.textContent).toContain('Terms of Service');
      expect(container?.textContent).toContain('Contact & Support');

      const privacyBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Privacy Policy')
      );

      await act(async () => {
        privacyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/privacy');
    });
  });
});
