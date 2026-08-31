import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallable, mockFetchScheduleRaw } = vi.hoisted(() => ({
  mockCallable: vi.fn().mockResolvedValue({ data: { success: true } }),
  mockFetchScheduleRaw: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../firebaseApp', () => ({
  functions: { type: 'mock-functions' },
  db: { type: 'mock-db' },
}));

vi.mock('../firestoreRepository', () => ({
  fetchScheduleRaw: mockFetchScheduleRaw,
}));

import { getSchedule, updateSchedule, DEFAULT_AVAILABLE_DAYS } from '../scheduleService';

describe('scheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSchedule', () => {
    it('returns stored schedule if present', async () => {
      const mockDays = {
        ...DEFAULT_AVAILABLE_DAYS,
        monday: { enabled: true, slots: [] },
      };
      mockFetchScheduleRaw.mockResolvedValueOnce({
        availableDays: mockDays,
        blockedDates: ['2026-12-25'],
      });

      const result = await getSchedule('u-1');
      expect(result.availableDays).toEqual(mockDays);
      expect(result.blockedDates).toEqual(['2026-12-25']);
    });

    it('returns DEFAULT_AVAILABLE_DAYS and empty blocked dates if not configured', async () => {
      mockFetchScheduleRaw.mockResolvedValueOnce({
        availableDays: null,
        blockedDates: null,
      });

      const result = await getSchedule('u-1');
      expect(result.availableDays).toEqual(DEFAULT_AVAILABLE_DAYS);
      expect(result.blockedDates).toEqual([]);
    });
  });

  describe('updateSchedule', () => {
    it('calls cloud function with uid, availableDays, and blockedDates', async () => {
      await updateSchedule('u-1', DEFAULT_AVAILABLE_DAYS, ['2026-09-01']);
      expect(mockCallable).toHaveBeenCalledWith({
        userId: 'u-1',
        availableDays: DEFAULT_AVAILABLE_DAYS,
        blockedDates: ['2026-09-01'],
      });
    });
  });
});
