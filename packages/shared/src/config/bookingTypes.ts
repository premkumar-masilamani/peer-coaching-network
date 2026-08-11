/**
 * Booking and event types.
 */
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;
export const BOOKING_STATUSES = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const EVENT_TYPE = {
  PEER_COACHING: 'peer-coaching',
} as const;
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const BOOKING_ERROR = {
  SLOT_TAKEN: 'SLOT_TAKEN',
  SLOT_ON_HOLD: 'SLOT_ON_HOLD',
  BOOKED_AS_CLIENT: 'BOOKED_AS_CLIENT',
  BOOKED_AS_COACH: 'BOOKED_AS_COACH',
  GOOGLE_TOKEN_EXPIRED: 'GOOGLE_TOKEN_EXPIRED',
  GOOGLE_API_ERROR: 'GOOGLE_API_ERROR',
  UNKNOWN: 'UNKNOWN'
} as const;
export type BookingError = (typeof BOOKING_ERROR)[keyof typeof BOOKING_ERROR];

export const BOOKING_ERROR_MESSAGES: Record<BookingError, string> = {
  [BOOKING_ERROR.SLOT_TAKEN]: 'Sorry, this slot was just scheduled by someone else. Please pick another time.',
  [BOOKING_ERROR.SLOT_ON_HOLD]: 'Someone is currently booking this slot. Please pick another time.',
  [BOOKING_ERROR.BOOKED_AS_CLIENT]: 'You already have a session scheduled at this time. Please pick another slot.',
  [BOOKING_ERROR.BOOKED_AS_COACH]: 'You already have a session scheduled at this time. Please pick another slot.',
  [BOOKING_ERROR.GOOGLE_TOKEN_EXPIRED]: 'Your Google Calendar connection has expired. Please reconnect your account to schedule sessions.',
  [BOOKING_ERROR.GOOGLE_API_ERROR]: 'Network error or Google Calendar API is currently unreachable. Please try again.',
  [BOOKING_ERROR.UNKNOWN]: 'Something went wrong while scheduling. Please try again.',
};

export const SCHEDULE_MODAL_STATUS = {
  IDLE: 'idle',
  BOOKING: 'booking',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;
export type ScheduleModalStatus = (typeof SCHEDULE_MODAL_STATUS)[keyof typeof SCHEDULE_MODAL_STATUS];
