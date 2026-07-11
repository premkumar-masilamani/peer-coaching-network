/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { queryAvailableCoachesForDay, subscribeToBookings, subscribeToUserBookings } from '../discoveryService';
import { logger } from '../../utils/logger';
import { snap } from './helpers/firebaseMocks';

const H = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return {
    authState: { currentUser: null as null | { uid: string } },
    shared: {
      mockGetDoc: vi.fn(), mockSetDoc: vi.fn(), mockUpdateDoc: vi.fn(),
      mockGetDocs: vi.fn(), mockOnSnapshot: vi.fn(), mockDeleteDoc: vi.fn(),
      mockBatchSet: vi.fn(), mockBatchDelete: vi.fn(), mockBatchCommit: vi.fn(() => Promise.resolve()),
    },
  };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock(H.authState));
vi.mock('firebase/firestore', async () => (await import('./helpers/firebaseMocks')).buildFirestoreMock(H.shared));
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());

const { mockGetDocs, mockOnSnapshot } = H.shared;

const dayRange = [new Date('2026-07-01T00:00:00Z'), new Date('2026-07-01T23:59:59Z')] as const;
const oneSlot = [{ startTime: new Date('2026-07-01T10:00:00.000Z'), endTime: new Date('2026-07-01T11:00:00.000Z') }];

