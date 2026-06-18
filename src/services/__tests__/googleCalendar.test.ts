/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  scheduleMeeting,
  cancelBooking,
  getUpcomingEvents,
  generateFallbackBusySlots,
  getCoachesBusySlots
} from '../googleCalendar';
import { getGoogleToken } from '../googleToken';

// vi.hoisted for variables accessed inside vi.mock
const {
  mockGetDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockRunTransaction,
  mockGetDocs
} = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockGetDocs: vi.fn(),
}));

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

vi.mock('../googleToken', () => ({
  getGoogleToken: vi.fn(() => 'mock_google_access_token'),
  setGoogleToken: vi.fn(),
  clearGoogleToken: vi.fn()
}));

// Mock recalculateUserBusySlotsCache from firebaseService
vi.mock('../firebaseService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../firebaseService')>();
  return {
    ...actual,
    recalculateUserBusySlotsCache: vi.fn(() => Promise.resolve()),
  };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('googleCalendar service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduleMeeting', () => {
    it('runs in fallback/mock mode when google token is mock', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('mock_google_access_token');
      mockRunTransaction.mockResolvedValue(undefined);

      const result = await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T11:00:00Z',
        'Career Development'
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(result.meetLink).toContain('meet.google.com');
      expect(result.id).toBe('coach-123_2026-06-18T10:00:00Z');
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
        '2026-06-18T11:00:00Z',
        'Career Development'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('conferenceDataVersion=1');
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
          '2026-06-18T11:00:00Z',
          'Career Development'
        )
      ).rejects.toThrow('Google Calendar rate limit exceeded. Please try again in a moment.');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('rolls back/deletes Google Calendar event if Firestore transaction fails', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      // 1. Google event creation succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gcal-event-123', hangoutLink: 'https://meet.google.com/abc-defg-hij' })
      });
      // 2. Transaction fails with SLOT_TAKEN
      mockRunTransaction.mockRejectedValueOnce(new Error('SLOT_TAKEN'));
      // 3. Rollback delete query succeeds
      mockFetch.mockResolvedValueOnce({ ok: true });

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T11:00:00Z',
          'Career Development'
        )
      ).rejects.toThrow('SLOT_TAKEN');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // First call is POST
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
      // Second call is DELETE to cleanup
      expect(mockFetch.mock.calls[1][0]).toContain('gcal-event-123');
      expect(mockFetch.mock.calls[1][1].method).toBe('DELETE');
    });

    it('handles Google Calendar event rollback fetch failure gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gcal-event-123', hangoutLink: 'https://meet.google.com/abc-defg-hij' })
      });
      mockRunTransaction.mockRejectedValueOnce(new Error('SLOT_TAKEN'));
      mockFetch.mockRejectedValueOnce(new Error('Delete request failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        scheduleMeeting(
          'coach-123',
          'coach@example.com',
          'John Coach',
          'client-123',
          'Mock Client',
          '2026-06-18T10:00:00Z',
          '2026-06-18T11:00:00Z',
          'Career Development'
        )
      ).rejects.toThrow('SLOT_TAKEN');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles recalculation failure in scheduleMeeting gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('mock_google_access_token');
      mockRunTransaction.mockResolvedValue(undefined);

      const { recalculateUserBusySlotsCache } = await import('../firebaseService');
      vi.mocked(recalculateUserBusySlotsCache).mockRejectedValueOnce(new Error('Recalc failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await scheduleMeeting(
        'coach-123',
        'coach@example.com',
        'John Coach',
        'client-123',
        'Mock Client',
        '2026-06-18T10:00:00Z',
        '2026-06-18T11:00:00Z',
        'Career Development'
      );

      expect(result.id).toBe('coach-123_2026-06-18T10:00:00Z');
      await new Promise<void>(resolve => queueMicrotask(() => resolve()));
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('cancelBooking', () => {
    it('cancels the booking in Firestore and releases client cache', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('mock_google_access_token');
      
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: 'confirmed',
          startTime: { toDate: () => new Date('2026-06-18T10:00:00Z') },
          clientUid: 'client-123',
          googleEventId: 'gcal-event-123'
        })
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);

      await cancelBooking('booking-123');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('also deletes the Google event when token is valid', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: 'confirmed',
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
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });

    it('handles deleteDoc failure in cancelBooking gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('mock_google_access_token');
      
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: 'confirmed',
          startTime: { toDate: () => new Date('2026-06-18T10:00:00Z') },
          clientUid: 'client-123',
        })
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockRejectedValueOnce(new Error('Delete doc error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await cancelBooking('booking-123');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles google event delete fetch failure gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          bookingId: 'booking-123',
          status: 'confirmed',
          startTime: { toDate: () => new Date('2026-06-18T10:00:00Z') },
          clientUid: 'client-123',
          googleEventId: 'gcal-event-123'
        })
      });

      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);
      mockFetch.mockRejectedValueOnce(new Error('Delete fetch failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await cancelBooking('booking-123');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUpcomingEvents', () => {
    it('fetches real Google events and merges with Firestore bookings', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'gcal-event-1',
              summary: 'Google meeting',
              start: { dateTime: '2026-06-20T10:00:00Z' },
              end: { dateTime: '2026-06-20T11:00:00Z' },
            }
          ]
        })
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              bookingId: 'booking-1',
              status: 'confirmed',
              startTime: '2026-06-21T10:00:00Z',
              endTime: '2026-06-21T11:00:00Z',
              coachUid: 'coach-123',
              clientUid: 'client-123',
              topic: 'Career Development'
            })
          },
          {
            data: () => ({
              bookingId: 'booking-cancelled',
              status: 'cancelled',
              startTime: '2026-06-21T12:00:00Z',
              endTime: '2026-06-21T13:00:00Z',
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
      expect(events.length).toBe(2);
      expect(events[0].id).toBe('gcal-event-1');
      expect(events[1].id).toBe('booking-1');
      expect(events[1].summary).toBe('John / Jane - Peer Coaching Session');
    });

    it('falls back if fetch throws error', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockRejectedValue(new Error('Network failure'));
      mockGetDocs.mockResolvedValue({ docs: [] });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const events = await getUpcomingEvents();
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(events).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateFallbackBusySlots', () => {
    it('generates busy slots for blocked dates and templates', () => {
      const coach = { userId: 'coach-123', timezone: 'America/New_York' } as any;
      const schedule = {
        availableDays: {
          monday: {
            enabled: true,
            slots: [
              { startTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 9, 0)) }, endTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 10, 0)) } },
              { startTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 11, 0)) }, endTime: { toDate: () => new Date(Date.UTC(1970, 0, 1, 12, 0)) } }
            ]
          }
        },
        blockedDates: ['2026-06-23']
      } as any;

      const events = generateFallbackBusySlots(coach, schedule, '2026-06-18T00:00:00Z', '2026-06-25T00:00:00Z');
      expect(events.length).toBeGreaterThan(0);
      const blockedEvent = events.find(e => e.id.includes('fallback-block'));
      expect(blockedEvent).toBeDefined();
    });
  });

  describe('getCoachesBusySlots', () => {
    it('queries Google FreeBusy and Firestore caches, using fallback for missing caches', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          calendars: {
            'coach@example.com': {
              busy: [{ start: '2026-06-20T10:00:00Z', end: '2026-06-20T11:00:00Z' }]
            }
          }
        })
      });

      mockGetDocs.mockResolvedValueOnce([
        {
          id: 'coach-1',
          data: () => ({
            busySlots: [{ start: '2026-06-21T10:00:00Z', end: '2026-06-21T11:00:00Z' }]
          })
        }
      ]);

      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path.endsWith('availableDays')) {
          return { exists: () => true, data: () => ({ monday: { enabled: false } }) };
        }
        return { exists: () => false };
      });

      const coaches = [
        { userId: 'coach-1', email: 'coach@example.com', timezone: 'America/New_York' },
        { userId: 'coach-2', email: 'coach2@example.com', timezone: 'America/New_York' }
      ] as any[];

      const result = await getCoachesBusySlots(coaches, '2026-06-18T00:00:00Z', '2026-06-25T00:00:00Z');
      expect(result['coach-1']).toBeDefined();
      expect(result['coach-2']).toBeDefined();
      expect(result['coach-1'].length).toBeGreaterThan(1);
    });

    it('handles FreeBusy API fetch rejection gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('real-valid-token');
      mockFetch.mockRejectedValue(new Error('FreeBusy API error'));

      mockGetDocs.mockResolvedValue([]);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const coaches = [{ userId: 'coach-1', email: 'coach@example.com' }] as any[];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await getCoachesBusySlots(coaches, '2026-06-18T00:00:00Z', '2026-06-25T00:00:00Z');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result['coach-1']).toBeDefined();
      consoleErrorSpy.mockRestore();
    });

    it('handles busy slots cache query chunk rejection gracefully', async () => {
      vi.mocked(getGoogleToken).mockReturnValue('mock_google_access_token');
      mockGetDocs.mockRejectedValueOnce(new Error('Chunk query failed'));

      const coaches = [{ userId: 'coach-1', email: 'coach@example.com' }] as any[];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path.endsWith('availableDays')) {
          return { exists: () => true, data: () => ({ monday: { enabled: false } }) };
        }
        return { exists: () => false };
      });

      const result = await getCoachesBusySlots(coaches, '2026-06-18T00:00:00Z', '2026-06-25T00:00:00Z');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result['coach-1']).toBeDefined();
      consoleErrorSpy.mockRestore();
    });
  });
});
