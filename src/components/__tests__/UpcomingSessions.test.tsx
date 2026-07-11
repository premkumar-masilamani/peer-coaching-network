import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { UpcomingSessions } from '../UpcomingSessions';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Must mock firebaseApp BEFORE any service imports to prevent Firebase initialization
vi.mock('../../services/firebaseApp', () => ({
  db: {},
  auth: {},
  logAnalyticsEvent: vi.fn(),
}));

const mockAuth = vi.hoisted(() => ({
  value: {
    profile: { email: 'client@example.com', displayName: 'Client Name', timezone: 'UTC' },
    user: { uid: 'client-123' },
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth.value,
}));

vi.mock('../../hooks/useFocusRefresh', () => ({
  useFocusRefresh: vi.fn(),
}));

const mockUnsavedChanges = vi.hoisted(() => ({
  navigateToProfile: vi.fn(),
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useNavigateToProfile: () => mockUnsavedChanges.navigateToProfile,
}));

const mockFirebaseService = vi.hoisted(() => ({
  formatDisplayName: vi.fn((p: any) => p?.displayName || 'Unknown'),
  queryAvailableCoachesForDay: vi.fn(),
  subscribeToUserBookings: vi.fn(() => () => {}),
  getUserAvailableSlots: vi.fn(() => Promise.resolve([])),
  getProfiles: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/firebaseService', () => ({
  formatDisplayName: mockFirebaseService.formatDisplayName,
  queryAvailableCoachesForDay: mockFirebaseService.queryAvailableCoachesForDay,
  subscribeToUserBookings: mockFirebaseService.subscribeToUserBookings,
  getUserAvailableSlots: mockFirebaseService.getUserAvailableSlots,
  getProfiles: mockFirebaseService.getProfiles,
}));

const mockGoogleCalendar = vi.hoisted(() => ({
  getUpcomingEvents: vi.fn(() => Promise.resolve([])),
  cancelBooking: vi.fn(),
}));

vi.mock('../../services/googleCalendar', () => ({
  getUpcomingEvents: mockGoogleCalendar.getUpcomingEvents,
  cancelBooking: mockGoogleCalendar.cancelBooking,
}));

// jsdom doesn't implement dialog.showModal — mock modals
vi.mock('../modals/ScheduleModal', () => ({
  ScheduleModal: () => null,
}));
vi.mock('../modals/CancelModal', () => ({
  CancelModal: () => null,
}));
vi.mock('../modals/SessionDetailsModal', () => ({
  SessionDetailsModal: () => null,
}));

describe('UpcomingSessions component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    mockFirebaseService.queryAvailableCoachesForDay.mockResolvedValue({});
    mockFirebaseService.getUserAvailableSlots.mockResolvedValue([]);
    mockGoogleCalendar.getUpcomingEvents.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the Book a Session heading', async () => {
    await act(async () => {
      root.render(<UpcomingSessions />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain('Filter Available Coaches');
  });

  it('queries day availability on mount', async () => {
    await act(async () => {
      root.render(<UpcomingSessions />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(mockFirebaseService.queryAvailableCoachesForDay).toHaveBeenCalled();
  });

  it('renders a date carousel with selectable day buttons', async () => {
    await act(async () => {
      root.render(<UpcomingSessions />);
    });
    await act(async () => { await Promise.resolve(); });

    // The day carousel items should include at least one day button
    const dayButtons = container.querySelectorAll('.date-tab');
    expect(dayButtons.length).toBeGreaterThan(0);
  });

  it('subscribes to user bookings on mount', () => {
    act(() => {
      root.render(<UpcomingSessions />);
    });

    expect(mockFirebaseService.subscribeToUserBookings).toHaveBeenCalledWith(
      'client-123',
      expect.any(Function)
    );
  });
});
