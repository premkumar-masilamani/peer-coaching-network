/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  scheduleMeeting,
  cancelBooking,
  getUpcomingEvents,
  getCoachesAvailability
} from '../googleCalendar';
import { getGoogleToken } from '../googleToken';
import { logger } from '../../utils/logger';
import { BOOKING_STATUS, EVENT_TYPE, BOOKING_ERROR } from '../../config';

// vi.hoisted for variables accessed inside vi.mock
const {
  mockGetDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockRunTransaction,
  mockGetDocs
} = vi.hoisted(() => {
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return {
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockRunTransaction: vi.fn(),
    mockGetDocs: vi.fn(),
  };
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'client-123', email: 'client@example.com', displayName: 'Mock Client' }
  })),
  connectAuthEmulator: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
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
  deleteDoc: mockDeleteDoc,
  runTransaction: mockRunTransaction,
  getDocs: mockGetDocs,
  documentId: vi.fn(() => 'documentId'),
  Timestamp: {
    now: () => ({ toDate: () => new Date('2026-06-18T00:00:00Z'), seconds: 1776518400 }),
    fromDate: (date: Date) => ({ toDate: () => date, seconds: date.getTime() / 1000 }),
  },
}));

const configMock = vi.hoisted(() => ({
  ENABLE_GOOGLE_INTEGRATION: true,
}));

vi.mock('../../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config')>();
  return {
    ...actual,
    get ENABLE_GOOGLE_INTEGRATION() {
      return configMock.ENABLE_GOOGLE_INTEGRATION;
    },
  };
});

