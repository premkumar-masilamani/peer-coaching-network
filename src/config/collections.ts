/**
 * Firestore collection names.
 */
export const COLLECTIONS = {
  USERS: 'users',
  SCHEDULE: 'schedule',
  AVAILABLE_DAYS: 'availableDays',
  BLOCKED_DATES: 'blockedDates',
  BOOKINGS: 'bookings',
  CLIENT_BOOKING_CACHE: 'clientBookingCache',
  BUSY_SLOTS_CACHE: 'busySlotsCache',
  SUPPORT_REQUESTS: 'supportRequests',
  SYSTEM_LOGS: 'systemLogs',
} as const;
