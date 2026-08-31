// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.VITE_FIRESTORE_DATABASE_ID = 'pcn-test-db';
process.env.VITE_FIREBASE_REGION = 'asia-south1';
process.env.VITE_FIREBASE_PROJECT_ID = 'pcn-test-project';

const {
  mockFirestoreDocGet,
  mockFirestoreQueryGet,
  mockFirestoreSet,
  mockFirestoreUpdate,
  mockFirestoreDelete,
  mockFirestoreAdd,
  mockTransactionGet,
  mockTransactionSet,
  mockTransactionUpdate,
  mockRunTransaction,
  mockFetch,
} = vi.hoisted(() => ({
  mockFirestoreDocGet: vi.fn(),
  mockFirestoreQueryGet: vi.fn(),
  mockFirestoreSet: vi.fn(),
  mockFirestoreUpdate: vi.fn(),
  mockFirestoreDelete: vi.fn(),
  mockFirestoreAdd: vi.fn().mockResolvedValue({ id: 'added-id' }),
  mockTransactionGet: vi.fn(),
  mockTransactionSet: vi.fn(),
  mockTransactionUpdate: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);

// Mock firebase-admin
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => [{ name: '[DEFAULT]' }]),
}));

vi.mock('firebase-admin/firestore', () => {
  const createDocMock = (docId?: string) => {
    const docObj: Record<string, unknown> = {
      id: docId || 'generated-id',
      get: (...args: unknown[]) => mockFirestoreDocGet(docId, ...args),
      set: mockFirestoreSet,
      update: mockFirestoreUpdate,
      delete: mockFirestoreDelete,
    };
    docObj.collection = vi.fn((subCollName: string) => createCollectionMock(subCollName));
    return docObj;
  };

  const createCollectionMock = (collName: string) => {
    const coll: Record<string, unknown> = {
      doc: vi.fn((docId?: string) => createDocMock(docId)),
      add: mockFirestoreAdd,
      get: (...args: unknown[]) => mockFirestoreQueryGet(collName, ...args),
    };
    coll.where = vi.fn(() => coll);
    coll.limit = vi.fn(() => coll);
    coll.startAfter = vi.fn(() => coll);
    return coll;
  };

  const firestoreObj = () => ({
    collection: vi.fn((collName: string) => createCollectionMock(collName)),
    runTransaction: mockRunTransaction,
  });

  class MockTimestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds = 0, nanoseconds = 0) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
    }
    static now() {
      const sec = Math.floor(Date.now() / 1000);
      return new MockTimestamp(sec, 0);
    }
    static fromDate(d: Date) {
      return new MockTimestamp(Math.floor(d.getTime() / 1000), 0);
    }
  }

  return {
    getFirestore: vi.fn(firestoreObj),
    FieldValue: {
      serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
    },
    Timestamp: MockTimestamp,
  };
});

vi.mock('firebase-functions/v1', () => ({
  region: vi.fn(() => ({
    https: {
      onCall: (handler: unknown) => {
        return handler;
      },
    },
    pubsub: {
      schedule: () => ({
        timeZone: () => ({
          onRun: (handler: unknown) => handler,
        }),
      }),
    },
  })),
  https: {
    HttpsError: class HttpsError extends Error {
      code: string;
      details?: unknown;
      constructor(code: string, message: string, details?: unknown) {
        super(message);
        this.code = code;
        this.details = details;
      }
    },
  },
}));

