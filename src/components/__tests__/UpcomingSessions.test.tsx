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

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const mockUnsavedChanges = vi.hoisted(() => ({
  navigateToProfile: vi.fn(),
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useNavigateToProfile: () => mockUnsavedChanges.navigateToProfile,
}));

const mockFirebaseService = vi.hoisted(() => ({
  formatDisplayName: vi.fn((p: { displayName?: string } | null | undefined) => p?.displayName || 'Unknown'),
  queryAvailableCoachesForDay: vi.fn(),
  getUserBookings: vi.fn(() => Promise.resolve([])),
  getUserAvailableSlots: vi.fn(() => Promise.resolve([])),
  getProfiles: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/firebaseService', () => ({
  formatDisplayName: mockFirebaseService.formatDisplayName,
  queryAvailableCoachesForDay: mockFirebaseService.queryAvailableCoachesForDay,
  getUserBookings: mockFirebaseService.getUserBookings,
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

  it('queries user bookings on mount', () => {
    act(() => {
      root.render(<UpcomingSessions />);
    });

    expect(mockFirebaseService.getUserBookings).toHaveBeenCalledWith('client-123');
  });

  it('prevents stale day availability fetches from overwriting newer selections', async () => {
    let resolveFirstQuery: (value: Record<string, unknown[]>) => void = () => {};
    const firstQueryPromise = new Promise<Record<string, unknown[]>>((resolve) => {
      resolveFirstQuery = resolve;
    });

    let firstQuerySlots: { startTime: Date; endTime: Date }[] = [];
    let firstCall = true;
    mockFirebaseService.queryAvailableCoachesForDay.mockImplementation((_start, _end, slots) => {
      if (firstCall) {
        firstCall = false;
        firstQuerySlots = slots;
        return firstQueryPromise;
      }
      // Second call returns immediately with Coach Two
      const slotIso = slots[10].startTime.toISOString();
      return Promise.resolve({
        [slotIso]: [
          { userId: 'coach-2', displayName: 'Coach Two', email: 'coach2@example.com', role: 'coach', userStatus: 'active' }
        ]
      });
    });

    await act(async () => {
      root.render(<UpcomingSessions />);
    });
    // Trigger initial render/query
    await act(async () => { await Promise.resolve(); });

    // Now query 1 is pending.
    // Simulate selecting the next day (Day 2)
    const dayButtons = container.querySelectorAll('.date-tab');
    expect(dayButtons.length).toBeGreaterThan(1);

    await act(async () => {
      dayButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    
    // Clicking triggers the second query, which resolves immediately (returning Coach Two).
    // Let's resolve the first query now (which resolves with Coach One, i.e., stale data).
    await act(async () => {
      // Use a slot ISO from the first query slots (which is Day 1 / tomorrow)
      const slotIso = firstQuerySlots[10]?.startTime.toISOString() || new Date().toISOString();
      resolveFirstQuery({
        [slotIso]: [
          { userId: 'coach-1', displayName: 'Coach One', email: 'coach1@example.com', role: 'coach', userStatus: 'active' }
        ]
      });
      await Promise.resolve();
    });

    // Wait for any pending promises/state updates to flush
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // The UI should show "Coach Two" (newer selection) and NOT "Coach One" (stale overwrite)
    expect(container.textContent).toContain('Coach Two');
    expect(container.textContent).not.toContain('Coach One');
  });
});