vi.mock('../googleToken', () => ({
  getGoogleToken: vi.fn(() => null),
  setGoogleToken: vi.fn(),
  clearGoogleToken: vi.fn()
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

// Mock recalculateAvailableSlotsCache from firebaseService
vi.mock('../firebaseService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../firebaseService')>();
  return {
    ...actual,
    recalculateAvailableSlotsCache: vi.fn(() => Promise.resolve()),
  };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('googleCalendar service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.ENABLE_GOOGLE_INTEGRATION = true;
    vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
  });

  describe('scheduleMeeting', () => {
    it('throws GOOGLE_TOKEN_EXPIRED when google token is absent and integration is enabled', async () => {
      vi.mocked(getGoogleToken).mockReturnValue(null);
      mockRunTransaction.mockResolvedValue(undefined);

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T10:30:00Z',
          'Career Development'
        )
      ).rejects.toThrow('Google Token Expired');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1); // Rollback booking status
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1); // Rollback client booking cache
    });

    it('creates Google Calendar event and claims slot when token is valid', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gcal-event-123', hangoutLink: 'https://meet.google.com/abc-defg-hij' })
      });
      mockRunTransaction.mockResolvedValue(undefined);

      const result = await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T10:30:00Z',
        'Career Development'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('conferenceDataVersion=1');
      expect(mockFetch.mock.calls[0][0]).toContain('sendUpdates=all');

      const fetchCallArgs = mockFetch.mock.calls[0];
      const fetchBody = JSON.parse(fetchCallArgs[1].body);
      expect(fetchBody.summary).toBe('[PCN] Peer Coaching: John Coach & Mock Client');
      expect(fetchBody.description).toBe(
        'Hello!\n\n' +
        'A peer coaching session has been scheduled.\n\n' +
        'Details:\n' +
        '- Coach: John Coach (coach@example.com)\n' +
        '- Client: Mock Client (client@example.com)\n' +
        '- Topic: Career Development\n\n' +
        'Please join the Google Meet via the link attached to this event.\n\n' +
        'Created via Peer Coaching Network.'
      );

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(result.meetLink).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('throws GOOGLE_API_ERROR and aborts if Google Calendar creation fails with 429', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate Limit Exceeded'
      });

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T10:30:00Z',
          'Career Development'
        )
      ).rejects.toThrow('Failed to create Google Calendar event.');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      
    });

    it('throws generic GOOGLE_API_ERROR if Google Calendar fetch rejects with a network error', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T10:30:00Z',
          'Career Development'
        )
      ).rejects.toThrow('Network error or Google Calendar API is currently unreachable. Please try again.');

      
    });

    it('executes transaction and throws SLOT_TAKEN if booking already exists', async () => {
      

      mockRunTransaction.mockImplementationOnce(async (_db, callback) => {
        const mockTx = {
          get: vi.fn().mockImplementation(async (ref) => {
            if (ref.path.includes('bookings/')) {
              return { exists: () => true, data: () => ({ status: BOOKING_STATUS.CONFIRMED }) };
            }
            return { exists: () => false };
          }),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
        return callback(mockTx);
      });

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T10:30:00Z',
          'Career Development'
        )
      ).rejects.toThrow('SLOT_TAKEN');
    });

    it('executes transaction and throws BOOKED_AS_CLIENT if clientBookingCache exists', async () => {
      

      mockRunTransaction.mockImplementationOnce(async (_db, callback) => {
        const mockTx = {
          get: vi.fn().mockImplementation(async (ref) => {
            if (ref.path.includes('clientBookingCache/client-123')) {
              return { exists: () => true };
            }
            return { exists: () => false };
          }),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
        return callback(mockTx);
      });

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T10:30:00Z',
          'Career Development'
        )
      ).rejects.toThrow(BOOKING_ERROR.BOOKED_AS_CLIENT);
    });

    it('executes transaction and throws SLOT_TAKEN if coach is already booked as a client (coachAsClient exists)', async () => {
      

      mockRunTransaction.mockImplementationOnce(async (_db, callback) => {
        const mockTx = {
          get: vi.fn().mockImplementation(async (ref) => {
            if (ref.path.includes('clientBookingCache/coach-123_2026-06-18T10:00:00Z')) {
              return { exists: () => true };
            }
            return { exists: () => false };
          }),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
        return callback(mockTx);
      });

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T10:30:00Z',
          'Career Development'
        )
      ).rejects.toThrow('SLOT_TAKEN');
    });

    it('executes transaction and throws BOOKED_AS_COACH if client is already booked as a coach (clientAsCoach exists)', async () => {
      

      mockRunTransaction.mockImplementationOnce(async (_db, callback) => {
        const mockTx = {
          get: vi.fn().mockImplementation(async (ref) => {
            if (ref.path.includes('bookings/client-123_2026-06-18T10:00:00Z')) {
              return { exists: () => true, data: () => ({ status: BOOKING_STATUS.CONFIRMED }) };
            }
            return { exists: () => false };
          }),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
        return callback(mockTx);
      });

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T10:30:00Z',
          'Career Development'
        )
      ).rejects.toThrow(BOOKING_ERROR.BOOKED_AS_COACH);
    });

    it('executes transaction successfully and calls tx.set for booking and cache', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gcal-event-123', hangoutLink: 'https://meet.google.com/test' }) });
      

      const mockTxSet = vi.fn();
      mockRunTransaction.mockImplementationOnce(async (_db, callback) => {
        const mockTx = {
          get: vi.fn().mockResolvedValue({ exists: () => false, data: () => null }),
          set: mockTxSet,
          update: vi.fn(),
          delete: vi.fn(),
        };
        await callback(mockTx);
        return undefined;
      });

      const result = await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T10:30:00Z',
        'Career Development'
      );

      expect(result.id).toBe('coach-123_2026-06-18T10:00:00Z');
      expect(mockTxSet).toHaveBeenCalledTimes(2);
    });

    it('retries transaction on transient failure and eventually succeeds', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gcal-event-123', hangoutLink: 'https://meet.google.com/test' }) });
      

      let attemptCount = 0;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Transient DB Error');
        }
        const mockTx = {
          get: vi.fn().mockResolvedValue({ exists: () => false }),
          set: vi.fn(),
        };
        await callback(mockTx);
        return undefined;
      });

      const result = await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T10:30:00Z',
        'Career Development'
      );

      expect(result.id).toBe('coach-123_2026-06-18T10:00:00Z');
      expect(attemptCount).toBe(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelBooking', () => {
    it('also deletes the Google event when token is valid', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: BOOKING_STATUS.CONFIRMED,
          startTime: { toDate: () => new Date('2026-06-18T10:00:00Z') },
          clientUid: 'client-123',
          googleEventId: 'gcal-event-123'
        })
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);
      mockFetch.mockResolvedValueOnce({ ok: true });

      await cancelBooking('booking-123');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('gcal-event-123');
      expect(mockFetch.mock.calls[0][0]).toContain('sendUpdates=all');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });

    it('handles deleteDoc failure in cancelBooking gracefully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: BOOKING_STATUS.CONFIRMED,
          startTime: { toDate: () => new Date('2026-06-18T10:00:00Z') },
          clientUid: 'client-123',
        })
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockRejectedValueOnce(new Error('Delete doc error'));

      await cancelBooking('booking-123');

      
    });

    it('handles google event delete fetch failure gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: BOOKING_STATUS.CONFIRMED,
          startTime: { toDate: () => new Date('2026-06-18T10:00:00Z') },
          clientUid: 'client-123',
          googleEventId: 'gcal-event-123'
        })
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);
      mockFetch.mockRejectedValueOnce(new Error('Delete fetch failed'));

      await cancelBooking('booking-123');

      
    });
  });

  describe('getUpcomingEvents', () => {
    it('handles non-existent user profile in getUpcomingEvents gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue(null);
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              bookingId: 'booking-2',
              status: BOOKING_STATUS.CONFIRMED,
              startTime: '2026-06-21T10:00:00Z',
              endTime: '2026-06-21T11:00:00Z',
              coachUid: 'coach-not-exist',
              clientUid: 'client-123',
              topic: 'Career Development'
            })
          }
        ]
      });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/client-123') {
          return { exists: () => true, data: () => ({ displayName: 'Jane Client', email: 'client@example.com' }) };
        }
        return { exists: () => false };
      });

      const events = await getUpcomingEvents();
      expect(events.length).toBe(1);
      expect(events[0].summary).toBe('Coach / Jane - Peer Coaching Session');
    });

    it('enriches real Google Calendar events with Firestore booking metadata if ID matches', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'matching-booking-1',
              summary: 'Google meeting',
              start: { dateTime: '2026-06-20T10:00:00Z' },
              end: { dateTime: '2026-06-20T11:00:00Z' },
              attendees: [{ email: 'attendee@example.com', displayName: 'Attendee' }]
            }
          ]
        })
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              bookingId: 'matching-booking-1',
              status: BOOKING_STATUS.CONFIRMED,
              startTime: '2026-06-20T10:00:00Z',
              endTime: '2026-06-20T11:00:00Z',
              coachUid: 'coach-123',
              clientUid: 'client-123',
              topic: 'Career Development'
            })
          }
        ]
      });

      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/coach-123') {
          return { exists: () => true, data: () => ({ displayName: 'John Coach', email: 'coach@example.com' }) };
        }
        if (ref.path === 'users/client-123') {
          return { exists: () => true, data: () => ({ displayName: 'Jane Client', email: 'client@example.com' }) };
        }
        return { exists: () => false };
      });

      const events = await getUpcomingEvents();
      expect(events.length).toBe(1);
      expect(events[0].id).toBe('matching-booking-1');
      expect(events[0].type).toBe(EVENT_TYPE.PEER_COACHING);
      expect(events[0].coachUid).toBe('coach-123');
      expect(events[0].clientUid).toBe('client-123');
      expect(events[0].description).toBe('Peer Coaching Network session on the topic: Career Development. Created via PCN.');
    });

    it('handles Firestore query failure in getUpcomingEvents gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue(null);
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore query failed'));

      const events = await getUpcomingEvents();
      expect(logger.error).toHaveBeenCalled();
      expect(events).toEqual([]);
    });
  });

  describe('generateFallbackAvailableSlots', () => {
    it('handles available slots cache query chunk rejection gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue(null);
      mockGetDocs.mockRejectedValueOnce(new Error('Chunk query failed'));

      const coaches = [{ userId: 'coach-1', email: 'coach@example.com' }] as any[];

      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path.endsWith('availableDays')) {
          return { exists: () => true, data: () => ({ monday: { enabled: false } }) };
        }
        return { exists: () => false };
      });

      const result = await getCoachesAvailability(coaches, '2026-06-18T00:00:00Z', '2026-06-25T00:00:00Z');
      expect(logger.error).toHaveBeenCalled();
      
      expect(result['coach-1']).toBeDefined();
    });
  });

  describe('when ENABLE_GOOGLE_INTEGRATION is false', () => {
    beforeEach(() => {
      configMock.ENABLE_GOOGLE_INTEGRATION = false;
    });

    it('scheduleMeeting skips Google event creation and succeeds locally', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockRunTransaction.mockResolvedValue(undefined);

      const result = await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T10:30:00Z',
        'Career Development'
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.id).toBe('coach-123_2026-06-18T10:00:00Z');
      expect(result.meetLink).toContain('meet.google.com');
    });

    it('cancelBooking skips Google event deletion', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: BOOKING_STATUS.CONFIRMED,
          startTime: { toDate: () => new Date('2026-06-18T10:00:00Z') },
          clientUid: 'client-123',
          googleEventId: 'gcal-event-123'
        })
      });
      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);

      await cancelBooking('booking-123');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });

    it('getUpcomingEvents skips Google Calendar fetch', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockGetDocs.mockResolvedValue({ docs: [] });

      const events = await getUpcomingEvents();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(events).toEqual([]);
    });

    it('getCoachesAvailability skips Google FreeBusy query', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockGetDocs.mockResolvedValue([]);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const coaches = [{ userId: 'coach-1', email: 'coach@example.com' }] as any[];
      const result = await getCoachesAvailability(coaches, '2026-06-18T00:00:00Z', '2026-06-25T00:00:00Z');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result['coach-1']).toBeDefined();
    });
  });

  describe('remediation fixes for atomic booking and deterministic request IDs', () => {
    it('sets the 10-minute expireAt property when writing pending booking and lock documents', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gcal-event-id-123', hangoutLink: 'https://meet.google.com/foo-bar-baz' })
      });

      const mockTx = {
        get: vi.fn().mockImplementation(async () => ({ exists: () => false })),
        set: vi.fn(),
      };
      mockRunTransaction.mockImplementationOnce(async (_db, callback) => {
        await callback(mockTx);
        return undefined;
      });

      await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T10:30:00Z',
        'Career Development'
      );

      expect(mockTx.set).toHaveBeenCalledTimes(2);
      const pendingBookingData = mockTx.set.mock.calls[0][1];
      expect(pendingBookingData.expireAt).toBeDefined();

      const clientBookingCacheData = mockTx.set.mock.calls[1][1];
      expect(clientBookingCacheData.expireAt).toBeDefined();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const reqId = fetchBody.conferenceData.createRequest.requestId;
      expect(reqId).toBeDefined();
      expect(reqId.startsWith('req-')).toBe(true);
    });

    it('ignores expired pending bookings and cache locks in overlap checks', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gcal-event-id-123', hangoutLink: 'https://meet.google.com/foo-bar-baz' })
      });

      mockRunTransaction.mockImplementationOnce(async (_db, callback) => {
        const mockTx = {
          get: vi.fn().mockImplementation(async (ref) => {
            if (ref.path.includes('bookings/coach-123_2026-06-18T10:00:00Z')) {
              return {
                exists: () => true,
                data: () => ({
                  status: BOOKING_STATUS.PENDING,
                  expireAt: Timestamp.fromDate(new Date(Date.now() - 10000)) // Expired 10 seconds ago
                })
              };
            }
            if (ref.path.includes('clientBookingCache/client-123')) {
              return {
                exists: () => true,
                data: () => ({
                  expireAt: Timestamp.fromDate(new Date(Date.now() - 10000))
                })
              };
            }
            return { exists: () => false };
          }),
          set: vi.fn(),
        };
        await callback(mockTx);
        return undefined;
      });

      const result = await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T10:30:00Z',
        'Career Development'
      );

      expect(result.id).toBe('coach-123_2026-06-18T10:00:00Z');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('getUpcomingEvents filters out expired pending bookings', async () => {
      vi.mocked(getGoogleToken).mockReturnValue(null);
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              bookingId: 'booking-pending-expired',
              status: BOOKING_STATUS.PENDING,
              startTime: '2026-06-20T10:00:00Z',
              endTime: '2026-06-20T11:00:00Z',
              coachUid: 'coach-123',
              clientUid: 'client-123',
              topic: 'Career Development',
              expireAt: Timestamp.fromDate(new Date(Date.now() - 10000)) // Expired
            })
          },
          {
            data: () => ({
              bookingId: 'booking-confirmed-valid',
              status: BOOKING_STATUS.CONFIRMED,
              startTime: '2026-06-20T12:00:00Z',
              endTime: '2026-06-20T13:00:00Z',
              coachUid: 'coach-123',
              clientUid: 'client-123',
              topic: 'Leadership'
            })
          }
        ]
      });
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'users/coach-123') {
          return { exists: () => true, data: () => ({ displayName: 'John Coach', email: 'coach@example.com' }) };
        }
        if (ref.path === 'users/client-123') {
          return { exists: () => true, data: () => ({ displayName: 'Jane Client', email: 'client@example.com' }) };
        }
        return { exists: () => false };
      });

      const events = await getUpcomingEvents();
      expect(events.length).toBe(1);
      expect(events[0].id).toBe('booking-confirmed-valid');
    });
  });
});
