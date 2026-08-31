// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SupportFeedback } from '../SupportFeedback';
import { USER_ROLE, USER_STATUS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockGetSupportRequestsForUser } = vi.hoisted(() => ({
  mockGetSupportRequestsForUser: vi.fn().mockResolvedValue([
    {
      id: 'req-1',
      userId: 'u-1',
      userDisplayName: 'User One',
      category: 'General Inquiry',
      subject: 'Question on Sessions',
      status: 'open',
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ]),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      userId: 'u-1',
      displayName: 'User One',
      userRole: USER_ROLE.USER,
      userStatus: USER_STATUS.ACTIVE,
    },
  }),
}));

vi.mock('../../services/firebaseService', () => ({
  getSupportRequestsForUser: mockGetSupportRequestsForUser,
  createSupportRequest: vi.fn().mockResolvedValue('req-2'),
  addMessageToSupportRequest: vi.fn(),
  updateSupportRequestStatus: vi.fn(),
  getSupportMessages: vi.fn().mockResolvedValue([]),
  formatDisplayName: () => 'User One',
}));

describe('SupportFeedback component', () => {
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

  it('renders ticket list with existing tickets', async () => {
    await act(async () => {
      root!.render(<SupportFeedback />);
    });

    expect(mockGetSupportRequestsForUser).toHaveBeenCalledWith('u-1');
    expect(container?.textContent).toContain('Get Support');
    expect(container?.textContent).toContain('Question on Sessions');
  });

  it('switches to new request view when clicking New Request', async () => {
    await act(async () => {
      root!.render(<SupportFeedback />);
    });

    const newBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('New Request')
    );

    await act(async () => {
      newBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.textContent).toContain('New Support Request');
  });
});
