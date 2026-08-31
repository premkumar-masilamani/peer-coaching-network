// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Header } from '../Header';
import { LeftNav } from '../LeftNav';
import { TABS, USER_ROLE, USER_STATUS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuthData = {
  user: { uid: 'u-1', email: 'test@example.com' },
  profile: {
    userId: 'u-1',
    displayName: 'Test Coach',
    userRole: USER_ROLE.ADMIN,
    userStatus: USER_STATUS.ACTIVE,
  },
  role: USER_ROLE.ADMIN,
  logout: vi.fn(),
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthData,
}));

vi.mock('../../services/firebaseService', () => ({
  formatDisplayName: (u: { displayName?: string } | null | undefined) => u?.displayName || 'Test Coach',
  formatMemberSince: () => 'January 2026',
  isApproved: () => true,
  getPendingUsersCount: vi.fn().mockResolvedValue(5),
}));

describe('Header and LeftNav components', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockSetTab = vi.fn();
  const mockSetCollapsed = vi.fn();

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

  describe('Header', () => {
    it('renders logo and user info for active admin', async () => {
      await act(async () => {
        root!.render(<Header currentTab={TABS.DASHBOARD} setCurrentTab={mockSetTab} />);
      });

      expect(container?.textContent).toContain('Peer Coaching Network');
      expect(container?.textContent).toContain('Test Coach');

      const logoBtn = container?.querySelector('button.logo-button');
      await act(async () => {
        logoBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockSetTab).toHaveBeenCalledWith(TABS.DASHBOARD);
    });
  });

  describe('LeftNav', () => {
    it('renders navigation tabs and triggers tab selection', async () => {
      await act(async () => {
        root!.render(
          <LeftNav
            currentTab={TABS.DASHBOARD}
            setCurrentTab={mockSetTab}
            collapsed={false}
            setCollapsed={mockSetCollapsed}
          />
        );
      });

      expect(container?.textContent).toContain('Dashboard');
      expect(container?.textContent).toContain('My Sessions');
      expect(container?.textContent).toContain('My Availability');
      expect(container?.textContent).toContain('My Profile');
      expect(container?.textContent).toContain('Admin');

      const availabilityBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('My Availability')
      );

      await act(async () => {
        availabilityBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockSetTab).toHaveBeenCalledWith(TABS.AVAILABILITY);
    });

    it('toggles collapsed state', async () => {
      await act(async () => {
        root!.render(
          <LeftNav
            currentTab={TABS.DASHBOARD}
            setCurrentTab={mockSetTab}
            collapsed={false}
            setCollapsed={mockSetCollapsed}
          />
        );
      });

      const collapseBtn = container?.querySelector('.sidebar-toggle-btn');
      expect(collapseBtn).not.toBeNull();

      await act(async () => {
        collapseBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(mockSetCollapsed).toHaveBeenCalledWith(true);
    });
  });
});
