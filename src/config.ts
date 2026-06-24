// Application Configuration
// ─────────────────────────────────────────────────────────────────────────────
// All fixed / enum-like values used across the application live here.
// Import from this file instead of hard-coding string literals in components.

// ── Booking ───────────────────────────────────────────────────────────────────

/**
 * The number of days from today when booking is allowed to start.
 * Set to 1 to prevent booking for "today" and only allow bookings starting tomorrow.
 */
export const BOOKING_START_OFFSET_DAYS = 1;

/**
 * The booking horizon in days (e.g. 60 days is ~8.5 weeks).
 * This defines how far in advance users are allowed to book.
 */
export const BOOKING_HORIZON_DAYS = 60;

// ── Booking Status ────────────────────────────────────────────────────────────

/**
 * Status of a coaching session booking.
 * 'confirmed' - scheduled and active session.
 * 'cancelled' - cancelled session.
 */
export const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;
export const BOOKING_STATUSES = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// ── Feature flags ─────────────────────────────────────────────────────────────

/**
 * Flag to enable/disable Google Calendar interactions (events, freebusy, Meet links).
 * Defaults to true. Set VITE_ENABLE_GOOGLE_INTEGRATION=false to disable.
 */
export const ENABLE_GOOGLE_INTEGRATION = import.meta.env.VITE_ENABLE_GOOGLE_INTEGRATION !== 'false';

// ── Gender ────────────────────────────────────────────────────────────────────

/**
 * Canonical list of gender options used across the application.
 * Import from here — do not hard-code gender strings in components.
 */
export const GENDER = {
  FEMALE: 'Female',
  MALE:   'Male',
  OTHERS: 'Others',
} as const;
export const GENDER_OPTIONS = [GENDER.FEMALE, GENDER.MALE, GENDER.OTHERS] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

// ── Theme ─────────────────────────────────────────────────────────────────────

/**
 * Supported application theme values.
 * Import from here — do not hard-code theme strings in components.
 * Legacy 'system' values stored in Firestore are treated as 'dark'.
 */
export const THEME = {
  LIGHT: 'light',
  DARK:  'dark',
} as const;
export const THEME_OPTIONS = [THEME.LIGHT, THEME.DARK] as const;
export type Theme = (typeof THEME_OPTIONS)[number];

// ── Qualifications (ICF credentials) ─────────────────────────────────────────

/**
 * ICF coaching credential tiers supported by the platform.
 * Import from here — do not repeat the inline union type in components.
 */
export const QUALIFICATION = {
  ACC: 'ICF ACC',
  PCC: 'ICF PCC',
  MCC: 'ICF MCC',
} as const;
export const QUALIFICATION_OPTIONS = [QUALIFICATION.ACC, QUALIFICATION.PCC, QUALIFICATION.MCC] as const;
export type Qualification = (typeof QUALIFICATION_OPTIONS)[number];

// ── User roles ────────────────────────────────────────────────────────────────

/**
 * Possible values for userRole on a UserProfile.
 * 'user'  — standard approved coach.
 * 'admin' — platform administrator.
 */
export const USER_ROLE = {
  USER:  'user',
  ADMIN: 'admin',
} as const;
export const USER_ROLES = [USER_ROLE.USER, USER_ROLE.ADMIN] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── User statuses ─────────────────────────────────────────────────────────────

/**
 * Possible values for userStatus on a UserProfile.
 * 'active'   — fully approved, can log in and use the app.
 * 'inactive' — pending admin review.
 */
export const USER_STATUS = {
  ACTIVE:   'active',
  INACTIVE: 'inactive',
} as const;
export const USER_STATUSES = [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// ── Log severity ──────────────────────────────────────────────────────────────

/**
 * Severity levels written to the systemLogs Firestore collection.
 */
export const LOG_SEVERITY = {
  ERROR: 'error',
  WARN:  'warn',
  INFO:  'info',
} as const;
export const LOG_SEVERITIES = [LOG_SEVERITY.ERROR, LOG_SEVERITY.WARN, LOG_SEVERITY.INFO] as const;
export type LogSeverity = (typeof LOG_SEVERITIES)[number];

// ── Navigation tab keys ───────────────────────────────────────────────────────

/**
 * All navigation tab key strings used by the flat router in App.tsx.
 * Always reference these constants instead of bare string literals so
 * a rename only needs to happen in one place.
 */
export const TABS = {
  DASHBOARD:    'dashboard',
  PROFILE:      'profile',
  AVAILABILITY: 'availability',
  BOOKINGS:     'bookings',
  ADMIN:        'admin',
  SYSTEM_LOGS:  'system-logs',
  SUPPORT:      'support',
  SUPPORT_REQUESTS: 'support-requests',
} as const;
export type TabKey = (typeof TABS)[keyof typeof TABS];

// ── Calendar Event Type ───────────────────────────────────────────────────────

/**
 * Type tag used on CalendarEvent objects to distinguish PCN sessions.
 */
export const EVENT_TYPE = {
  PEER_COACHING: 'peer-coaching',
} as const;
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

// ── Booking Error Codes ───────────────────────────────────────────────────────

/**
 * Specific booking-related error codes thrown by the service layer.
 */
export const BOOKING_ERROR = {
  SLOT_TAKEN: 'SLOT_TAKEN',
  BOOKED_AS_CLIENT: 'BOOKED_AS_CLIENT',
  BOOKED_AS_COACH: 'BOOKED_AS_COACH',
} as const;
export type BookingError = (typeof BOOKING_ERROR)[keyof typeof BOOKING_ERROR];

// ── Support Categories ────────────────────────────────────────────────────────

/**
 * Categories for support and feedback tickets.
 */
export const SUPPORT_CATEGORY = {
  BUG: 'Report Bugs',
  FEATURE: 'Feature Request',
  INQUIRY: 'General Inquiry',
} as const;
export const SUPPORT_CATEGORIES = [SUPPORT_CATEGORY.BUG, SUPPORT_CATEGORY.FEATURE, SUPPORT_CATEGORY.INQUIRY] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

