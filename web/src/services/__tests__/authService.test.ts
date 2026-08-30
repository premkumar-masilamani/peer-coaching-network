// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPopup = vi.fn();
const mockCredentialFromResult = vi.fn();
const mockSignOut = vi.fn();

vi.mock('firebase/auth', () => {
  return {
    signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
    GoogleAuthProvider: class {
      scopes: string[] = [];
      customParameters: Record<string, string> = {};
      addScope(scope: string) {
        this.scopes.push(scope);
      }
      setCustomParameters(params: Record<string, string>) {
        this.customParameters = params;
      }
      static credentialFromResult = (...args: unknown[]) => mockCredentialFromResult(...args);
    },
    signOut: (...args: unknown[]) => mockSignOut(...args),
    getRedirectResult: vi.fn(),
    onAuthStateChanged: vi.fn(),
  };
});

vi.mock('../firebaseApp', () => ({
  auth: { currentUser: { uid: 'u-123', email: 'test@example.com' } },
  db: { type: 'mock-db' },
  functions: {},
}));

vi.mock('../firestoreRepository', () => ({
  getUserProfile: vi.fn().mockResolvedValue({
    userId: 'u-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  }),
}));

vi.mock('../googleCalendar', () => ({
  syncCalendar: vi.fn().mockResolvedValue(undefined),
}));

import { reconnectGoogleCalendar, logout } from '../authService';
import { getGoogleToken, setGoogleToken, isGoogleTokenValid } from '../googleToken';

describe('authService reconnectGoogleCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('should successfully reconnect Google Calendar with login_hint and store the fresh token', async () => {
    const fakeUser = { uid: 'u-123', email: 'test@example.com', displayName: 'Test User' };
    mockSignInWithPopup.mockResolvedValueOnce({ user: fakeUser });
    mockCredentialFromResult.mockReturnValueOnce({ accessToken: 'fresh-token-xyz' });

    const token = await reconnectGoogleCalendar('test@example.com');

    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
    expect(token).toBe('fresh-token-xyz');
    expect(getGoogleToken()).toBe('fresh-token-xyz');
    expect(isGoogleTokenValid()).toBe(true);
  });

  it('should clear Google token upon logout', async () => {
    setGoogleToken('temp-token');
    expect(getGoogleToken()).toBe('temp-token');

    await logout();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(getGoogleToken()).toBeNull();
    expect(isGoogleTokenValid()).toBe(false);
  });
});
