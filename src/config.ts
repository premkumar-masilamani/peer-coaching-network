// Application Configuration

/**
 * The number of days from today when booking is allowed to start.
 * Set to 1 to prevent booking for "today" and only allow bookings starting tomorrow.
 */
export const BOOKING_START_OFFSET_DAYS = 1;

/**
 * The booking horizon in days (e.g. 56 days is 8 weeks).
 * This defines how far in advance users are allowed to book.
 */
export const BOOKING_HORIZON_DAYS = 60;

/**
 * Flag to enable/disable google interactions (Google Events, Calendars, etc.).
 * Defaults to true.
 */
export const ENABLE_GOOGLE_INTEGRATION = import.meta.env.VITE_ENABLE_GOOGLE_INTEGRATION !== 'false';
