import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOG_SEVERITY } from '../../config';

vi.mock('../firebaseApp', () => ({
  db: { type: 'mock-db' },
  auth: { currentUser: null },
}));

vi.mock('../googleCalendar', () => ({
  getCoachSessions: vi.fn(),
}));

vi.mock('../profileService', () => ({
  getAllUsers: vi.fn(),
  getUsersPage: vi.fn(),
  getPendingUsers: vi.fn(),
}));

vi.mock('../systemLogsService', () => ({
  getSystemLogs: vi.fn(),
  getSystemLogsByUser: vi.fn(),
  SYSTEM_LOGS_PAGE_SIZE: 100,
}));

import { getLogsPage, getSystemLogsByUser } from '../adminService';
import * as systemLogsService from '../systemLogsService';

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLogsPage should delegate to getSystemLogs', async () => {
    const mockResult = { logs: [], nextCursor: null, hasMore: false };
    vi.mocked(systemLogsService.getSystemLogs).mockResolvedValueOnce(mockResult);

    const options = { severities: [LOG_SEVERITY.ERROR] };
    const result = await getLogsPage(options);

    expect(systemLogsService.getSystemLogs).toHaveBeenCalledWith(options);
    expect(result).toBe(mockResult);
  });

  it('getSystemLogsByUser should delegate to systemLogsService.getSystemLogsByUser', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        type: LOG_SEVERITY.WARN,
        event: 'WARN_EVENT',
        userId: 'user-123',
        userEmail: 'user@example.com',
        errorMessage: null,
        timestamp: 1000,
        expireAt: 2000,
      },
    ];
    vi.mocked(systemLogsService.getSystemLogsByUser).mockResolvedValueOnce(mockLogs);

    const result = await getSystemLogsByUser('user-123', 20);

    expect(systemLogsService.getSystemLogsByUser).toHaveBeenCalledWith('user-123', 20);
    expect(result).toBe(mockLogs);
  });
});
