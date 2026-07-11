import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { AvailabilityEdit } from '../AvailabilityEdit';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuth = vi.hoisted(() => ({
  value: {
    profile: { email: 'coach@example.com', displayName: 'Coach Name', timezone: 'UTC' },
    user: { uid: 'coach-123' },
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth.value,
}));

const mockUnsavedChanges = vi.hoisted(() => ({
  setPageDirtyState: vi.fn(),
  requestExplicitSave: vi.fn(),
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => mockUnsavedChanges,
}));

const mockFirebaseService = vi.hoisted(() => ({
  recalculateAvailableSlotsCache: vi.fn(() => Promise.resolve()),
  getSchedule: vi.fn(),
  updateSchedule: vi.fn(() => Promise.resolve()),
  logAnalyticsEvent: vi.fn(),
  timeStringToTimestamp: (t: string) => t,
  timestampToTimeString: (t: string) => t,
}));

vi.mock('../../services/firebaseService', () => ({
  recalculateAvailableSlotsCache: mockFirebaseService.recalculateAvailableSlotsCache,
  getSchedule: mockFirebaseService.getSchedule,
  updateSchedule: mockFirebaseService.updateSchedule,
  logAnalyticsEvent: mockFirebaseService.logAnalyticsEvent,
  timeStringToTimestamp: mockFirebaseService.timeStringToTimestamp,
  timestampToTimeString: mockFirebaseService.timestampToTimeString,
}));

// Provide a full 7-day schedule shape that AvailabilityEdit expects
const makeSchedule = () => ({
  availableDays: {
    monday:    { enabled: true,  slots: [{ startTime: '09:00 AM', endTime: '05:00 PM' }] },
    tuesday:   { enabled: false, slots: [] },
    wednesday: { enabled: false, slots: [] },
    thursday:  { enabled: false, slots: [] },
    friday:    { enabled: false, slots: [] },
    saturday:  { enabled: false, slots: [] },
    sunday:    { enabled: false, slots: [] },
  },
  blockedDates: [],
});

// jsdom doesn't implement dialog.showModal — mock CalendarModal too
vi.mock('../modals/CalendarModal', () => ({
  CalendarModal: () => null,
}));

describe('AvailabilityEdit component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    mockFirebaseService.getSchedule.mockResolvedValue(makeSchedule());
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders availability heading after loading schedule', async () => {
    await act(async () => {
      root.render(<AvailabilityEdit />);
    });
    // flush the async getSchedule
    await act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain('My Availability');
    expect(mockFirebaseService.getSchedule).toHaveBeenCalledWith('coach-123');
  });

  it('marks dirty state when a day toggle is changed', async () => {
    await act(async () => {
      root.render(<AvailabilityEdit />);
    });
    await act(async () => { await Promise.resolve(); });

    // All checkboxes: first is Monday (enabled), click it to toggle off
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);

    await act(async () => {
      (checkboxes[0] as HTMLInputElement).click();
    });

    expect(mockUnsavedChanges.setPageDirtyState).toHaveBeenCalledWith(
      true,
      expect.any(Array),
      expect.any(Function)
    );
  });
});
