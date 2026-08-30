// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Flag to tell React 19 that we are running in an act environment
// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSubscribeToAuth = vi.fn();
const mockGetProfile = vi.fn();
const mockLoginWithGoogle = vi.fn();
const mockReconnectGoogleCalendar = vi.fn();
const mockHandleAuthRedirect = vi.fn();
const mockLogout = vi.fn();
const mockUpdateOwnProfile = vi.fn();
const mockGetEffectiveRole = vi.fn();
const mockGetEffectiveStatus = vi.fn();
const mockLazyRecalc = vi.fn();

vi.mock('../../services/firebaseService', () => ({
  subscribeToAuth: (...args: unknown[]) => mockSubscribeToAuth(...args),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  loginWithGoogle: (...args: unknown[]) => mockLoginWithGoogle(...args),
  reconnectGoogleCalendar: (...args: unknown[]) => mockReconnectGoogleCalendar(...args),
  handleAuthRedirect: (...args: unknown[]) => mockHandleAuthRedirect(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
  updateOwnProfile: (...args: unknown[]) => mockUpdateOwnProfile(...args),
  getEffectiveRole: (...args: unknown[]) => mockGetEffectiveRole(...args),
  getEffectiveStatus: (...args: unknown[]) => mockGetEffectiveStatus(...args),
  isFirebaseConfigured: true,
  lazyRecalculateAvailableSlotsCache: (...args: unknown[]) => mockLazyRecalc(...args),
}));

import { AuthProvider, useAuth } from '../AuthContext';
import { setGoogleToken, clearGoogleToken } from '../../services/googleToken';
import { GOOGLE_TOKEN_LIFETIME_MS, USER_ROLE, USER_STATUS } from '../../config';

const TestConsumer: React.FC = () => {
  const { user, isGoogleConnected, isGoogleTokenExpired, reconnectGoogle } = useAuth();
  return (
    <div>
      <div id="user-status">{user ? user.email : 'anonymous'}</div>
      <div id="google-connected">{isGoogleConnected ? 'connected' : 'not-connected'}</div>
      <div id="google-expired">{isGoogleTokenExpired ? 'expired' : 'valid'}</div>
      <button type="button" id="reconnect-btn" onClick={() => reconnectGoogle()}>
        Reconnect
      </button>
    </div>
  );
};

describe('AuthContext Proactive Token Verification', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    sessionStorage.clear();
    clearGoogleToken();
    vi.useFakeTimers();
    mockHandleAuthRedirect.mockResolvedValue(false);
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
    vi.useRealTimers();
  });

  it('updates token status on window focus and periodic interval without logging user out', async () => {
    let authCallback: ((user: unknown) => void) | null = null;
    mockSubscribeToAuth.mockImplementation((cb) => {
      authCallback = cb;
      return () => {};
    });

    const fakeUser = { uid: 'u-123', email: 'test@example.com' };
    const fakeProfile = {
      userId: 'u-123',
      email: 'test@example.com',
      userRole: USER_ROLE.USER,
      userStatus: USER_STATUS.ACTIVE,
    };
    mockGetProfile.mockResolvedValue(fakeProfile);
    mockGetEffectiveRole.mockReturnValue(USER_ROLE.USER);
    mockGetEffectiveStatus.mockReturnValue(USER_STATUS.ACTIVE);

    // Initial render
    await act(async () => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    // Authenticate user with valid token
    await act(async () => {
      setGoogleToken('initial-token');
      if (authCallback) authCallback(fakeUser);
    });

    expect(container?.querySelector('#user-status')?.textContent).toBe('test@example.com');
    expect(container?.querySelector('#google-connected')?.textContent).toBe('connected');
    expect(container?.querySelector('#google-expired')?.textContent).toBe('valid');

    // Fast-forward time past token lifetime
    await act(async () => {
      vi.advanceTimersByTime(GOOGLE_TOKEN_LIFETIME_MS);
    });

    // Fire focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // The user must STILL be logged in, but google token is detected as expired
    expect(container?.querySelector('#user-status')?.textContent).toBe('test@example.com');
    expect(container?.querySelector('#google-connected')?.textContent).toBe('not-connected');
    expect(container?.querySelector('#google-expired')?.textContent).toBe('expired');
    expect(mockLogout).not.toHaveBeenCalled();

    // Now test reconnectGoogle
    mockReconnectGoogleCalendar.mockResolvedValueOnce('new-token-456');
    const reconnectBtn = container?.querySelector('#reconnect-btn') as HTMLButtonElement;
    await act(async () => {
      reconnectBtn.click();
    });

    expect(container?.querySelector('#google-connected')?.textContent).toBe('connected');
    expect(container?.querySelector('#google-expired')?.textContent).toBe('valid');
  });
});
