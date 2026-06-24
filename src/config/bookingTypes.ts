/**
 * Booking and event types.
 */
export const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;
export const BOOKING_STATUSES = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const EVENT_TYPE = {
  PEER_COACHING: 'peer-coaching',
} as const;
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const BOOKING_ERROR = {
  SLOT_TAKEN: 'SLOT_TAKEN',
  BOOKED_AS_CLIENT: 'BOOKED_AS_CLIENT',
  BOOKED_AS_COACH: 'BOOKED_AS_COACH',
} as const;
export type BookingError = (typeof BOOKING_ERROR)[keyof typeof BOOKING_ERROR];
