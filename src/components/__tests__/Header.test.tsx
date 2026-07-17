import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TABS, USER_ROLE, type TabKey, type UserRole, type UserStatus } from '../../config';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuth = vi.hoisted(() => ({
  value: {} as {
    user: unknown;
    profile: unknown;
    role: UserRole | null | undefined;
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth.value,
}));

vi.mock('../../services/firebaseService', () => ({
  formatDisplayName: () => 'Ada Lovelace',
  formatMemberSince: () => 'Jan 2026',
  isApproved: () => true,
  // Header only queries the pending count for admins; resolve to zero.
  getPendingUsersCount: () => Promise.resolve(0),
}));

vi.mock('../../utils/url', () => ({
  sanitizeImageUrl: (url: string) => url,
}));

import { Header } from '../Header';

describe('Header logo accessibility', () => {
  let container: HTMLDivElement;
  let root: Root;
  let setCurrentTab: ReturnType<typeof vi.fn<(tab: TabKey, adminFilter?: 'all' | UserStatus | UserRole) => void>>;

  const renderHeader = (role: UserRole | null | undefined) => {
    mockAuth.value = {
      user: { uid: 'u1', email: 'ada@example.com', photoURL: null },
      profile: { email: 'ada@example.com', photoURL: null },
      role,
    };
    act(() => {
      root.render(<Header currentTab={TABS.DASHBOARD} setCurrentTab={setCurrentTab} />);
    });
  };

  const logo = () => container.querySelector('.logo-button')!;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    setCurrentTab = vi.fn<(tab: TabKey, adminFilter?: 'all' | UserStatus | UserRole) => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  for (const role of [USER_ROLE.USER, USER_ROLE.ADMIN] as const) {
    it(`renders the logo as a button with an accessible name for role "${role}"`, () => {
      renderHeader(role);

      const el = logo();
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
      expect(el.getAttribute('aria-label')).toBe('Go to Dashboard');
    });

    it(`navigates to the dashboard when the logo is activated for role "${role}"`, () => {
      renderHeader(role);

      act(() => {
        (logo() as HTMLButtonElement).click();
      });

      expect(setCurrentTab).toHaveBeenCalledWith(TABS.DASHBOARD);
    });
  }

  // role === null means a pending user, undefined means auth is still loading.
  // Neither can navigate, so the logo must not be a focusable dead control.
  for (const role of [null, undefined]) {
    it(`renders the logo as a non-focusable element when role is ${role}`, () => {
      renderHeader(role);

      const el = logo();
      expect(el.tagName).not.toBe('BUTTON');
      expect(el.getAttribute('tabindex')).toBeNull();
      expect(el.querySelector('button')).toBeNull();
    });
  }

  it('does not nest flow content inside the logo button', () => {
    renderHeader(USER_ROLE.USER);

    // A <button> may only contain phrasing content; div/h3 descendants are invalid.
    expect(logo().querySelector('div, h1, h2, h3, h4, h5, h6, p')).toBeNull();
  });
});

