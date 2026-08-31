// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SupportDesk } from '../SupportDesk';
import { USER_ROLE, USER_STATUS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockGetSupportRequestsPage } = vi.hoisted(() => ({
  mockGetSupportRequestsPage: vi.fn().mockResolvedValue({
    requests: [
      {
        id: 'req-1',
        userId: 'u-1',
        userDisplayName: 'User Alice',
        category: 'General Inquiry',
        subject: 'Account Issue',
        status: 'open',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    hasMore: false,
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      userId: 'admin-1',
      displayName: 'Admin User',
      userRole: USER_ROLE.ADMIN,
      userStatus: USER_STATUS.ACTIVE,
    },
  }),
}));

vi.mock('../../services/firebaseService', () => ({
  getSupportRequestsPage: mockGetSupportRequestsPage,
  addMessageToSupportRequest: vi.fn(),
  updateSupportRequestStatus: vi.fn(),
  deleteSupportRequest: vi.fn(),
  getSupportMessages: vi.fn().mockResolvedValue([]),
  formatDisplayName: () => 'User Alice',
}));

describe('SupportDesk component', () => {
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

  it('renders support desk tickets for admin', async () => {
    await act(async () => {
      root!.render(<SupportDesk />);
    });

    expect(mockGetSupportRequestsPage).toHaveBeenCalled();
    expect(container?.textContent).toContain('Support Desk');
    expect(container?.textContent).toContain('Account Issue');
  });
});
