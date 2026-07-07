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
  PERSONAL_AVAILABILITY_CACHE: 'personalAvailabilityCache',
  COACH_AVAILABILITY_BY_DATE: 'coachAvailabilityByDate',
  SUPPORT_REQUESTS: 'supportRequests',
  SYSTEM_LOGS: 'systemLogs',
} as const;
