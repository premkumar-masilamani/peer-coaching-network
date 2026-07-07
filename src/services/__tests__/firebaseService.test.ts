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
  subscribeToBookings,
  subtractBusyIntervals,
  recalculateAvailableSlotsCache,
  updateVerifiedCredentials
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
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
   GoogleAuthProvider: class {
    addScope = vi.fn();
    setCustomParameters = vi.fn();
    static credentialFromResult = vi.fn();
  },
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
const { mockGetDoc, mockSetDoc, mockUpdateDoc, mockGetDocs, mockOnSnapshot, mockDeleteDoc, mockBatchSet, mockBatchDelete, mockBatchCommit } = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return {
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockOnSnapshot: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockBatchSet: vi.fn(),
    mockBatchDelete: vi.fn(),
    mockBatchCommit: vi.fn(() => Promise.resolve()),
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
    or: vi.fn((...conditions) => ({ type: 'or', conditions })),
    and: vi.fn((...conditions) => ({ type: 'and', conditions })),
    getDoc: mockGetDoc,
    setDoc: mockSetDoc,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    getDocs: mockGetDocs,
    onSnapshot: mockOnSnapshot,
    documentId: vi.fn(() => 'documentId'),
    writeBatch: vi.fn(() => ({
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    })),
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

  describe('Coach discovery and caching', () => {
    it('getUserAvailableSlots returns slot list if doc exists', async () => {
      const { getUserAvailableSlots } = await import('../firebaseService');
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ availableSlots: ['2026-07-01T10:00:00.000Z'] })
      });
      const result = await getUserAvailableSlots('user1');
      expect(result).toEqual(['2026-07-01T10:00:00.000Z']);
    });

    it('getProfiles returns matching user documents in chunks', async () => {
      const { getProfiles } = await import('../firebaseService');
      mockGetDocs.mockResolvedValueOnce({
        forEach: (cb: any) => {
          cb({ data: () => ({ userId: 'coach1', firstName: 'Alice' }) });
        }
      });
      const result = await getProfiles(['coach1']);
      expect(result.length).toBe(1);
      expect(result[0].firstName).toBe('Alice');
    });

    // Snapshot helper mirroring Firestore's forEach(doc => doc.data()) shape.
    const snap = (docs: any[]) => ({
      forEach: (cb: any) => docs.forEach((d) => cb({ data: () => d, ref: { id: `${d.coachUid}_${d.dateISO}` } })),
    });

    it('queryAvailableCoachesForDay reads coachDayAvailability shards by day and returns active coaches', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');

      // 1) day shards, 2) bookings, 3) profiles
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coach1', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], userStatus: 'active' },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([]));
      mockGetDocs.mockResolvedValueOnce(snap([
        { userId: 'coach1', userRole: 'user', userStatus: 'active', firstName: 'Alice', lastName: 'Smith' },
      ]));

      const slots = [{
        startTime: new Date('2026-07-01T10:00:00.000Z'),
        endTime: new Date('2026-07-01T11:00:00.000Z'),
      }];

      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-01T23:59:59Z'),
        slots,
        {},
        'seed',
        'client1'
      );

      // Asserts the discovery source is the shard collection queried by dateISO.
      const firstQueryCall = (mockGetDocs.mock.calls[0][0]) as any;
      expect(firstQueryCall.path).toBe('coachDayAvailability');
      expect(firstQueryCall.queries?.[0]).toEqual({ field: 'dateISO', op: 'in', val: ['2026-07-01'] });

      expect(result['2026-07-01T10:00:00.000Z']).toBeDefined();
      expect(result['2026-07-01T10:00:00.000Z'].length).toBe(1);
      expect(result['2026-07-01T10:00:00.000Z'][0].userId).toBe('coach1');
    });

    it('queryAvailableCoachesForDay excludes non-active coaches even with an availability shard', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');

      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'activeCoach', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'] },
        { coachUid: 'pendingCoach', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'] },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([])); // bookings
      mockGetDocs.mockResolvedValueOnce(snap([
        { userId: 'activeCoach', userRole: 'user', userStatus: 'active', firstName: 'Ada' },
        { userId: 'pendingCoach', userRole: 'user', userStatus: 'inactive', firstName: 'Peter' },
      ]));

      const slots = [{
        startTime: new Date('2026-07-01T10:00:00.000Z'),
        endTime: new Date('2026-07-01T11:00:00.000Z'),
      }];

      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-01T23:59:59Z'),
        slots,
        {},
        'seed',
        'client1'
      );

      // Only the active coach surfaces; the inactive/pending one is filtered out
      // despite having a valid shard.
      expect(result['2026-07-01T10:00:00.000Z'].map((c) => c.userId)).toEqual(['activeCoach']);
    });

    it('queryAvailableCoachesForDay excludes the current user and applies faceted filters in-memory', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');

      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'client1', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], gender: 'female' },
        { coachUid: 'coachM', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], gender: 'male' },
        { coachUid: 'coachF', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], gender: 'female' },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([])); // bookings
      mockGetDocs.mockResolvedValueOnce(snap([
        { userId: 'coachF', userRole: 'user', userStatus: 'active', firstName: 'Fiona' },
      ]));

      const slots = [{
        startTime: new Date('2026-07-01T10:00:00.000Z'),
        endTime: new Date('2026-07-01T11:00:00.000Z'),
      }];

      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-01T23:59:59Z'),
        slots,
        { gender: 'female' },
        'seed',
        'client1' // self, must be excluded even though female
      );

      // Only the profile fetch for the surviving candidate (coachF) should run.
      const profileQueryCall = (mockGetDocs.mock.calls[2][0]) as any;
      expect(profileQueryCall.queries?.[0]).toEqual({ field: 'documentId', op: 'in', val: ['coachF'] });
      expect(result['2026-07-01T10:00:00.000Z'].map((c) => c.userId)).toEqual(['coachF']);
    });

    it('queryAvailableCoachesForDay unions freeSlots across a coach\'s two UTC-date shards', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');

      // Local day spans two UTC dates → coach has two shards.
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coach1', dateISO: '2026-07-01', freeSlots: ['2026-07-01T23:00:00.000Z'] },
        { coachUid: 'coach1', dateISO: '2026-07-02', freeSlots: ['2026-07-02T00:00:00.000Z'] },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([])); // bookings
      mockGetDocs.mockResolvedValueOnce(snap([
        { userId: 'coach1', userRole: 'user', userStatus: 'active', firstName: 'Alice' },
      ]));

      const slots = [
        { startTime: new Date('2026-07-01T23:00:00.000Z'), endTime: new Date('2026-07-02T00:00:00.000Z') },
        { startTime: new Date('2026-07-02T00:00:00.000Z'), endTime: new Date('2026-07-02T01:00:00.000Z') },
      ];

      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-02T23:59:59Z'),
        slots,
        {},
        'seed',
        'client1'
      );

      expect(result['2026-07-01T23:00:00.000Z'][0].userId).toBe('coach1');
      expect(result['2026-07-02T00:00:00.000Z'][0].userId).toBe('coach1');
    });

    it('queryAvailableCoachesForDay rejects coaches by country and by credential filters', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');

      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'wrongCountry', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], country: 'US', icf_pcc: true },
        { coachUid: 'wrongCred', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], country: 'IN', icf_acc: true },
        { coachUid: 'match', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], country: 'IN', icf_pcc: true },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([])); // bookings
      mockGetDocs.mockResolvedValueOnce(snap([
        { userId: 'match', userRole: 'user', userStatus: 'active', firstName: 'Match' },
      ]));

      const slots = [{
        startTime: new Date('2026-07-01T10:00:00.000Z'),
        endTime: new Date('2026-07-01T11:00:00.000Z'),
      }];

      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-01T23:59:59Z'),
        slots,
        { country: 'IN', icf_pcc: true },
        'seed',
        'client1'
      );

      const profileQueryCall = (mockGetDocs.mock.calls[2][0]) as any;
      expect(profileQueryCall.queries?.[0].val).toEqual(['match']);
      expect(result['2026-07-01T10:00:00.000Z'].map((c) => c.userId)).toEqual(['match']);
    });

    it('queryAvailableCoachesForDay returns {} when no slots are requested', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');
      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-01T23:59:59Z'),
        [],
        {},
        'seed',
        'client1'
      );
      expect(result).toEqual({});
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('queryAvailableCoachesForDay returns {} when every candidate is filtered out', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coachM', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z'], gender: 'male' },
      ]));
      const slots = [{
        startTime: new Date('2026-07-01T10:00:00.000Z'),
        endTime: new Date('2026-07-01T11:00:00.000Z'),
      }];
      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-01T23:59:59Z'),
        slots,
        { gender: 'female' },
        'seed',
        'client1'
      );
      expect(result).toEqual({});
      // Short-circuits before the bookings/profile queries.
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    it('queryAvailableCoachesForDay drops a coach who has a confirmed booking at the slot', async () => {
      const { queryAvailableCoachesForDay } = await import('../firebaseService');
      const slotIso = '2026-07-01T10:00:00.000Z';

      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coach1', dateISO: '2026-07-01', freeSlots: [slotIso] },
      ]));
      // A confirmed booking for coach1 at the slot (dateTime shape).
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coach1', clientUid: 'someClient', startTime: { dateTime: slotIso } },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([
        { userId: 'coach1', userRole: 'user', userStatus: 'active', firstName: 'Alice' },
      ]));

      const slots = [{ startTime: new Date(slotIso), endTime: new Date('2026-07-01T11:00:00.000Z') }];
      const result = await queryAvailableCoachesForDay(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-01T23:59:59Z'),
        slots,
        {},
        'seed',
        'client1'
      );
      expect(result[slotIso]).toEqual([]);
    });
  });

  describe('subtractBusyIntervals', () => {
    const HOUR = 60 * 60 * 1000;
    const slot = '2026-07-01T10:00:00.000Z';
    const slotStart = new Date(slot).getTime();

    it('returns all slots unchanged when there are no busy intervals', () => {
      expect(subtractBusyIntervals([slot], [])).toEqual([slot]);
    });

    it('removes a slot that overlaps a busy interval', () => {
      const busy = [{ start: slotStart + 15 * 60 * 1000, end: slotStart + 45 * 60 * 1000 }];
      expect(subtractBusyIntervals([slot], busy)).toEqual([]);
    });

    it('keeps a slot when a busy interval only abuts it (no overlap)', () => {
      const busy = [{ start: slotStart + HOUR, end: slotStart + 2 * HOUR }]; // starts exactly at slot end
      expect(subtractBusyIntervals([slot], busy)).toEqual([slot]);
    });

    it('removes only the overlapping slots from a set', () => {
      const slotA = '2026-07-01T10:00:00.000Z';
      const slotB = '2026-07-01T12:00:00.000Z';
      const busy = [{ start: new Date(slotB).getTime(), end: new Date(slotB).getTime() + HOUR }];
      expect(subtractBusyIntervals([slotA, slotB], busy)).toEqual([slotA]);
    });
  });

  describe('recalculateAvailableSlotsCache', () => {
    const enabledDay = { enabled: true, slots: [{ startTime: timeStringToTimestamp('10:00 AM'), endTime: timeStringToTimestamp('11:00 AM') }] };
    const allDaysEnabled = {
      sunday: enabledDay, monday: enabledDay, tuesday: enabledDay, wednesday: enabledDay,
      thursday: enabledDay, friday: enabledDay, saturday: enabledDay,
    };

    it('writes the aggregate cache and per-day shards, and deletes stale shards', async () => {
      // getDoc order: user profile, availableDays, blockedDates
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', gender: 'female', country: 'IN', userStatus: 'active', icf_acc: true }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => allDaysEnabled });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      // existing shards: one stale date that must be deleted
      mockGetDocs.mockResolvedValueOnce({
        forEach: (cb: any) => cb({ data: () => ({ coachUid: 'coach-recalc', dateISO: '2000-01-01' }), ref: { id: 'coach-recalc_2000-01-01' } }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      await recalculateAvailableSlotsCache('coach-recalc');

      // Aggregate cache written with denormalized filter fields.
      const aggCall = mockSetDoc.mock.calls.find((c) => (c[0] as any).path?.startsWith('availableSlotsCache'));
      expect(aggCall).toBeDefined();
      expect((aggCall![1] as any).gender).toBe('female');
      expect(Array.isArray((aggCall![1] as any).availableSlots)).toBe(true);

      // One shard per active day was set with a "{uid}_{dateISO}" ref id.
      expect(mockBatchSet).toHaveBeenCalled();
      const firstShard = mockBatchSet.mock.calls[0];
      expect((firstShard[0] as any).id).toMatch(/^coach-recalc_\d{4}-\d{2}-\d{2}$/);
      expect((firstShard[1] as any).coachUid).toBe('coach-recalc');
      expect((firstShard[1] as any).gender).toBe('female');

      // The stale shard was deleted and the batch committed.
      expect(mockBatchDelete).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('does not throw and skips writes when the user document is missing', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await expect(recalculateAvailableSlotsCache('missing-user')).resolves.toBeUndefined();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });

  describe('updateVerifiedCredentials', () => {
    it('persists credentials and triggers a cache recalculation', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      // Make the fire-and-forget recalc a clean no-op (user doc "missing").
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await updateVerifiedCredentials('coach-cred', [{ level: 'ACC' } as any], ['ICF ACC']);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updates = mockUpdateDoc.mock.calls[0][1] as any;
      expect(updates.icfCredentials).toEqual([{ level: 'ACC' }]);
      expect(updates.icf_acc).toBe(true);
      expect(updates.icf_pcc).toBe(false);
    });
  });
});

