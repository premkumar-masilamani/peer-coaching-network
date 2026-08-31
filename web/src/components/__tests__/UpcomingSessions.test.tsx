// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/firebaseApp', () => ({
  db: { type: 'mock-db' },
  auth: { currentUser: { uid: 'u-1' } },
  functions: { type: 'mock-functions' },
  logAnalyticsEvent: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u-1', email: 'prem@example.com' },
    profile: { userId: 'u-1', displayName: 'Coach Prem', timezone: 'UTC' },
    reconnectGoogle: vi.fn().mockResolvedValue('token'),
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useNavigateToProfile: () => vi.fn(),
}));

vi.mock('../../services/firebaseService', () => ({
  subscribeAvailableCoachesForDay: vi.fn().mockResolvedValue(() => {}),
  getUserBookings: vi.fn().mockResolvedValue([]),
  getProfiles: vi.fn().mockResolvedValue([]),
  formatDisplayName: (u: { displayName?: string } | null | undefined) => u?.displayName || 'Coach',
  logAnalyticsEvent: vi.fn(),
}));

vi.mock('../../services/googleCalendar', () => ({
  getUpcomingEvents: vi.fn().mockResolvedValue([]),
  cancelBooking: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/googleToken', () => ({
  getGoogleToken: () => 'token',
  hasExpiredGoogleToken: () => false,
}));

import { UpcomingSessions } from '../UpcomingSessions';

describe('UpcomingSessions component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
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

  it('renders filters bar and slot picker', async () => {
    await act(async () => {
      root!.render(<UpcomingSessions />);
    });

    expect(container?.textContent).toContain('Filter Available Coaches');
  });
});