describe('Cloud Functions (functions/src/index.ts)', () => {
  let indexModule: typeof import('../../src/index');

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockRunTransaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => {
      return cb({
        get: mockTransactionGet,
        set: mockTransactionSet,
        update: mockTransactionUpdate,
      });
    });

    indexModule = await import('../../src/index');
  });

  describe('manageBooking - Action: book', () => {
    it('rejects unauthenticated requests with unauthenticated error', async () => {
      const context = { auth: null };
      const data = { action: 'book', coachUid: 'c-1', startIso: '2026-09-01T10:00:00Z', endIso: '2026-09-01T10:30:00Z', topic: 'Hello' };

      await expect((indexModule.manageBooking as (d: unknown, c: unknown) => Promise<unknown>)(data, context)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects invalid ISO dates with invalid-argument error', async () => {
      const context = { auth: { uid: 'client-1', token: { email: 'client@example.com' } } };
      const data = { action: 'book', coachUid: 'c-1', startIso: 'invalid-date', endIso: 'invalid-date', topic: 'Hello' };

      await expect((indexModule.manageBooking as (d: unknown, c: unknown) => Promise<unknown>)(data, context)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects booking duration greater than max allowed duration (60 mins)', async () => {
      const context = { auth: { uid: 'client-1', token: { email: 'client@example.com' } } };
      const data = {
        action: 'book',
        coachUid: 'c-1',
        startIso: '2026-09-01T10:00:00.000Z',
        endIso: '2026-09-01T12:00:00.000Z', // 120 mins
        topic: 'Test topic',
      };

      await expect((indexModule.manageBooking as (d: unknown, c: unknown) => Promise<unknown>)(data, context)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('rejects topic exceeding max length character limits', async () => {
      const context = { auth: { uid: 'client-1', token: { email: 'client@example.com' } } };
      const data = {
        action: 'book',
        coachUid: 'c-1',
        startIso: '2026-09-01T10:00:00.000Z',
        endIso: '2026-09-01T10:30:00.000Z',
        topic: 'A'.repeat(2501),
      };

      await expect((indexModule.manageBooking as (d: unknown, c: unknown) => Promise<unknown>)(data, context)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    it('prevents double-booking via transactional booking collision check', async () => {
      const context = { auth: { uid: 'client-1', token: { email: 'client@example.com' } } };
      const data = {
        action: 'book',
        coachUid: 'coach-1',
        startIso: '2026-09-01T10:00:00.000Z',
        endIso: '2026-09-01T10:30:00.000Z',
        topic: 'Leadership Coaching',
      };

      mockFirestoreDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ email: 'coach@example.com', timezone: 'UTC' }) }) // coach user
        .mockResolvedValueOnce({ exists: true, data: () => ({ availableDays: {}, blockedDates: [] }) }); // coach schedule

      // Mock existing booking in transaction
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'confirmed' }),
      });

      await expect((indexModule.manageBooking as (d: unknown, c: unknown) => Promise<unknown>)(data, context)).rejects.toMatchObject({
        code: 'already-exists',
      });
    });

    it('handles Google Calendar API creation error and aborts booking', async () => {
      const context = { auth: { uid: 'client-1', token: { email: 'client@example.com' } } };
      const data = {
        action: 'book',
        coachUid: 'coach-1',
        startIso: '2026-09-01T10:00:00.000Z',
        endIso: '2026-09-01T10:30:00.000Z',
        topic: 'Feedback Practice',
        googleAccessToken: 'invalid-token',
      };

      mockFirestoreDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ email: 'coach@example.com', timezone: 'UTC' }) }) // coach user
        .mockResolvedValueOnce({ exists: true, data: () => ({ availableDays: {}, blockedDates: [] }) }); // coach schedule

      // Mock Google Calendar insert failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid Credentials' } }),
      });

      await expect((indexModule.manageBooking as (d: unknown, c: unknown) => Promise<unknown>)(data, context)).rejects.toMatchObject({
        code: 'internal',
      });
    });
  });

  describe('manageBooking - Action: cancel', () => {
    it('rejects cancellation if user is neither client, coach, nor admin', async () => {
      const context = { auth: { uid: 'unauthorized-user', token: { email: 'intruder@example.com' } } };
      const data = { action: 'cancel', bookingId: 'booking-123' };

      mockFirestoreDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          coachUid: 'coach-1',
          clientUid: 'client-1',
          status: 'confirmed',
        }),
      });

      await expect((indexModule.manageBooking as (d: unknown, c: unknown) => Promise<unknown>)(data, context)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });
  });

  describe('updateUserProfileAndSchedule', () => {
    it('strips privileged fields (userRole, userStatus) when called by non-admin', async () => {
      const context = { auth: { uid: 'user-1', token: { email: 'user@example.com' } } };
      const data = {
        userId: 'user-1',
        profileData: {
          bio: 'Valid bio update',
          userRole: 'admin', // Privileged field
          userStatus: 'active', // Privileged field
        },
      };

      // Mock caller profile (not an admin)
      mockFirestoreDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ userRole: 'user', userStatus: 'active' }) }) // caller profile
        .mockResolvedValueOnce({ exists: true, data: () => ({ userRole: 'user', userStatus: 'active' }) }); // target user profile

      mockTransactionGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ userRole: 'user', userStatus: 'active' }) }) // userDoc
        .mockResolvedValueOnce({ exists: true, data: () => ({}) }) // daysSnap
        .mockResolvedValueOnce({ exists: true, data: () => ({}) }); // datesSnap

      await (indexModule.updateUserProfileAndSchedule as (d: unknown, c: unknown) => Promise<unknown>)(data, context);

      expect(mockTransactionSet).toHaveBeenCalled();
      const firstSetCallArg = mockTransactionSet.mock.calls[0][1] as Record<string, unknown>;
      expect(firstSetCallArg.bio).toBe('Valid bio update');
      expect(firstSetCallArg.userRole).toBeUndefined();
      expect(firstSetCallArg.userStatus).toBeUndefined();
    });
  });

  describe('syncMyCalendar', () => {
    it('fetches Google Calendar free/busy and writes to availability', async () => {
      const context = { auth: { uid: 'user-1', token: { email: 'user@example.com' } } };
      const data = { googleAccessToken: 'valid-token' };

      mockFirestoreDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({}) }) // availableDays
        .mockResolvedValueOnce({ exists: true, data: () => ({}) }); // blockedDates

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          calendars: {
            primary: {
              busy: [{ start: '2026-09-01T10:00:00Z', end: '2026-09-01T11:00:00Z' }],
            },
          },
        }),
      });

      const result = (await (indexModule.syncMyCalendar as (d: unknown, c: unknown) => Promise<unknown>)(data, context)) as { success: boolean };
      expect(result.success).toBe(true);
    });
  });

  describe('dailyHousekeeping', () => {
    it('paginates active users and replenishes availability slots', async () => {
      // Mock queries: Page 1 with 1 coach, Page 2 empty
      let queryPage = 0;
      mockFirestoreQueryGet.mockImplementation(() => {
        queryPage++;
        if (queryPage === 1) {
          return Promise.resolve({
            empty: false,
            docs: [
              {
                id: 'active-coach-1',
                data: () => ({
                  userId: 'active-coach-1',
                  userStatus: 'active',
                  timezone: 'UTC',
                }),
              },
            ],
          });
        }
        return Promise.resolve({
          empty: true,
          docs: [],
        });
      });

      // Mock subcollection docs
      mockFirestoreDocGet.mockImplementation((docId?: string) => {
        if (docId === 'availableDays') {
          return Promise.resolve({
            exists: true,
            data: () => ({
              monday: {
                enabled: true,
                slots: [
                  {
                    startTime: { seconds: 32400, nanoseconds: 0 },
                    endTime: { seconds: 61200, nanoseconds: 0 },
                  },
                ],
              },
            }),
          });
        }
        return Promise.resolve({
          exists: true,
          data: () => ({ blockedDates: [] }),
        });
      });

      await (indexModule.dailyHousekeeping as (data: unknown) => Promise<unknown>)({});
      expect(mockFirestoreSet).toHaveBeenCalled();
    });
  });
});
