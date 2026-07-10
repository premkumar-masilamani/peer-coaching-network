/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  subtractBusyIntervals,
  recalculateAvailableSlotsCache,
  lazyRecalculateAvailableSlotsCache,
  getUserAvailableSlots,
} from '../slotsService';
import { timeStringToTimestamp } from '../../utils/slotGeneration';
import { logger } from '../../utils/logger';

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

const { mockGetDoc, mockSetDoc, mockGetDocs, mockBatchSet, mockBatchDelete, mockBatchCommit } = H.shared;

describe('slotsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.authState.currentUser = null;
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
      mockSetDoc.mockRejectedValueOnce(new Error('write denied'));

      await expect(recalculateAvailableSlotsCache('coach-fail')).rejects.toThrow('write denied');
      expect(logger.telemetry).toHaveBeenCalledWith('error', 'recalculation_failure', expect.objectContaining({ userId: 'coach-fail' }));
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
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], lastUpdated: oldDate }) };
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
        if (ref.path === 'personalAvailabilityCache/coach-lazy') return { exists: () => true, data: () => ({ availableSlots: [], lastUpdated: recentDate }) };
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
  });
});
