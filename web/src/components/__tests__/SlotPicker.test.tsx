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
    user: { uid: 'u-1' },
    profile: { userId: 'u-1', timezone: 'UTC' },
  }),
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useNavigateToProfile: () => vi.fn(),
}));

import { SlotPicker } from '../SlotPicker';
import { USER_ROLE, USER_STATUS } from '../../config';

describe('SlotPicker component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockSlotSelect = vi.fn();
  const mockDayChange = vi.fn();

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

  it('renders date tabs and handles tab selection', async () => {
    await act(async () => {
      root!.render(
        <SlotPicker
          mode="multi"
          userBusyEvents={[]}
          onSlotSelect={mockSlotSelect}
          isInitialLoading={false}
          isFetchingDay={false}
          selectedDayIndex={0}
          onDayChange={mockDayChange}
        />
      );
    });

    const tabs = container?.querySelectorAll('[role="tab"]');
    expect(tabs && tabs.length).toBeGreaterThan(0);

    if (tabs && tabs[1]) {
      await act(async () => {
        tabs[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(mockDayChange).toHaveBeenCalledWith(1);
    }
  });

  it('renders available coach cards in multi mode', async () => {
    const mockCoach: import('../../services/types').UserProfile = {
      userId: 'c-1',
      firstName: 'Coach',
      lastName: 'Alice',
      email: 'alice@example.com',
      gender: 'Female',
      country: 'United States',
      timezone: 'UTC',
      userRole: USER_ROLE.USER,
      userStatus: USER_STATUS.ACTIVE,
      icf_pcc: true,
      bio: 'Alice bio',
      photoURL: null,
      createdAt: { toDate: () => new Date(), seconds: 0, nanoseconds: 0, toMillis: () => 0 },
      updatedAt: { toDate: () => new Date(), seconds: 0, nanoseconds: 0, toMillis: () => 0 },
    };

    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrowDateStr = d.toISOString().split('T')[0];
    const dayAvailability = {
      [`${tomorrowDateStr}T10:00:00.000Z`]: [mockCoach],
    };

    await act(async () => {
      root!.render(
        <SlotPicker
          mode="multi"
          dayAvailability={dayAvailability}
          userBusyEvents={[]}
          onSlotSelect={mockSlotSelect}
          isInitialLoading={false}
          isFetchingDay={false}
          selectedDayIndex={0}
          onDayChange={mockDayChange}
        />
      );
    });

    expect(container?.textContent).toContain('Coach Alice');
  });
});
