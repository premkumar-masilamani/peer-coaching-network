import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TABS, USER_ROLE, type TabKey, type UserRole, GOOGLE_TOKEN_STATUS } from '../../config';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockEnableGoogleIntegration = true;
vi.mock('../../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config')>();
  return {
    ...actual,
    get ENABLE_GOOGLE_INTEGRATION() {
      return mockEnableGoogleIntegration;
    },
  };
});

const mockAuth = vi.hoisted(() => ({
  value: {} as {
    user: unknown;
    profile: unknown;
    role: UserRole | null | undefined;
    googleTokenStatus?: string;
    login?: () => Promise<void>;
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
  let setCurrentTab: ReturnType<typeof vi.fn<(tab: TabKey) => void>>;

  const renderHeader = (
    role: UserRole | null | undefined,
    googleTokenStatus: string = GOOGLE_TOKEN_STATUS.DISCONNECTED,
    loginMock = vi.fn()
  ) => {
    mockAuth.value = {
      user: { uid: 'u1', email: 'ada@example.com', photoURL: null },
      profile: { email: 'ada@example.com', photoURL: null },
      role,
      googleTokenStatus,
      login: loginMock,
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
    setCurrentTab = vi.fn<(tab: TabKey) => void>();
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

  describe('Google Calendar connection status badge', () => {
    beforeEach(() => {
      mockEnableGoogleIntegration = true;
    });

    it('renders connected status correctly', () => {
      renderHeader(USER_ROLE.USER, GOOGLE_TOKEN_STATUS.CONNECTED);
      const badge = container.querySelector('button[title*="Linked"]') as HTMLButtonElement;
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain('Calendar Linked');
      expect(badge.className).not.toContain('animate-pulse-warning');
    });

    it('renders expired status with pulse animation', () => {
      renderHeader(USER_ROLE.USER, GOOGLE_TOKEN_STATUS.EXPIRED);
      const badge = container.querySelector('button[title*="expired"]') as HTMLButtonElement;
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain('Calendar Expired (Reconnect)');
      expect(badge.className).toContain('animate-pulse-warning');
    });

    it('renders disconnected status correctly', () => {
      renderHeader(USER_ROLE.USER, GOOGLE_TOKEN_STATUS.DISCONNECTED);
      const badge = container.querySelector('button[title*="disconnected"]') as HTMLButtonElement;
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain('Calendar Offline (Connect)');
      expect(badge.className).not.toContain('animate-pulse-warning');
    });

    it('triggers login on click', () => {
      const loginMock = vi.fn().mockResolvedValue(undefined);
      renderHeader(USER_ROLE.USER, GOOGLE_TOKEN_STATUS.DISCONNECTED, loginMock);
      const badge = container.querySelector('button[title*="disconnected"]') as HTMLButtonElement;
      act(() => {
        badge.click();
      });
      expect(loginMock).toHaveBeenCalledTimes(1);
    });

    it('does not render the badge if ENABLE_GOOGLE_INTEGRATION is false', () => {
      mockEnableGoogleIntegration = false;
      renderHeader(USER_ROLE.USER, GOOGLE_TOKEN_STATUS.CONNECTED);
      const badge = container.querySelector('button[title*="Linked"]');
      expect(badge).toBeNull();
    });
  });
});

