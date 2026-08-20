/**
 * Firestore collection names.
 */
export const COLLECTIONS = {
  USERS: 'users',
  USERS_SCHEDULE: 'schedule',
  USERS_SCHEDULE_AVAILABLE_DAYS: 'availableDays',
  USERS_SCHEDULE_BLOCKED_DATES: 'blockedDates',
  BOOKINGS: 'bookings',
  AVAILABILITY: 'availability',
  SUPPORT_REQUESTS: 'supportRequests',
  SUPPORT_REQUESTS_MESSAGES: 'messages',
  SYSTEM_LOGS: 'systemLogs',
} as const;
