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

/**
 * Canonical list of gender options used across the application.
 * Import from here — do not hard-code gender strings in components.
 */
export const GENDER_OPTIONS = ['Female', 'Male', 'Others'] as const;
export type GenderValue = (typeof GENDER_OPTIONS)[number];

/**
 * Supported application theme values.
 * Import from here — do not hard-code theme strings in components.
 * Legacy 'system' values stored in Firestore are treated as 'dark'.
 */
export const THEME_OPTIONS = ['light', 'dark'] as const;
export type ThemeValue = (typeof THEME_OPTIONS)[number];
