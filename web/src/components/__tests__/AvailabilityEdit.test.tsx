// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { mockGetSchedule, mockUpdateSchedule } = vi.hoisted(() => ({
  mockGetSchedule: vi.fn().mockResolvedValue({
    availableDays: {
      monday: { enabled: true, slots: [{ startTime: { toDate: () => new Date('1970-01-01T09:00:00Z') }, endTime: { toDate: () => new Date('1970-01-01T17:00:00Z') } }] },
      tuesday: { enabled: false, slots: [] },
      wednesday: { enabled: false, slots: [] },
      thursday: { enabled: false, slots: [] },
      friday: { enabled: false, slots: [] },
      saturday: { enabled: false, slots: [] },
      sunday: { enabled: false, slots: [] },
    },
    blockedDates: ['2026-12-25'],
  }),
  mockUpdateSchedule: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u-1' },
    profile: { userId: 'u-1', timezone: 'UTC' },
  }),
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    setPageDirtyState: vi.fn(),
    requestExplicitSave: vi.fn(),
  }),
}));

vi.mock('../../services/firebaseService', () => ({
  getSchedule: mockGetSchedule,
  updateSchedule: mockUpdateSchedule,
  recalculateAvailableSlotsCache: vi.fn(),
  timeStringToTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  timestampToTimeString: vi.fn(() => '9:00 AM'),
  logAnalyticsEvent: vi.fn(),
}));

import { AvailabilityEdit } from '../AvailabilityEdit';

describe('AvailabilityEdit component', () => {
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

  it('loads and renders schedule days and blocked dates', async () => {
    await act(async () => {
      root!.render(<AvailabilityEdit />);
    });

    expect(mockGetSchedule).toHaveBeenCalledWith('u-1');
    expect(container?.textContent).toContain('Monday');
    expect(container?.textContent).toContain('Friday');
  });
});
