// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BottomNav } from '../BottomNav';
import { TABS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('BottomNav component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockSetCurrentTab = vi.fn();
  const mockOnOpenMore = vi.fn();

  beforeEach(() => {
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

  it('renders all 5 navigation buttons and highlights the active tab', async () => {
    await act(async () => {
      root!.render(
        <BottomNav
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
          onOpenMore={mockOnOpenMore}
        />
      );
    });

    const nav = container?.querySelector('nav.mobile-bottom-nav');
    expect(nav).toBeTruthy();

    const buttons = Array.from(container?.querySelectorAll('button.bottom-nav-item') || []);
    expect(buttons).toHaveLength(5);

    expect(container?.textContent).toContain('Dashboard');
    expect(container?.textContent).toContain('Sessions');
    expect(container?.textContent).toContain('Availability');
    expect(container?.textContent).toContain('Profile');
    expect(container?.textContent).toContain('More');

    // Dashboard should be active
    const dashboardBtn = buttons.find((b) => b.textContent?.includes('Dashboard'));
    expect(dashboardBtn?.classList.contains('active')).toBe(true);
    expect(dashboardBtn?.getAttribute('aria-current')).toBe('page');

    const sessionsBtn = buttons.find((b) => b.textContent?.includes('Sessions'));
    expect(sessionsBtn?.classList.contains('active')).toBe(false);
  });

  it('dispatches setCurrentTab when a tab button is clicked', async () => {
    await act(async () => {
      root!.render(
        <BottomNav
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
          onOpenMore={mockOnOpenMore}
        />
      );
    });

    const sessionsBtn = Array.from(container?.querySelectorAll('button.bottom-nav-item') || []).find((b) =>
      b.textContent?.includes('Sessions')
    );
    expect(sessionsBtn).toBeTruthy();

    await act(async () => {
      sessionsBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockSetCurrentTab).toHaveBeenCalledWith(TABS.BOOKINGS);

    const availBtn = Array.from(container?.querySelectorAll('button.bottom-nav-item') || []).find((b) =>
      b.textContent?.includes('Availability')
    );
    await act(async () => {
      availBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockSetCurrentTab).toHaveBeenCalledWith(TABS.AVAILABILITY);

    const profileBtn = Array.from(container?.querySelectorAll('button.bottom-nav-item') || []).find((b) =>
      b.textContent?.includes('Profile')
    );
    await act(async () => {
      profileBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockSetCurrentTab).toHaveBeenCalledWith(TABS.PROFILE);
  });

  it('triggers onOpenMore when the More button is clicked', async () => {
    await act(async () => {
      root!.render(
        <BottomNav
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
          onOpenMore={mockOnOpenMore}
        />
      );
    });

    const moreBtn = Array.from(container?.querySelectorAll('button.bottom-nav-item') || []).find((b) =>
      b.textContent?.includes('More')
    );
    expect(moreBtn).toBeTruthy();

    await act(async () => {
      moreBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockOnOpenMore).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentTab).not.toHaveBeenCalled();
  });
});
