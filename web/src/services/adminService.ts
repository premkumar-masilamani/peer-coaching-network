import { getSystemLogs, type SystemLogEntry } from './systemLogsService';
import { getCoachSessions } from './googleCalendar';
import { getAllUsers as fetchAllUsers, getUsersPage as fetchUsersPage, getPendingUsers as fetchPendingUsers } from './profileService';
import type { CalendarEvent } from './googleCalendar';
import type { UserProfile } from './types';
import type { LogSeverity } from '../config';

export { getSystemLogsByUser, type SystemLogEntry } from './systemLogsService';
export { type CalendarEvent } from './googleCalendar';

/**
 * Fetch a paginated page of system logs for the admin log viewer.
 */
export const getLogsPage = async (options: {
  severities: LogSeverity[];
  pageCursor?: unknown;
  pageSize?: number;
}): Promise<{ logs: SystemLogEntry[]; nextCursor: unknown | null; hasMore: boolean }> => {
  return getSystemLogs(options);
};

/**
 * Fetch all sessions for a specific user (coach/client) for the admin view.
 */
export const getUserBookingStats = async (userId: string): Promise<CalendarEvent[]> => {
  return getCoachSessions(userId);
};

/**
 * Fetch all user profiles for the admin user management view.
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  return fetchAllUsers();
};

/**
 * Fetch one page of user profiles for the admin user management view. Bounds the
 * initial read; callers pass the returned `nextCursor` back to load more.
 */
export const getUsersPage = async (options: {
  pageSize: number;
  pageCursor?: unknown;
}): Promise<{ users: UserProfile[]; nextCursor: unknown | null; hasMore: boolean }> => {
  return fetchUsersPage(options.pageSize, options.pageCursor);
};

/**
 * Fetch the full (small, transient) set of pending users for the approval
 * workflow and the pending badge, independent of roster pagination.
 */
export const getPendingUsers = async (): Promise<UserProfile[]> => {
  return fetchPendingUsers();
};
