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
  recalculateUserBusySlotsCache,
  timeStringToTimestamp,
  timestampToTimeString,
  loginWithGoogle,
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
import { Timestamp } from 'firebase/firestore';
import { logEvent } from '../loggingService';

// Mock all Firebase modules before importing
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock('../loggingService', () => ({
  initializeLogger: vi.fn(),
  logEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  connectAuthEmulator: vi.fn(),
  signInWithPopup: vi.fn(),
   GoogleAuthProvider: class {
    addScope = vi.fn();
    static credentialFromResult() {
      return { accessToken: 'mock-access-token' };
    }
  },
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
const { mockGetDoc, mockSetDoc, mockUpdateDoc, mockGetDocs, mockOnSnapshot } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockOnSnapshot: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn((_db, col, ...paths) => ({ id: paths[paths.length - 1] || col, path: `${col}/${paths.join('/')}` })),
  collection: vi.fn((_db, col) => ({ id: col, path: col })),
  query: vi.fn((col, ...queries) => ({ id: col.id, path: col.path, queries })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  getDocs: mockGetDocs,
  onSnapshot: mockOnSnapshot,
  documentId: vi.fn(() => 'documentId'),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date('2026-06-18T00:00:00Z'), seconds: 1776518400 })),
    fromDate: vi.fn((date) => ({ toDate: () => date, seconds: date.getTime() / 1000 })),
  },
}));

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

  describe('recalculateUserBusySlotsCache', () => {
    it('computes slot availability and caches list in busySlotsCache', async () => {
      // Mock user document
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/user-123') {
          return {
            exists: () => true,
            data: () => ({
              userId: 'user-123',
              displayName: 'John Coach',
              timezone: 'America/New_York',
            }),
          };
        }
        if (ref.path === 'users/user-123/schedule/availableDays') {
          return {
            exists: () => true,
            data: () => ({
              monday: {
                enabled: true,
                slots: [
                  { startTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 9, 0)) }, endTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 10, 0)) } },
                  { startTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 11, 0)) }, endTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 12, 0)) } }
                ]
              },
            }),
          };
        }
        if (ref.path === 'users/user-123/schedule/blockedDates') {
          return {
            exists: () => true,
            data: () => ({ blockedDates: ['2026-06-22'] }), // Assume this Monday is blocked
          };
        }
        // Cache exists checks
        if (ref.path === 'busySlotsCache/user-123') {
          return {
            exists: () => false,
          };
        }
        return { exists: () => false };
      });

      mockGetDocs.mockResolvedValue({
        forEach: (cb: any) => {
          // 1. Confirmed active booking
          cb({
            data: () => ({
              bookingId: 'booking-active-1',
              status: 'confirmed',
              startTime: '2026-06-25T14:00:00Z',
              endTime: '2026-06-25T15:00:00Z',
            })
          });
          // 2. Cancelled booking
          cb({
            data: () => ({
              bookingId: 'booking-cancelled-1',
              status: 'cancelled',
              startTime: '2026-06-25T16:00:00Z',
              endTime: '2026-06-25T17:00:00Z',
            })
          });
          // 3. Finished booking
          cb({
            data: () => ({
              bookingId: 'booking-finished-1',
              status: 'confirmed',
              startTime: '2026-06-10T10:00:00Z',
              endTime: '2026-06-10T11:00:00Z',
            })
          });
        },
      });

      mockSetDoc.mockResolvedValue(undefined);

      await recalculateUserBusySlotsCache('user-123');

      // The busySlotsCache document setDoc should have been called
      expect(mockSetDoc).toHaveBeenCalled();
      const cachedData = mockSetDoc.mock.calls[0][1];
      expect(cachedData.userId).toBe('user-123');
      expect(Array.isArray(cachedData.busySlots)).toBe(true);
    });

    it('handles recalculation when user does not exist by returning early', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await recalculateUserBusySlotsCache('non-existent');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('skips writing if existing cache is identical', async () => {
      let calculatedSlots: any[] = [];
      mockSetDoc.mockImplementationOnce((_ref: any, data: any) => {
        calculatedSlots = data.busySlots;
        return Promise.resolve();
      });

      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/user-123') {
          return {
            exists: () => true,
            data: () => ({ userId: 'user-123', timezone: 'America/New_York' }),
          };
        }
        if (ref.path === 'users/user-123/schedule/availableDays') {
          return { exists: () => true, data: () => ({ monday: { enabled: false } }) };
        }
        if (ref.path === 'users/user-123/schedule/blockedDates') {
          return { exists: () => true, data: () => ({ blockedDates: [] }) };
        }
        if (ref.path === 'busySlotsCache/user-123') {
          return {
            exists: () => false,
          };
        }
        return { exists: () => false };
      });

      mockGetDocs.mockResolvedValue({ forEach: () => {} });

      await recalculateUserBusySlotsCache('user-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      mockSetDoc.mockClear();

      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/user-123') {
          return {
            exists: () => true,
            data: () => ({ userId: 'user-123', timezone: 'America/New_York' }),
          };
        }
        if (ref.path === 'users/user-123/schedule/availableDays') {
          return { exists: () => true, data: () => ({ monday: { enabled: false } }) };
        }
        if (ref.path === 'users/user-123/schedule/blockedDates') {
          return { exists: () => true, data: () => ({ blockedDates: [] }) };
        }
        if (ref.path === 'busySlotsCache/user-123') {
          return {
            exists: () => true,
            data: () => ({ busySlots: calculatedSlots }),
          };
        }
        return { exists: () => false };
      });

      await recalculateUserBusySlotsCache('user-123');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('writes cache if existing cache has same length but different slots', async () => {
      let calculatedSlots: any[] = [];
      mockSetDoc.mockImplementationOnce((_ref: any, data: any) => {
        calculatedSlots = data.busySlots;
        return Promise.resolve();
      });

      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/user-123') {
          return {
            exists: () => true,
            data: () => ({ userId: 'user-123', timezone: 'America/New_York' }),
          };
        }
        if (ref.path === 'users/user-123/schedule/availableDays') {
          return { exists: () => true, data: () => ({ monday: { enabled: false } }) };
        }
        if (ref.path === 'users/user-123/schedule/blockedDates') {
          return { exists: () => true, data: () => ({ blockedDates: [] }) };
        }
        if (ref.path === 'busySlotsCache/user-123') {
          return {
            exists: () => false,
          };
        }
        return { exists: () => false };
      });

      mockGetDocs.mockResolvedValue({ forEach: () => {} });

      await recalculateUserBusySlotsCache('user-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      mockSetDoc.mockClear();

      const modifiedSlots = [...calculatedSlots];
      if (modifiedSlots.length > 0) {
        modifiedSlots[0] = { ...modifiedSlots[0], end: '2026-12-31T23:59:59Z' };
      }

      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/user-123') {
          return {
            exists: () => true,
            data: () => ({ userId: 'user-123', timezone: 'America/New_York' }),
          };
        }
        if (ref.path === 'users/user-123/schedule/availableDays') {
          return { exists: () => true, data: () => ({ monday: { enabled: false } }) };
        }
        if (ref.path === 'users/user-123/schedule/blockedDates') {
          return { exists: () => true, data: () => ({ blockedDates: [] }) };
        }
        if (ref.path === 'busySlotsCache/user-123') {
          return {
            exists: () => true,
            data: () => ({ busySlots: modifiedSlots }),
          };
        }
        return { exists: () => false };
      });

      await recalculateUserBusySlotsCache('user-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    it('throws and logs error on recalculation failure', async () => {
      mockGetDoc.mockRejectedValue(new Error('DB connection lost'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(recalculateUserBusySlotsCache('user-123')).rejects.toThrow('DB connection lost');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(logEvent).toHaveBeenCalledWith('error', 'recalculation_failure', {
        userId: 'user-123',
        error: 'DB connection lost'
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe('loginWithGoogle', () => {
    it('logs in an existing user whose photoURL matches', async () => {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://photo.url',
      };
      vi.mocked(signInWithPopup).mockResolvedValue({ user: mockUser } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue({ accessToken: 'test-token' } as any);

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: 'https://photo.url',
        }),
      });

      const res = await loginWithGoogle();
      expect(res.user.uid).toBe('user-123');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('logs in an existing user and syncs photoURL if mismatched', async () => {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://new-photo.url',
      };
      vi.mocked(signInWithPopup).mockResolvedValue({ user: mockUser } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue({ accessToken: 'test-token' } as any);

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: 'https://old-photo.url',
        }),
      });

      const res = await loginWithGoogle();
      expect(res.user.uid).toBe('user-123');
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { photoURL: 'https://new-photo.url' });
    });

    it('creates profile and sub-collections for a new user', async () => {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://photo.url',
      };
      vi.mocked(signInWithPopup).mockResolvedValue({ user: mockUser } as any);
      vi.spyOn(GoogleAuthProvider, 'credentialFromResult').mockReturnValue(null);

      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const res = await loginWithGoogle();
      expect(res.user.uid).toBe('user-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(3); // profile + availableDays + blockedDates
    });

    it('throws error if email or displayName is missing', async () => {
      const { signInWithPopup } = await import('firebase/auth');
      const mockUser = {
        uid: 'user-123',
        displayName: 'Test User',
      };
      vi.mocked(signInWithPopup).mockResolvedValue({ user: mockUser } as any);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(loginWithGoogle()).rejects.toThrow('Google Sign-In did not return a valid email or display name.');
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
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      errCb(new Error('Snap error'));
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('emulator connection error handling', () => {
    it('logs error if connectAuthEmulator throws', async () => {
      vi.resetModules();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { connectAuthEmulator } = await import('firebase/auth');
      vi.mocked(connectAuthEmulator).mockImplementationOnce(() => {
        throw new Error('Emulator connection failed');
      });

      if (typeof window !== 'undefined') {
        window._firebase_emulators_connected = false;
      }

      await import('../firebaseService');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to connect to emulators:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Firebase configuration validation', () => {
    it('logs error in dev mode if config is missing and emulator is disabled', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', 'false');
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
      vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
      vi.stubEnv('VITE_FIREBASE_APP_ID', '');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await import('../firebaseService');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      vi.unstubAllEnvs();
    });
  });
});
