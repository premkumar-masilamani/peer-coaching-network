import { fetchSystemLogsPage, fetchSystemLogsByUser, type SystemLogRecord } from './firestoreRepository';
import type { LogSeverity } from '../config';

// Public shape of a system-log row for the admin log viewer.
export type SystemLogEntry = SystemLogRecord;

// Default number of rows shown per page in the admin log viewer.
export const SYSTEM_LOGS_PAGE_SIZE = 100;

/**
 * Read one page of system logs (newest first), optionally filtered by severity.
 * Delegates the database access to the Firestore repository; the returned
 * `nextCursor` is an opaque token to pass back for the following page.
 */
export const getSystemLogs = async (options: {
  severities: LogSeverity[];
  pageCursor?: unknown;
  pageSize?: number;
}): Promise<{ logs: SystemLogEntry[]; nextCursor: unknown | null; hasMore: boolean }> => {
  return fetchSystemLogsPage({
    severities: options.severities,
    pageCursor: options.pageCursor,
    pageSize: options.pageSize ?? SYSTEM_LOGS_PAGE_SIZE,
  });
};

/**
 * Read recent system logs for a specific user (newest first).
 */
export const getSystemLogsByUser = async (
  userId: string,
  limitCount = 20
): Promise<SystemLogEntry[]> => {
  return fetchSystemLogsByUser(userId, limitCount);
};
