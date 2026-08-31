// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HomePage } from '../HomePage';
import { PrivacyPage } from '../PrivacyPage';
import { TermsPage } from '../TermsPage';
import { ContactPage } from '../ContactPage';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Landing Pages', () => {
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

  describe('HomePage', () => {
    it('renders hero, key pillars, and handles FAQ toggling', async () => {
      await act(async () => {
        root!.render(<HomePage onNavigate={mockNavigate} />);
      });

      expect(container?.textContent).toContain('A Trusted Space for Coaches & Trainees to Practice and Grow');
      
      // FAQ accordion
      const faqButtons = container?.querySelectorAll('button');
      const firstFaqBtn = Array.from(faqButtons || []).find((b) =>
        b.textContent?.includes('Who can join Peer Coaching Network?')
      );
      expect(firstFaqBtn).toBeDefined();

      // Click to expand FAQ
      await act(async () => {
        firstFaqBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(container?.textContent).toContain('credentialed professional life coaches');
    });
  });

  describe('PrivacyPage', () => {
    it('renders privacy policy sections and back button', async () => {
      await act(async () => {
        root!.render(<PrivacyPage onNavigate={mockNavigate} />);
      });

      expect(container?.textContent).toContain('Privacy Policy');
      expect(container?.textContent).toContain('Google API Services & Limited Use Disclosure');

      const backBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Back to Home')
      );
      expect(backBtn).toBeDefined();

      await act(async () => {
        backBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('TermsPage', () => {
    it('renders terms and handles back navigation', async () => {
      await act(async () => {
        root!.render(<TermsPage onNavigate={mockNavigate} />);
      });

      expect(container?.textContent).toContain('Terms of Service');

      const backBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Back to Home')
      );
      await act(async () => {
        backBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('ContactPage', () => {
    it('renders contact information and assistance topics', async () => {
      await act(async () => {
        root!.render(<ContactPage onNavigate={mockNavigate} />);
      });

      expect(container?.textContent).toContain('Contact & Support');
      expect(container?.textContent).toContain('Email Support');
      expect(container?.textContent).toContain('Account & Credentials');

      const backBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Back to Home')
      );
      await act(async () => {
        backBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
