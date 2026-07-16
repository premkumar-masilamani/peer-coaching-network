/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  subtractBusyIntervals,
  computeFreeSlots,
  recalculateAvailableSlotsCache,
  lazyRecalculateAvailableSlotsCache,
  getUserAvailableSlots,
} from '../slotsService';
import { timeStringToTimestamp, generateTemplateSlots } from '../../utils/slotGeneration';
import { logger } from '../../utils/logger';
import { BOOKING_HORIZON_DAYS } from '../../config';

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
    dbContainer: { db: {} as any }
  };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock(H.authState));
vi.mock('firebase/firestore', async () => (await import('./helpers/firebaseMocks')).buildFirestoreMock(H.shared));
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());
vi.mock('../firebaseApp', () => {
  return {
    get db() { return H.dbContainer.db; },
    get auth() { return H.authState; }
  };
});

const { mockGetDoc, mockSetDoc, mockGetDocs, mockBatchSet, mockBatchDelete, mockBatchCommit } = H.shared;

describe('slotsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.authState.currentUser = null;
    H.dbContainer.db = {} as any;
  });

  describe('subtractBusyIntervals', () => {
    const HOUR = 60 * 60 * 1000;
    const slot = '2026-07-01T10:00:00.000Z';
    const slotStart = new Date(slot).getTime();

    it('returns all slots unchanged when there are no busy intervals', () => {
      expect(subtractBusyIntervals([slot], [])).toEqual([slot]);
    });
    it('removes a slot that overlaps a busy interval', () => {
      expect(subtractBusyIntervals([slot], [{ start: slotStart + 15 * 60 * 1000, end: slotStart + 45 * 60 * 1000 }])).toEqual([]);
    });
    it('keeps a slot when a busy interval only abuts it', () => {
      expect(subtractBusyIntervals([slot], [{ start: slotStart + HOUR, end: slotStart + 2 * HOUR }])).toEqual([slot]);
    });
    it('removes only the overlapping slots from a set', () => {
      const slotB = '2026-07-01T12:00:00.000Z';
      const busy = [{ start: new Date(slotB).getTime(), end: new Date(slotB).getTime() + HOUR }];
      expect(subtractBusyIntervals([slot, slotB], busy)).toEqual([slot]);
    });
  });

  describe('computeFreeSlots', () => {
    it('subtracts busy hours, deduplicates, sorts, and derives distinct UTC dates', () => {
      const a = '2026-07-01T10:00:00.000Z';
      const b = '2026-07-02T09:00:00.000Z';
      const busyStart = new Date(a).getTime();
      // Duplicate `b` (as overlapping template ranges would produce) and provide
      // an unsorted, busy-overlapping input to exercise dedup + sort + subtract.
      const { freeSlots, availableDatesUtc } = computeFreeSlots(
        [b, a, b],
        [{ start: busyStart, end: busyStart + 60 * 60 * 1000 }]
      );
      expect(freeSlots).toEqual([b]); // `a` removed (busy), `b` deduped
      expect(availableDatesUtc).toEqual(['2026-07-02']);
    });

    it('returns empty arrays when every slot is busy', () => {
      const a = '2026-07-01T10:00:00.000Z';
      const start = new Date(a).getTime();
      const { freeSlots, availableDatesUtc } = computeFreeSlots([a], [{ start, end: start + 60 * 60 * 1000 }]);
      expect(freeSlots).toEqual([]);
      expect(availableDatesUtc).toEqual([]);
    });
  });

  describe('recalculateAvailableSlotsCache', () => {
    const enabledDay = { enabled: true, slots: [{ startTime: timeStringToTimestamp('10:00 AM'), endTime: timeStringToTimestamp('11:00 AM') }] };
    const allDaysEnabled = {
      sunday: enabledDay, monday: enabledDay, tuesday: enabledDay, wednesday: enabledDay,
      thursday: enabledDay, friday: enabledDay, saturday: enabledDay,
    };

    it('writes the aggregate cache and per-day shards, and deletes stale shards', async () => {
      H.authState.currentUser = { uid: 'coach-recalc' };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', gender: 'female', country: 'IN', userStatus: 'active', userRole: 'user', icf_acc: true }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => allDaysEnabled });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          availableSlots: ['2000-01-01T10:00:00.000Z'],
          availableDatesUtc: ['2000-01-01'],
          gender: 'female',
          country: 'IN',
          icf_acc: true,
          icf_pcc: false,
          icf_mcc: false,
          icf_actc: false,
          userStatus: 'active'
        })
      });
      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => cb({ data: () => ({ coachUid: 'coach-recalc', dateISO: '2000-01-01' }), ref: { id: 'coach-recalc_2000-01-01' } }) });
      mockSetDoc.mockResolvedValue(undefined);

      await recalculateAvailableSlotsCache('coach-recalc');

      const aggCall = mockSetDoc.mock.calls.find((c: any) => c[0].path?.startsWith('personalAvailabilityCache'));
      expect(aggCall).toBeDefined();
      expect(aggCall![1].gender).toBe('female');
      expect(Array.isArray(aggCall![1].availableSlots)).toBe(true);

      expect(mockBatchSet).toHaveBeenCalled();
      const firstShard = mockBatchSet.mock.calls[0];
      expect(firstShard[0].id).toMatch(/^coach-recalc_\d{4}-\d{2}-\d{2}$/);
      expect(firstShard[1].coachUid).toBe('coach-recalc');
      expect(firstShard[1].gender).toBe('female');

      expect(mockBatchDelete).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('skips the day-shard rebuild when recalc runs on another user\'s session (admin)', async () => {
      H.authState.currentUser = { uid: 'admin-1' };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', gender: 'female', country: 'IN', userStatus: 'active' }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => allDaysEnabled });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false }); // existing cache is missing
      mockSetDoc.mockResolvedValue(undefined);

      await recalculateAvailableSlotsCache('coach-x');

      const aggCall = mockSetDoc.mock.calls.find((c: any) => c[0].path?.startsWith('personalAvailabilityCache'));
      expect(aggCall).toBeDefined();
      expect(mockGetDocs).not.toHaveBeenCalled();
      expect(mockBatchSet).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('deduplicates hourly slots produced by overlapping template ranges', async () => {
      H.authState.currentUser = { uid: 'coach-dupe' };
      const overlappingDay = {
        enabled: true,
        slots: [
          { startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('12:00 PM') },
          { startTime: timeStringToTimestamp('11:00 AM'), endTime: timeStringToTimestamp('2:00 PM') },
        ],
      };
      const everyDayOverlapping = {
        sunday: overlappingDay, monday: overlappingDay, tuesday: overlappingDay, wednesday: overlappingDay,
        thursday: overlappingDay, friday: overlappingDay, saturday: overlappingDay,
      };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => everyDayOverlapping });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false }); // existing cache is missing
      mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
      mockSetDoc.mockResolvedValue(undefined);

      await recalculateAvailableSlotsCache('coach-dupe');

      const aggCall = mockSetDoc.mock.calls.find((c: any) => c[0].path?.startsWith('personalAvailabilityCache'));
      const slots: string[] = aggCall![1].availableSlots;
      expect(new Set(slots).size).toBe(slots.length);
      for (const call of mockBatchSet.mock.calls) {
        const freeSlots: string[] = call[1].freeSlots;
        expect(freeSlots.length).toBe(5);
        expect(freeSlots.length).toBeLessThanOrEqual(24);
      }
    });

    it('does not throw and skips writes when the user document is missing', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await expect(recalculateAvailableSlotsCache('missing-user')).resolves.toBeUndefined();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('logs failure telemetry and rejects when the cache write fails', async () => {
      H.authState.currentUser = { uid: 'coach-fail' };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => allDaysEnabled });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false }); // existing cache is missing
      mockSetDoc.mockRejectedValueOnce(new Error('write denied'));

      await expect(recalculateAvailableSlotsCache('coach-fail')).rejects.toThrow('write denied');
      expect(logger.telemetry).toHaveBeenCalledWith('error', 'recalculation_failure', expect.objectContaining({ userId: 'coach-fail' }));
    });

    it('skips the day-shard writes batch if availability and filter fields did not change', async () => {
      H.authState.currentUser = { uid: 'coach-recalc' };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', gender: 'female', country: 'IN', userStatus: 'active', userRole: 'user', icf_acc: true }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => allDaysEnabled });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      
      const computedSlots = generateTemplateSlots({
        availableDays: allDaysEnabled,
        blockedDates: [],
        timezone: 'UTC',
        anchorDate: new Date(),
        horizonDays: BOOKING_HORIZON_DAYS,
      });
      const finalFreeSlots = Array.from(new Set(computedSlots)).sort();
      const finalAvailableDatesUtc = Array.from(new Set(finalFreeSlots.map(s => s.split('T')[0]))).sort();

      // Mock existing cache: matches computed slots and matching filter fields and status
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          availableSlots: finalFreeSlots,
          availableDatesUtc: finalAvailableDatesUtc,
          gender: 'female',
          country: 'IN',
          icf_acc: true,
          icf_pcc: false,
          icf_mcc: false,
          icf_actc: false,
          userStatus: 'active'
        })
      });
      mockSetDoc.mockResolvedValue(undefined);

      await recalculateAvailableSlotsCache('coach-recalc');

      const aggCall = mockSetDoc.mock.calls.find((c: any) => c[0].path?.startsWith('personalAvailabilityCache'));
      expect(aggCall).toBeDefined();
      expect(mockBatchSet).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('rewrites only changed shards and deletes stale shards without getDocs when there is nothing to delete', async () => {
      H.authState.currentUser = { uid: 'coach-recalc' };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', gender: 'female', country: 'IN', userStatus: 'active', userRole: 'user', icf_acc: true }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => allDaysEnabled });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      
      const computedSlots = generateTemplateSlots({
        availableDays: allDaysEnabled,
        blockedDates: [],
        timezone: 'UTC',
        anchorDate: new Date(),
        horizonDays: BOOKING_HORIZON_DAYS,
      });
      const finalFreeSlots = Array.from(new Set(computedSlots)).sort();
      const finalAvailableDatesUtc = Array.from(new Set(finalFreeSlots.map(s => s.split('T')[0]))).sort();

      // Mock existing cache: has computed slots but with gender changed ('male' instead of 'female'),
      // so it is dirty.
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          availableSlots: finalFreeSlots,
          availableDatesUtc: finalAvailableDatesUtc,
          gender: 'male', // Changed
          country: 'IN',
          icf_acc: true,
          icf_pcc: false,
          icf_mcc: false,
          icf_actc: false,
          userStatus: 'active'
        })
      });
      mockSetDoc.mockResolvedValue(undefined);

      await recalculateAvailableSlotsCache('coach-recalc');

      // Since gender changed, day shards must be rewritten.
      // And because old dates (availableDatesUtc) was empty, staleDates is empty, so getDocs is skipped!
      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  describe('lazyRecalculateAvailableSlotsCache', () => {
    it('does nothing when the caller is not the owner', async () => {
      H.authState.currentUser = { uid: 'other-user' };
      await lazyRecalculateAvailableSlotsCache('coach-lazy');
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('recalculates when the cache document does not exist', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => false };
        if (ref.path === 'users/coach-lazy') return { exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) };
        if (ref.path === 'users/coach-lazy/schedule/availableDays') return { exists: () => true, data: () => ({}) };
        if (ref.path === 'users/coach-lazy/schedule/blockedDates') return { exists: () => true, data: () => ({ blockedDates: [] }) };
        return { exists: () => false };
      });
      mockGetDocs.mockResolvedValue({ forEach: () => {} });
      mockSetDoc.mockResolvedValue(undefined);

      await lazyRecalculateAvailableSlotsCache('coach-lazy');

      expect(mockSetDoc.mock.calls.filter((c: any) => c[0].path === 'personalAvailabilityCache/coach-lazy')).toHaveLength(1);
    });

    it('recalculates when lastUpdated is older than 24h', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], lastUpdated: oldDate, userStatus: 'active' }) };
        if (ref.path === 'users/coach-lazy') return { exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) };
        if (ref.path === 'users/coach-lazy/schedule/availableDays') return { exists: () => true, data: () => ({}) };
        if (ref.path === 'users/coach-lazy/schedule/blockedDates') return { exists: () => true, data: () => ({ blockedDates: [] }) };
        return { exists: () => false };
      });
      mockGetDocs.mockResolvedValue({ forEach: () => {} });
      mockSetDoc.mockResolvedValue(undefined);

      await lazyRecalculateAvailableSlotsCache('coach-lazy');

      expect(mockSetDoc.mock.calls.filter((c: any) => c[0].path === 'personalAvailabilityCache/coach-lazy')).toHaveLength(1);
    });

    it('does NOT recalculate when lastUpdated is fresh (<24h)', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      const recentDate = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], lastUpdated: recentDate, lastUpdatedByOwner: true }) };
        return { exists: () => false };
      });

      await lazyRecalculateAvailableSlotsCache('coach-lazy');

      expect(mockSetDoc.mock.calls.filter((c: any) => c[0].path === 'personalAvailabilityCache/coach-lazy')).toHaveLength(0);
    });
  });

  describe('getUserAvailableSlots', () => {
    it('returns the cached slot list when the cache doc exists', async () => {
      H.authState.currentUser = { uid: 'other' }; // not owner → skip lazy recalc write path
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ availableSlots: ['2026-07-01T10:00:00.000Z'] }) });
      expect(await getUserAvailableSlots('user1')).toEqual(['2026-07-01T10:00:00.000Z']);
    });

    it('returns [] when the cache doc is missing', async () => {
      H.authState.currentUser = { uid: 'other' };
      mockGetDoc.mockResolvedValue({ exists: () => false });
      expect(await getUserAvailableSlots('user1')).toEqual([]);
    });

    it('returns [] when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      expect(await getUserAvailableSlots('user1')).toEqual([]);
    });
  });

  describe('additional branch coverage', () => {
    it('lazyRecalculateAvailableSlotsCache recalculates when lastUpdated is missing', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], userStatus: 'active' }) }; // no lastUpdated
        if (ref.path === 'users/coach-lazy') return { exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) };
        if (ref.path === 'users/coach-lazy/schedule/availableDays') return { exists: () => true, data: () => ({}) };
        if (ref.path === 'users/coach-lazy/schedule/blockedDates') return { exists: () => true, data: () => ({ blockedDates: [] }) };
        return { exists: () => false };
      });
      mockGetDocs.mockResolvedValue({ forEach: () => {} });
      mockSetDoc.mockResolvedValue(undefined);

      await lazyRecalculateAvailableSlotsCache('coach-lazy');
      expect(mockSetDoc.mock.calls.filter((c: any) => c[0].path === 'personalAvailabilityCache/coach-lazy')).toHaveLength(1);
    });

    it('lazyRecalculateAvailableSlotsCache recalculates when user status changes', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], userStatus: 'inactive', lastUpdated: new Date().toISOString(), lastUpdatedByOwner: true }) };
        if (ref.path === 'users/coach-lazy') return { exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) };
        if (ref.path === 'users/coach-lazy/schedule/availableDays') return { exists: () => true, data: () => ({}) };
        if (ref.path === 'users/coach-lazy/schedule/blockedDates') return { exists: () => true, data: () => ({ blockedDates: [] }) };
        return { exists: () => false };
      });
      mockGetDocs.mockResolvedValue({ forEach: () => {} });
      mockSetDoc.mockResolvedValue(undefined);

      await lazyRecalculateAvailableSlotsCache('coach-lazy');
      expect(mockSetDoc.mock.calls.filter((c: any) => c[0].path === 'personalAvailabilityCache/coach-lazy')).toHaveLength(1);
    });

    it('lazyRecalculateAvailableSlotsCache recalculates when credentials change', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], userStatus: 'active', icf_acc: false, lastUpdated: new Date().toISOString(), lastUpdatedByOwner: true }) };
        if (ref.path === 'users/coach-lazy') return { exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active', icf_acc: true }) };
        if (ref.path === 'users/coach-lazy/schedule/availableDays') return { exists: () => true, data: () => ({}) };
        if (ref.path === 'users/coach-lazy/schedule/blockedDates') return { exists: () => true, data: () => ({ blockedDates: [] }) };
        return { exists: () => false };
      });
      mockGetDocs.mockResolvedValue({ forEach: () => {} });
      mockSetDoc.mockResolvedValue(undefined);

      await lazyRecalculateAvailableSlotsCache('coach-lazy');
      expect(mockSetDoc.mock.calls.filter((c: any) => c[0].path === 'personalAvailabilityCache/coach-lazy')).toHaveLength(1);
    });

    it('lazyRecalculateAvailableSlotsCache recalculates when lastUpdatedByOwner is false or missing', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], userStatus: 'active', lastUpdated: new Date().toISOString(), lastUpdatedByOwner: false }) };
        if (ref.path === 'users/coach-lazy') return { exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) };
        if (ref.path === 'users/coach-lazy/schedule/availableDays') return { exists: () => true, data: () => ({}) };
        if (ref.path === 'users/coach-lazy/schedule/blockedDates') return { exists: () => true, data: () => ({ blockedDates: [] }) };
        return { exists: () => false };
      });
      mockGetDocs.mockResolvedValue({ forEach: () => {} });
      mockSetDoc.mockResolvedValue(undefined);

      await lazyRecalculateAvailableSlotsCache('coach-lazy');
      expect(mockSetDoc.mock.calls.filter((c: any) => c[0].path === 'personalAvailabilityCache/coach-lazy')).toHaveLength(1);
    });

    it('lazyRecalculateAvailableSlotsCache logs error on failure', async () => {
      H.authState.currentUser = { uid: 'coach-lazy' };
      mockGetDoc.mockRejectedValueOnce(new Error('lazy error'));

      await lazyRecalculateAvailableSlotsCache('coach-lazy');
      expect(logger.error).toHaveBeenCalledWith('Error in lazyRecalculateAvailableSlotsCache for coach-lazy:', expect.any(Error));
    });

    it('recalculateAvailableSlotsCache does not write when db is null', async () => {
      H.dbContainer.db = null as any;
      await recalculateAvailableSlotsCache('coach-1');
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('recalculateAvailableSlotsCache logs error if telemetry fails during failure logging', async () => {
      H.authState.currentUser = { uid: 'coach-fail' };
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ timezone: 'UTC', userStatus: 'active' }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({}) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ blockedDates: [] }) });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false }); // existing cache is missing
      mockSetDoc.mockRejectedValueOnce(new Error('write denied'));

      const mockTelemetry = vi.fn().mockRejectedValueOnce(new Error('telemetry crash'));
      const originalTelemetry = logger.telemetry;
      logger.telemetry = mockTelemetry;

      await expect(recalculateAvailableSlotsCache('coach-fail')).rejects.toThrow('write denied');
      expect(logger.error).toHaveBeenCalledWith('Failed to log recalculation failure:', expect.any(Error));

      logger.telemetry = originalTelemetry;
    });
  });
});
