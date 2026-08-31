// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UserManagement } from '../UserManagement';
import { USER_ROLE, USER_STATUS, type UserRole, type UserStatus } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockGetUsersPage, mockGetPendingUsers } = vi.hoisted(() => ({
  mockGetUsersPage: vi.fn().mockResolvedValue({
    users: [
      {
        userId: 'u-1',
        displayName: 'Coach Alice',
        email: 'alice@example.com',
        userRole: 'user',
        userStatus: 'active',
        icf_acc: true,
      },
    ],
    nextCursor: null,
    hasMore: false,
  }),
  mockGetPendingUsers: vi.fn().mockResolvedValue([
    {
      userId: 'u-2',
      displayName: 'Pending Bob',
      email: 'bob@example.com',
      userRole: 'user',
      userStatus: 'inactive',
    },
  ]),
}));

vi.mock('../../services/adminService', () => ({
  getUsersPage: mockGetUsersPage,
  getPendingUsers: mockGetPendingUsers,
  getUserBookingStats: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/profileService', () => ({
  updateProfile: vi.fn(),
  formatDisplayName: (u: { displayName?: string } | null | undefined) => u?.displayName || 'User',
  formatMemberSince: () => 'January 2026',
  getEffectiveRole: (u: { userRole?: UserRole } | null | undefined) => u?.userRole || USER_ROLE.USER,
  getEffectiveStatus: (u: { userStatus?: UserStatus } | null | undefined) => u?.userStatus || USER_STATUS.ACTIVE,
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    setPageDirtyState: vi.fn(),
    requestExplicitSave: vi.fn(),
  }),
  useNavigateToProfile: () => vi.fn(),
}));

vi.mock('../../services/firebaseApp', () => ({
  logAnalyticsEvent: vi.fn(),
}));

describe('UserManagement component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

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

  it('loads and renders user roster and pending requests', async () => {
    await act(async () => {
      root!.render(<UserManagement />);
    });

    expect(mockGetUsersPage).toHaveBeenCalled();
    expect(mockGetPendingUsers).toHaveBeenCalled();
    expect(container?.textContent).toContain('Coach Alice');
  });
});
