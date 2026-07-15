import { getSystemLogs, type SystemLogEntry } from './systemLogsService';
import { getCoachSessions } from './googleCalendar';
import { getAllUsers as fetchAllUsers } from './profileService';
import type { CalendarEvent } from './googleCalendar';
import type { UserProfile } from './types';
import type { LogSeverity } from '../config';

export { type SystemLogEntry } from './systemLogsService';
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
