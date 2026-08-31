// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EVENT_TYPE } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockGetUpcomingEvents, mockCancelBooking } = vi.hoisted(() => ({
  mockGetUpcomingEvents: vi.fn(),
  mockCancelBooking: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u-1', email: 'user@example.com' },
    profile: { userId: 'u-1', timezone: 'UTC' },
    reconnectGoogle: vi.fn().mockResolvedValue('token'),
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../services/googleCalendar', () => ({
  getUpcomingEvents: mockGetUpcomingEvents,
  cancelBooking: mockCancelBooking,
}));

vi.mock('../../services/googleToken', () => ({
  getGoogleToken: () => 'token',
  hasExpiredGoogleToken: () => false,
}));

vi.mock('../../services/firebaseApp', () => ({
  logAnalyticsEvent: vi.fn(),
}));

import { MySessions } from '../MySessions';

describe('MySessions component', () => {
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

  it('renders empty state when no sessions booked', async () => {
    mockGetUpcomingEvents.mockResolvedValueOnce([]);

    await act(async () => {
      root!.render(<MySessions />);
    });

    expect(container?.textContent).toContain('Upcoming Sessions');
  });

  it('renders booked sessions list', async () => {
    const startTime = new Date(Date.now() + 86400000);
    const endTime = new Date(startTime.getTime() + 1800000);

    mockGetUpcomingEvents.mockResolvedValueOnce([
      {
        id: 'booking-1',
        type: EVENT_TYPE.PEER_COACHING,
        summary: 'Coach Alice / Client User - Leadership',
        description: '- Topic: Leadership Coaching\nCoach: Coach Alice (alice@example.com)\nClient: Client User (user@example.com)',
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        hangoutLink: 'https://meet.google.com/abc-def-ghi',
      },
    ]);

    await act(async () => {
      root!.render(<MySessions />);
    });

    expect(container?.textContent).toContain('Upcoming Sessions');
    expect(container?.textContent).toContain('Coach Alice');
  });
});
