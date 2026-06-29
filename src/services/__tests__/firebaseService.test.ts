/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  formatDisplayName,
  formatMemberSince,
  isFirebaseConfigured,
  getEffectiveStatus,
  getEffectiveRole,
  isApproved,
  updateOwnProfile,
  timeStringToTimestamp,
  timestampToTimeString,
  handleAuthRedirect,
  logout,
  subscribeToAuth,
  subscribeToProfile,
  updateProfile,
  subscribeToAllUsers,
  subscribeToActiveCoaches,
  subscribeToPendingUsersCount,
  setUserRoleAndStatus,
  getSchedule,
  updateSchedule,
  subscribeToBookings
} from '../firebaseService';
import { logEvent } from 'firebase/analytics';
import { Timestamp } from 'firebase/firestore';
import { logger } from '../../utils/logger';

// Mock all Firebase modules before importing
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  logEvent: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    telemetry: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  connectAuthEmulator: vi.fn(),
  signInWithPopup: vi.fn(),
   GoogleAuthProvider: class {
    addScope = vi.fn();
    setCustomParameters = vi.fn();
    static credentialFromResult() {
      return { accessToken: 'mock-access-token' };
    }
  },
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
const { mockGetDoc, mockSetDoc, mockUpdateDoc, mockGetDocs, mockOnSnapshot, mockDeleteDoc } = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return {
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockOnSnapshot: vi.fn(),
    mockDeleteDoc: vi.fn(),
  };
});
vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    toDate() { return new Date(this.seconds * 1000); }
    toMillis() { return this.seconds * 1000; }
    static now = vi.fn(() => new MockTimestamp(1776518400, 0));
    static fromDate = vi.fn((date) => new MockTimestamp(date.getTime() / 1000, 0));
  }

  return {
    getFirestore: vi.fn(() => ({})),
    connectFirestoreEmulator: vi.fn(),
    doc: vi.fn((_db, col, ...paths) => ({ id: paths[paths.length - 1] || col, path: `${col}/${paths.join('/')}` })),
    collection: vi.fn((_db, col) => ({ id: col, path: col })),
    query: vi.fn((col, ...queries) => ({ id: col.id, path: col.path, queries })),
    where: vi.fn((field, op, val) => ({ field, op, val })),
    getDoc: mockGetDoc,
    setDoc: mockSetDoc,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    getDocs: mockGetDocs,
    onSnapshot: mockOnSnapshot,
    documentId: vi.fn(() => 'documentId'),
    Timestamp: MockTimestamp,
  };
});