describe('discoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.authState.currentUser = null;
  });

  describe('queryAvailableCoachesForDay', () => {
    it('reads coachAvailabilityByDate shards by day and returns active coaches', async () => {
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coach1', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z', '2026-07-01T12:00:00.000Z'], userStatus: 'active' },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([]));
      mockGetDocs.mockResolvedValueOnce(snap([{ userId: 'coach1', userRole: 'user', userStatus: 'active', firstName: 'Alice', lastName: 'Smith' }]));

      const result = await queryAvailableCoachesForDay(dayRange[0], dayRange[1], oneSlot, {}, 'seed', 'client1');

      const firstQueryCall = mockGetDocs.mock.calls[0][0];
      expect(firstQueryCall.path).toBe('coachAvailabilityByDate');
      expect(firstQueryCall.queries?.[0]).toEqual({ field: 'dateISO', op: 'in', val: ['2026-07-01'] });
      expect(result['2026-07-01T10:00:00.000Z']).toHaveLength(1);
      expect(result['2026-07-01T10:00:00.000Z'][0].userId).toBe('coach1');
    });

    it('excludes non-active coaches even with a valid availability shard', async () => {
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'activeCoach', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'] },
        { coachUid: 'pendingCoach', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'] },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([]));
      mockGetDocs.mockResolvedValueOnce(snap([
        { userId: 'activeCoach', userRole: 'user', userStatus: 'active', firstName: 'Ada' },
        { userId: 'pendingCoach', userRole: 'user', userStatus: 'inactive', firstName: 'Peter' },
      ]));

      const result = await queryAvailableCoachesForDay(dayRange[0], dayRange[1], oneSlot, {}, 'seed', 'client1');
      expect(result['2026-07-01T10:00:00.000Z'].map((c) => c.userId)).toEqual(['activeCoach']);
    });

    it('excludes the current user and applies faceted filters in memory', async () => {
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'client1', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'], gender: 'female' },
        { coachUid: 'coachM', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'], gender: 'male' },
        { coachUid: 'coachF', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'], gender: 'female' },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([]));
      mockGetDocs.mockResolvedValueOnce(snap([{ userId: 'coachF', userRole: 'user', userStatus: 'active', firstName: 'Fiona' }]));

      const result = await queryAvailableCoachesForDay(dayRange[0], dayRange[1], oneSlot, { gender: 'female' }, 'seed', 'client1');

      const profileQueryCall = mockGetDocs.mock.calls[2][0];
      expect(profileQueryCall.queries?.[0]).toEqual({ field: 'documentId', op: 'in', val: ['coachF'] });
      expect(result['2026-07-01T10:00:00.000Z'].map((c) => c.userId)).toEqual(['coachF']);
    });

    it("unions freeSlots across a coach's two UTC-date shards", async () => {
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coach1', dateISO: '2026-07-01', freeSlots: ['2026-07-01T23:00:00.000Z', '2026-07-01T23:30:00.000Z'] },
        { coachUid: 'coach1', dateISO: '2026-07-02', freeSlots: ['2026-07-02T00:00:00.000Z', '2026-07-02T00:30:00.000Z'] },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([]));
      mockGetDocs.mockResolvedValueOnce(snap([{ userId: 'coach1', userRole: 'user', userStatus: 'active', firstName: 'Alice' }]));

      const slots = [
        { startTime: new Date('2026-07-01T23:00:00.000Z'), endTime: new Date('2026-07-02T00:00:00.000Z') },
        { startTime: new Date('2026-07-02T00:00:00.000Z'), endTime: new Date('2026-07-02T01:00:00.000Z') },
      ];
      const result = await queryAvailableCoachesForDay(new Date('2026-07-01T00:00:00Z'), new Date('2026-07-02T23:59:59Z'), slots, {}, 'seed', 'client1');
      expect(result['2026-07-01T23:00:00.000Z'][0].userId).toBe('coach1');
      expect(result['2026-07-02T00:00:00.000Z'][0].userId).toBe('coach1');
    });

    it('rejects coaches by country and by credential filters', async () => {
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'wrongCountry', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'], country: 'US', icf_pcc: true },
        { coachUid: 'wrongCred', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'], country: 'IN', icf_acc: true },
        { coachUid: 'match', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'], country: 'IN', icf_pcc: true },
      ]));
      mockGetDocs.mockResolvedValueOnce(snap([]));
      mockGetDocs.mockResolvedValueOnce(snap([{ userId: 'match', userRole: 'user', userStatus: 'active', firstName: 'Match' }]));

      const result = await queryAvailableCoachesForDay(dayRange[0], dayRange[1], oneSlot, { country: 'IN', icf_pcc: true }, 'seed', 'client1');
      expect(mockGetDocs.mock.calls[2][0].queries?.[0].val).toEqual(['match']);
      expect(result['2026-07-01T10:00:00.000Z'].map((c) => c.userId)).toEqual(['match']);
    });

    it('returns {} when no slots are requested', async () => {
      const result = await queryAvailableCoachesForDay(dayRange[0], dayRange[1], [], {}, 'seed', 'client1');
      expect(result).toEqual({});
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('returns {} and short-circuits when every candidate is filtered out', async () => {
      mockGetDocs.mockResolvedValueOnce(snap([
        { coachUid: 'coachM', dateISO: '2026-07-01', freeSlots: ['2026-07-01T10:00:00.000Z', '2026-07-01T10:30:00.000Z'], gender: 'male' },
      ]));
      const result = await queryAvailableCoachesForDay(dayRange[0], dayRange[1], oneSlot, { gender: 'female' }, 'seed', 'client1');
      expect(result).toEqual({});
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    it('drops a coach who has a confirmed booking at the slot', async () => {
      const slotIso = '2026-07-01T10:00:00.000Z';
      mockGetDocs.mockResolvedValueOnce(snap([{ coachUid: 'coach1', dateISO: '2026-07-01', freeSlots: [slotIso, '2026-07-01T10:30:00.000Z'] }]));
      mockGetDocs.mockResolvedValueOnce(snap([{ coachUid: 'coach1', clientUid: 'someClient', startTime: { dateTime: slotIso } }]));
      mockGetDocs.mockResolvedValueOnce(snap([{ userId: 'coach1', userRole: 'user', userStatus: 'active', firstName: 'Alice' }]));

      const result = await queryAvailableCoachesForDay(dayRange[0], dayRange[1], oneSlot, {}, 'seed', 'client1');
      expect(result[slotIso]).toEqual([]);
    });
  });

  describe('subscribeToBookings', () => {
    it('maps confirmed bookings and logs snapshot errors', () => {
      let snapCb: any; let errCb: any;
      mockOnSnapshot.mockImplementation((_q: any, cb: any, err: any) => { snapCb = cb; errCb = err; return () => {}; });

      const cb = vi.fn();
      subscribeToBookings(cb);
      snapCb({ forEach: (f: any) => f({ data: () => ({ bookingId: 'b-1' }) }) });
      expect(cb).toHaveBeenCalledWith([{ bookingId: 'b-1' }]);

      errCb(new Error('Snap error'));
      expect(logger.error).toHaveBeenCalledWith('Error in subscribeToBookings:', expect.any(Error));
    });
  });

  describe('subscribeToUserBookings', () => {
    it('maps the user\'s bookings and logs snapshot errors', () => {
      let snapCb: any; let errCb: any;
      mockOnSnapshot.mockImplementation((_q: any, cb: any, err: any) => { snapCb = cb; errCb = err; return () => {}; });

      const cb = vi.fn();
      subscribeToUserBookings('user-1', cb);
      snapCb({ forEach: (f: any) => { f({ data: () => ({ bookingId: 'b-1' }) }); f({ data: () => ({ bookingId: 'b-2' }) }); } });
      expect(cb).toHaveBeenCalledWith([{ bookingId: 'b-1' }, { bookingId: 'b-2' }]);

      errCb(new Error('boom'));
      expect(logger.error).toHaveBeenCalledWith('Error in subscribeToUserBookings:', expect.any(Error));
    });
  });
});
