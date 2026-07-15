/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { loginWithGoogle, handleAuthRedirect, logout, subscribeToAuth } from '../authService';

const H = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return {
    authState: { currentUser: null as null | { uid: string } },
    shared: {
      mockGetDoc: vi.fn(), mockSetDoc: vi.fn(), mockUpdateDoc: vi.fn(),
      mockGetDocs: vi.fn(), mockOnSnapshot: vi.fn(), mockDeleteDoc: vi.fn(),
      mockBatchSet: vi.fn(), mockBatchUpdate: vi.fn(), mockBatchDelete: vi.fn(), mockBatchCommit: vi.fn(() => Promise.resolve()),
    },
  };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock(H.authState));
vi.mock('firebase/firestore', async () => (await import('./helpers/firebaseMocks')).buildFirestoreMock(H.shared));
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());

const { mockGetDoc, mockSetDoc, mockUpdateDoc } = H.shared;

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.authState.currentUser = null;
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('loginWithGoogle', () => {
    it('starts a redirect sign-in requesting the calendar scopes', async () => {
      const { signInWithRedirect } = await import('firebase/auth');
      await loginWithGoogle();
      expect(signInWithRedirect).toHaveBeenCalledTimes(1);
      const provider = (signInWithRedirect as any).mock.calls[0][1];
      expect(provider.addScope).toHaveBeenCalledWith('https://www.googleapis.com/auth/calendar');
      expect(provider.addScope).toHaveBeenCalledWith('https://www.googleapis.com/auth/calendar.events');
      expect(provider.setCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' });
    });
  });

  describe('handleAuthRedirect', () => {
    it('returns false when there is no redirect result', async () => {
      const { getRedirectResult } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue(null as any);
      expect(await handleAuthRedirect()).toBe(false);
    });

    it('signs in an existing user without syncing when data matches', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue({
        user: { uid: 'user-123', email: 'test@example.com', displayName: 'Test User', photoURL: 'https://photo.url' },
      } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue({ accessToken: 'test-token' } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ userId: 'user-123', email: 'test@example.com', displayName: 'Test User', firstName: 'Test', lastName: 'User', photoURL: 'https://photo.url' }),
      });

      expect(await handleAuthRedirect()).toBe(true);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('syncs a changed photoURL for an existing user', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue({
        user: { uid: 'user-123', email: 'test@example.com', displayName: 'Test User', photoURL: 'https://new-photo.url' },
      } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue({ accessToken: 'test-token' } as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ userId: 'user-123', email: 'test@example.com', displayName: 'Test User', firstName: 'Test', lastName: 'User', photoURL: 'https://old-photo.url' }),
      });

      expect(await handleAuthRedirect()).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { photoURL: 'https://new-photo.url' });
    });

    it('syncs a changed name for an existing user', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue({
        user: { uid: 'user-123', email: 'test@example.com', displayName: 'New Name', photoURL: 'https://photo.url' },
      } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue(null as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ userId: 'user-123', email: 'test@example.com', displayName: 'Old Name', firstName: 'Old', lastName: 'Name', photoURL: 'https://photo.url' }),
      });

      expect(await handleAuthRedirect()).toBe(true);
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.firstName).toBe('New');
      expect(updates.lastName).toBe('Name');
      expect(updates.displayName).toBe('New Name');
    });

    it('syncs a changed email for an existing user', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue({
        user: { uid: 'user-123', email: 'NEW@example.com', displayName: 'Test User', photoURL: 'https://photo.url' },
      } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue(null as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ userId: 'user-123', email: 'old@example.com', displayName: 'Test User', firstName: 'Test', lastName: 'User', photoURL: 'https://photo.url' }),
      });

      expect(await handleAuthRedirect()).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { email: 'new@example.com' });
    });

    it('creates the profile and schedule sub-collections for a new user', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue({
        user: { uid: 'user-123', email: 'Test@Example.com', displayName: 'Test User', photoURL: 'https://photo.url' },
      } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue(null as any);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      expect(await handleAuthRedirect()).toBe(true);
      // profile + availableDays + blockedDates
      expect(mockSetDoc).toHaveBeenCalledTimes(3);
      // Email is normalized to lowercase on the created profile.
      const profileWrite = mockSetDoc.mock.calls[0][1];
      expect(profileWrite.email).toBe('test@example.com');
    });

    it('throws when Google returns no email or display name', async () => {
      const { getRedirectResult } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue({ user: { uid: 'user-123', displayName: 'Test User' } } as any);
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await expect(handleAuthRedirect()).rejects.toThrow('Google Sign-In did not return a valid email or display name.');
    });
  });

  describe('logout', () => {
    it('signs the user out', async () => {
      const { signOut } = await import('firebase/auth');
      await logout();
      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('subscribeToAuth', () => {
    it('registers the auth-state callback', async () => {
      const { onAuthStateChanged } = await import('firebase/auth');
      const callback = vi.fn();
      subscribeToAuth(callback);
      expect(onAuthStateChanged).toHaveBeenCalledWith(expect.anything(), callback);
    });
  });
});
