/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getLogsPage, getUserBookingStats, getAllUsers } from '../adminService';
import { getSystemLogs } from '../systemLogsService';
import { getCoachSessions } from '../googleCalendar';
import { getAllUsers as fetchAllUsers } from '../profileService';

vi.mock('../systemLogsService', () => ({
  getSystemLogs: vi.fn(),
}));

vi.mock('../googleCalendar', () => ({
  getCoachSessions: vi.fn(),
}));

vi.mock('../profileService', () => ({
  getAllUsers: vi.fn(),
}));

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLogsPage', () => {
    it('delegates to getSystemLogs with correct arguments', async () => {
      const mockResult = { logs: [], nextCursor: null, hasMore: false };
      vi.mocked(getSystemLogs).mockResolvedValue(mockResult);

      const options = { severities: ['error' as any], pageCursor: 'cursor' };
      const res = await getLogsPage(options);

      expect(getSystemLogs).toHaveBeenCalledWith(options);
      expect(res).toBe(mockResult);
    });
  });

  describe('getUserBookingStats', () => {
    it('delegates to getCoachSessions with correct arguments', async () => {
      const mockSessions: any[] = [];
      vi.mocked(getCoachSessions).mockResolvedValue(mockSessions);

      const res = await getUserBookingStats('user-1');

      expect(getCoachSessions).toHaveBeenCalledWith('user-1');
      expect(res).toBe(mockSessions);
    });
  });

  describe('getAllUsers', () => {
    it('delegates to profileService.getAllUsers', async () => {
      const mockUsers: any[] = [];
      vi.mocked(fetchAllUsers).mockResolvedValue(mockUsers);

      const res = await getAllUsers();

      expect(fetchAllUsers).toHaveBeenCalled();
      expect(res).toBe(mockUsers);
    });
  });
});
