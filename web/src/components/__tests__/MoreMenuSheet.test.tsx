// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MoreMenuSheet } from '../modals/MoreMenuSheet';
import { TABS, USER_ROLE, USER_STATUS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuthData: {
  user: { uid: string; email: string; photoURL: string };
  profile: {
    userId: string;
    displayName: string;
    email: string;
    userRole: string;
    userStatus: string;
    createdAt: { seconds: number; nanoseconds: number };
  };
  role: string;
  logout: ReturnType<typeof vi.fn>;
} = {
  user: { uid: 'u-1', email: 'coach@example.com', photoURL: 'https://example.com/photo.jpg' },
  profile: {
    userId: 'u-1',
    displayName: 'Test Coach',
    email: 'coach@example.com',
    userRole: USER_ROLE.ADMIN,
    userStatus: USER_STATUS.ACTIVE,
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
  },
  role: USER_ROLE.ADMIN,
  logout: vi.fn(),
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthData,
}));

vi.mock('../../services/firebaseService', () => ({
  formatDisplayName: (u: { displayName?: string } | null | undefined) => u?.displayName || 'Test Coach',
  formatMemberSince: () => 'November 2023',
  isApproved: () => true,
  getPendingUsersCount: vi.fn().mockResolvedValue(3),
}));

vi.mock('../../hooks/useFocusRefresh', () => ({
  useFocusRefresh: vi.fn(),
}));

describe('MoreMenuSheet component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockSetCurrentTab = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    mockAuthData.role = USER_ROLE.ADMIN;
    mockAuthData.profile.userRole = USER_ROLE.ADMIN;
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

  it('renders user details and navigation items when open', async () => {
    await act(async () => {
      root!.render(
        <MoreMenuSheet
          isOpen={true}
          onClose={mockOnClose}
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
        />
      );
    });

    expect(container?.textContent).toContain('Test Coach');
    expect(container?.textContent).toContain('coach@example.com');
    expect(container?.textContent).toContain('Get Support');
    expect(container?.textContent).toContain('Admin Dashboard');
    expect(container?.textContent).toContain('Sign Out');

    const grabHandle = container?.querySelector('.modal-grab-handle');
    expect(grabHandle).toBeTruthy();
  });

  it('navigates to Support and closes sheet when Get Support is tapped', async () => {
    await act(async () => {
      root!.render(
        <MoreMenuSheet
          isOpen={true}
          onClose={mockOnClose}
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
        />
      );
    });

    const supportBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Get Support')
    );
    expect(supportBtn).toBeTruthy();

    await act(async () => {
      supportBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockSetCurrentTab).toHaveBeenCalledWith(TABS.SUPPORT);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to Admin when Admin Dashboard is tapped by an admin', async () => {
    await act(async () => {
      root!.render(
        <MoreMenuSheet
          isOpen={true}
          onClose={mockOnClose}
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
        />
      );
    });

    const adminBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Admin Dashboard')
    );
    expect(adminBtn).toBeTruthy();

    await act(async () => {
      adminBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockSetCurrentTab).toHaveBeenCalledWith(TABS.ADMIN);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('hides Admin Dashboard for non-admin users', async () => {
    mockAuthData.role = USER_ROLE.USER;
    mockAuthData.profile.userRole = USER_ROLE.USER;

    await act(async () => {
      root!.render(
        <MoreMenuSheet
          isOpen={true}
          onClose={mockOnClose}
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
        />
      );
    });

    expect(container?.textContent).not.toContain('Admin Dashboard');
    expect(container?.textContent).toContain('Get Support');
    expect(container?.textContent).toContain('Sign Out');
  });

  it('triggers logout when Sign Out is clicked', async () => {
    await act(async () => {
      root!.render(
        <MoreMenuSheet
          isOpen={true}
          onClose={mockOnClose}
          currentTab={TABS.DASHBOARD}
          setCurrentTab={mockSetCurrentTab}
        />
      );
    });

    const signOutBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Sign Out')
    );
    expect(signOutBtn).toBeTruthy();

    await act(async () => {
      signOutBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockAuthData.logout).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
