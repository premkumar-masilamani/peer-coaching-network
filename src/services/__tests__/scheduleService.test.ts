/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  getSchedule,
  updateSchedule,
  DEFAULT_AVAILABLE_DAYS,
  timeStringToTimestamp,
  timestampToTimeString,
} from '../scheduleService';

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

const { mockGetDoc, mockSetDoc } = H.shared;

describe('scheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.authState.currentUser = null;
    // Keep the fire-and-forget recalc triggered by updateSchedule a clean no-op.
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);
  });

  describe('DEFAULT_AVAILABLE_DAYS', () => {
    it('enables weekdays and disables weekends by default', () => {
      expect(DEFAULT_AVAILABLE_DAYS.monday.enabled).toBe(true);
      expect(DEFAULT_AVAILABLE_DAYS.friday.enabled).toBe(true);
      expect(DEFAULT_AVAILABLE_DAYS.saturday.enabled).toBe(false);
      expect(DEFAULT_AVAILABLE_DAYS.sunday.enabled).toBe(false);
      // Each day carries a single 9-5 template slot.
      expect(timestampToTimeString(DEFAULT_AVAILABLE_DAYS.monday.slots[0].startTime)).toBe('9:00 AM');
      expect(timestampToTimeString(DEFAULT_AVAILABLE_DAYS.monday.slots[0].endTime)).toBe('5:00 PM');
    });
  });

  describe('re-exported time converters', () => {
    it('round-trips a display time string', () => {
      expect(timestampToTimeString(timeStringToTimestamp('2:30 PM'))).toBe('2:30 PM');
    });
  });

  describe('getSchedule', () => {
    it('falls back to defaults when the schedule docs do not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      const sched = await getSchedule('user-123');
      expect(sched.availableDays).toBe(DEFAULT_AVAILABLE_DAYS);
      expect(sched.blockedDates).toEqual([]);
    });

    it('returns the stored schedule when the docs exist', async () => {
      mockGetDoc.mockImplementation(async (ref: any) => {
        if (ref.path.endsWith('availableDays')) {
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
    it('writes both the availableDays and blockedDates docs', async () => {
      await updateSchedule('user-123', { monday: { enabled: true } } as any, ['2026-06-25']);
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
      const paths = mockSetDoc.mock.calls.map((c: any) => c[0].path);
      expect(paths.some((p: string) => p.endsWith('availableDays'))).toBe(true);
      expect(paths.some((p: string) => p.endsWith('blockedDates'))).toBe(true);
    });
  });
});
