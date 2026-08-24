import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSystemLogs, getSystemLogsByUser, SYSTEM_LOGS_PAGE_SIZE } from '../systemLogsService';
import * as firestoreRepository from '../firestoreRepository';
import { LOG_SEVERITY } from '../../config';

vi.mock('../firestoreRepository', () => ({
  fetchSystemLogsPage: vi.fn(),
  fetchSystemLogsByUser: vi.fn(),
}));

describe('systemLogsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSystemLogs', () => {
    it('should delegate to fetchSystemLogsPage with default page size', async () => {
      const mockResult = {
        logs: [
          {
            id: 'log-1',
            type: LOG_SEVERITY.ERROR,
            event: 'ERROR_EVENT',
            userId: 'user-1',
            userEmail: 'user1@example.com',
            errorMessage: 'Test error',
            timestamp: 1000,
            expireAt: 2000,
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
      vi.mocked(firestoreRepository.fetchSystemLogsPage).mockResolvedValueOnce(mockResult);

      const result = await getSystemLogs({ severities: [LOG_SEVERITY.ERROR] });

      expect(firestoreRepository.fetchSystemLogsPage).toHaveBeenCalledWith({
        severities: [LOG_SEVERITY.ERROR],
        pageCursor: undefined,
        pageSize: SYSTEM_LOGS_PAGE_SIZE,
      });
      expect(result).toEqual(mockResult);
    });

    it('should pass custom pageSize and pageCursor', async () => {
      const mockCursor = { id: 'cursor-doc' };
      vi.mocked(firestoreRepository.fetchSystemLogsPage).mockResolvedValueOnce({
        logs: [],
        nextCursor: null,
        hasMore: false,
      });

      await getSystemLogs({
        severities: [LOG_SEVERITY.WARN],
        pageCursor: mockCursor,
        pageSize: 50,
      });

      expect(firestoreRepository.fetchSystemLogsPage).toHaveBeenCalledWith({
        severities: [LOG_SEVERITY.WARN],
        pageCursor: mockCursor,
        pageSize: 50,
      });
    });
  });

  describe('getSystemLogsByUser', () => {
    it('should delegate to fetchSystemLogsByUser with default limit', async () => {
      const mockUserLogs = [
        {
          id: 'log-1',
          type: LOG_SEVERITY.ERROR,
          event: 'CALENDAR_ERROR',
          userId: 'user-abc',
          userEmail: 'abc@example.com',
          errorMessage: 'Cal sync failed',
          timestamp: 1500,
          expireAt: 2500,
        },
      ];
      vi.mocked(firestoreRepository.fetchSystemLogsByUser).mockResolvedValueOnce(mockUserLogs);

      const result = await getSystemLogsByUser('user-abc');

      expect(firestoreRepository.fetchSystemLogsByUser).toHaveBeenCalledWith('user-abc', 20);
      expect(result).toEqual(mockUserLogs);
    });

    it('should delegate to fetchSystemLogsByUser with custom limit', async () => {
      vi.mocked(firestoreRepository.fetchSystemLogsByUser).mockResolvedValueOnce([]);

      const result = await getSystemLogsByUser('user-xyz', 50);

      expect(firestoreRepository.fetchSystemLogsByUser).toHaveBeenCalledWith('user-xyz', 50);
      expect(result).toEqual([]);
    });
  });
});