describe('firebaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFirebaseConfigured', () => {
    it('is configured under mock emulator setting', () => {
      expect(isFirebaseConfigured).toBe(true);
    });
  });

  describe('formatDisplayName', () => {
    it('formats normal display names', () => {
      expect(formatDisplayName({ displayName: 'John Doe' })).toBe('John Doe');
    });

    it('strips parentheses content and trailing whitespace', () => {
      expect(formatDisplayName({ displayName: 'John Doe (Coach)' })).toBe('John Doe');
      expect(formatDisplayName({ displayName: ' Jane Doe (MCC)  ' })).toBe('Jane Doe');
    });

    it('handles empty or missing display names', () => {
      expect(formatDisplayName(null)).toBe('');
      expect(formatDisplayName(undefined)).toBe('');
      expect(formatDisplayName({ displayName: null })).toBe('');
    });
  });

  describe('formatMemberSince', () => {
    it('returns empty string if createdAt is null or undefined', () => {
      expect(formatMemberSince(null)).toBe('');
      expect(formatMemberSince(undefined)).toBe('');
    });

    it('handles Firestore Timestamp objects', () => {
      const mockDate = new Date('2026-06-18T00:00:00Z');
      const mockTimestamp = {
        toDate: () => mockDate,
        seconds: mockDate.getTime() / 1000,
        nanoseconds: 0
      } as unknown as Timestamp;

      expect(formatMemberSince(mockTimestamp)).toBe('June 2026');
    });

    it('handles ISO string dates', () => {
      expect(formatMemberSince('2026-06-18T00:00:00Z')).toBe('June 2026');
    });

    it('falls back to string conversion for unparseable formats', () => {
      expect(formatMemberSince('not-a-date')).toBe('not-a-date');
    });
  });

  describe('role and approval status getters', () => {
    const activeCoachProfile = {
      userId: '1',
      email: 'coach@example.com',
      displayName: 'Coach Name',
      userRole: 'admin' as const,
      userStatus: 'active' as const,
    } as any;

    it('getEffectiveStatus returns inactive by default', () => {
      expect(getEffectiveStatus(null)).toBe('inactive');
      expect(getEffectiveStatus(activeCoachProfile)).toBe('active');
    });

    it('getEffectiveRole returns user by default', () => {
      expect(getEffectiveRole(null)).toBe('user');
      expect(getEffectiveRole(activeCoachProfile)).toBe('admin');
    });

    it('isApproved returns true only for active users', () => {
      expect(isApproved(null)).toBe(false);
      expect(isApproved(activeCoachProfile)).toBe(true);
      expect(isApproved({ userStatus: 'inactive' } as any)).toBe(false);
    });
  });

  describe('time and timestamp conversion', () => {
    it('timeStringToTimestamp converts local time to standard UTC timestamp', () => {
      const ts = timeStringToTimestamp('10:00 AM');
      expect(ts.toDate().getUTCHours()).toBe(10);
      expect(ts.toDate().getUTCMinutes()).toBe(0);
    });

    it('timestampToTimeString converts standard UTC timestamp to local time string', () => {
      const date = new Date(Date.UTC(1970, 0, 1, 14, 30));
      const ts = { toDate: () => date } as Timestamp;
      expect(timestampToTimeString(ts)).toBe('2:30 PM');
    });
  });

  describe('updateOwnProfile', () => {
    it('updates only safe fields and filters out privileged admin fields', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const updates = {
        displayName: 'New Name',
        bio: 'New Bio',
        userRole: 'admin', // Privileged field — should be stripped!
        userStatus: 'active', // Privileged field — should be stripped!
        qualifications: ['ICF MCC'] // Privileged field — should be stripped!
      } as any;

      await updateOwnProfile('user-id-123', updates);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const calledUpdates = mockUpdateDoc.mock.calls[0][1];
      expect(calledUpdates.displayName).toBe('New Name');
      expect(calledUpdates.bio).toBe('New Bio');
      expect(calledUpdates.userRole).toBeUndefined();
      expect(calledUpdates.userStatus).toBeUndefined();
      expect(calledUpdates.qualifications).toBeUndefined();
    });

    it('skips updateDoc if no safe fields are changed', async () => {
      await updateOwnProfile('user-id-123', { userRole: 'admin' } as any);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle', () => {
    it('returns false if no redirect result', async () => {
      const { getRedirectResult } = await import('firebase/auth');
      vi.mocked(getRedirectResult).mockResolvedValue(null);
      const res = await handleAuthRedirect();
      expect(res).toBe(false);
    });

    it('logs in an existing user and does not sync if data matches', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://photo.url',
      };
      vi.mocked(getRedirectResult).mockResolvedValue({ user: mockUser } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue({ accessToken: 'test-token' } as any);

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          photoURL: 'https://photo.url',
        }),
      });

      const res = await handleAuthRedirect();
      expect(res).toBe(true);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('logs in an existing user and syncs photoURL if mismatched', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://new-photo.url',
      };
      vi.mocked(getRedirectResult).mockResolvedValue({ user: mockUser } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue({ accessToken: 'test-token' } as any);

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          firstName: 'Test',
          lastName: 'User',
          photoURL: 'https://old-photo.url',
        }),
      });

      const res = await handleAuthRedirect();
      expect(res).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { photoURL: 'https://new-photo.url' });
    });

    it('creates profile and sub-collections for a new user', async () => {
      const { getRedirectResult, GoogleAuthProvider } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://photo.url',
      };
      vi.mocked(getRedirectResult).mockResolvedValue({ user: mockUser } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue(null);

      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const res = await handleAuthRedirect();
      expect(res).toBe(true);
      expect(mockSetDoc).toHaveBeenCalledTimes(3); // profile + availableDays + blockedDates
    });

    it('throws error if email or displayName is missing', async () => {
      const { getRedirectResult } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        displayName: 'Test User',
      };
      vi.mocked(getRedirectResult).mockResolvedValue({ user: mockUser } as any);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(handleAuthRedirect()).rejects.toThrow('Google Sign-In did not return a valid email or display name.');
    });
  });

  describe('logout', () => {
    it('clears token and signs out', async () => {
      const { signOut } = await import('firebase/auth');
      await logout();
      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('subscribeToAuth', () => {
    it('sets up auth subscription callback', async () => {
      const { onAuthStateChanged } = await import('firebase/auth');
      const callback = vi.fn();
      subscribeToAuth(callback);
      expect(onAuthStateChanged).toHaveBeenCalledWith(expect.anything(), callback);
    });
  });

  describe('subscribeToProfile', () => {
    it('calls callback with profile if exists', () => {
      mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
        cb({
          exists: () => true,
          data: () => ({ userId: 'user-123', displayName: 'Jane' })
        });
        return () => {};
      });

      const callback = vi.fn();
      subscribeToProfile('user-123', callback);
      expect(callback).toHaveBeenCalledWith({ userId: 'user-123', displayName: 'Jane' });
    });

    it('calls callback with null if doc does not exist', () => {
      mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
        cb({
          exists: () => false
        });
        return () => {};
      });

      const callback = vi.fn();
      subscribeToProfile('user-123', callback);
      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('updateProfile', () => {
    it('calls updateDoc directly', async () => {
      await updateProfile('user-123', { bio: 'hello' });
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { bio: 'hello' });
    });
  });

  describe('subscribeToAllUsers', () => {
    it('maps snapshot querySnap to users array', () => {
      mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
        cb({
          forEach: (forEachCb: any) => {
            forEachCb({ data: () => ({ userId: 'user-1' }) });
            forEachCb({ data: () => ({ userId: 'user-2' }) });
          }
        });
        return () => {};
      });

      const callback = vi.fn();
      subscribeToAllUsers(callback);
      expect(callback).toHaveBeenCalledWith([{ userId: 'user-1' }, { userId: 'user-2' }]);
    });
  });

  describe('subscribeToActiveCoaches', () => {
    it('queries active coaches and runs callback', () => {
      mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
        cb({
          forEach: (forEachCb: any) => {
            forEachCb({ data: () => ({ userId: 'user-active' }) });
          }
        });
        return () => {};
      });

      const callback = vi.fn();
      subscribeToActiveCoaches(callback);
      expect(callback).toHaveBeenCalledWith([{ userId: 'user-active' }]);
    });
  });

  describe('subscribeToPendingUsersCount', () => {
    it('passes size to callback', () => {
      mockOnSnapshot.mockImplementation((_ref: any, cb: any) => {
        cb({ size: 5 });
        return () => {};
      });

      const callback = vi.fn();
      subscribeToPendingUsersCount(callback);
      expect(callback).toHaveBeenCalledWith(5);
    });
  });

  describe('setUserRoleAndStatus', () => {
    it('updates userStatus and userRole', async () => {
      await setUserRoleAndStatus('user-123', 'admin', 'active');
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        userRole: 'admin',
        userStatus: 'active'
      });
    });
  });

  describe('getSchedule', () => {
    it('fetches schedule docs and falls back if they do not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      const sched = await getSchedule('user-123');
      expect(sched.availableDays).toBeDefined();
      expect(sched.blockedDates).toEqual([]);
    });

    it('returns custom schedule if they exist', async () => {
      mockGetDoc.mockImplementation(async (_ref: any) => {
        if (_ref.path.endsWith('availableDays')) {
          return { exists: () => true, data: () => ({ monday: { enabled: true } }) };
        }
        return { exists: () => true, data: () => ({ blockedDates: ['2026-06-25'] }) };
      });
      const sched = await getSchedule('user-123');
      expect(sched.availableDays).toEqual({ monday: { enabled: true } });
      expect(sched.blockedDates).toEqual(['2026-06-25']);
    });
  });

  describe('updateSchedule', () => {
    it('updates availableDays and blockedDates', async () => {
      await updateSchedule('user-123', { monday: { enabled: true } } as any, ['2026-06-25']);
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribeToBookings', () => {
    it('subscribes to bookings and handles snap / error callbacks', () => {
      let snapCb: any;
      let errCb: any;
      mockOnSnapshot.mockImplementation((_q: any, cb: any, err: any) => {
        snapCb = cb;
        errCb = err;
        return () => {};
      });

      const callback = vi.fn();
      subscribeToBookings(callback);

      // Trigger success callback
      snapCb({
        forEach: (forEachCb: any) => {
          forEachCb({ data: () => ({ bookingId: 'b-1' }) });
        }
      });
      expect(callback).toHaveBeenCalledWith([{ bookingId: 'b-1' }]);

      // Trigger error callback (should log error, not throw)
      errCb(new Error('Snap error'));
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('emulator connection error handling', () => {
    it('logs error if connectAuthEmulator throws', async () => {
      vi.resetModules();
      vi.mocked(logger.error).mockClear();
      const { connectAuthEmulator } = await import('firebase/auth');
      vi.mocked(connectAuthEmulator).mockImplementationOnce(() => {
        throw new Error('Emulator connection failed');
      });

      if (typeof window !== 'undefined') {
        window._firebase_emulators_connected = false;
      }

      await import('../firebaseService');

      expect(logger.error).toHaveBeenCalledWith('Failed to connect to emulators:', expect.any(Error));
    });
  });

  describe('Firebase configuration validation', () => {
    it('logs error in dev mode if config is missing and emulator is disabled', async () => {
      vi.resetModules();
      vi.mocked(logger.error).mockClear();
      vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', 'false');
      vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', 'pcn-dev');
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
      vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
      vi.stubEnv('VITE_FIREBASE_APP_ID', '');

      await import('../firebaseService');

      expect(logger.error).toHaveBeenCalled();
      vi.unstubAllEnvs();
    });
  });

  describe('logAnalyticsEvent', () => {
    it('behaves as a safe no-op when VITE_FIREBASE_MEASUREMENT_ID is missing', async () => {
      vi.resetModules();
      vi.mocked(logEvent).mockClear();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', '');

      const { logAnalyticsEvent } = await import('../firebaseService');
      logAnalyticsEvent('test_event', { foo: 'bar' });

      expect(logEvent).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it('logs event using firebase analytics logEvent when VITE_FIREBASE_MEASUREMENT_ID is present', async () => {
      vi.resetModules();
      vi.mocked(logEvent).mockClear();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TESTID123');

      const { logAnalyticsEvent } = await import('../firebaseService');
      logAnalyticsEvent('test_event', { foo: 'bar' });

      expect(logEvent).toHaveBeenCalledWith(expect.any(Object), 'test_event', { foo: 'bar' });
      vi.unstubAllEnvs();
    });

    it('logs error if logEvent throws an error', async () => {
      vi.resetModules();
      vi.mocked(logEvent).mockClear();
      vi.mocked(logger.error).mockClear();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TESTID123');
      vi.mocked(logEvent).mockImplementationOnce(() => {
        throw new Error('Analytics failed');
      });

      const { logAnalyticsEvent } = await import('../firebaseService');
      logAnalyticsEvent('test_event', { foo: 'bar' });

      expect(logger.error).toHaveBeenCalledWith(
        '[Analytics] Failed to log event "test_event":',
        expect.any(Error)
      );
      vi.unstubAllEnvs();
    });
  });
});

