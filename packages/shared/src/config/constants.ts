/**
 * General application-wide constants.
 */
export const BOOKING_START_OFFSET_DAYS = 1;
export const BOOKING_HORIZON_DAYS = 14;
export const COACH_DISCOVERY_LIMIT = 5;
export const SUPPORT_EMAIL = 'premkumar.masilamani.2020@gmail.com';

/** Duration of a single bookable availability slot, in milliseconds (30 minutes). */
export const SLOT_DURATION_MS = 30 * 60 * 1000;
/** Standard Google OAuth access token lifetime in milliseconds (60 minutes). */
export const GOOGLE_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
/** Safety buffer before Google OAuth token expires (2 minutes). */
export const GOOGLE_TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000;
/** Google Calendar freeBusy endpoint, used to subtract busy hours from availability. */
export const GOOGLE_FREE_BUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

/**
 * Page size for Google Calendar events list requests. 250 is Google's default
 * cap; we set it explicitly and follow `nextPageToken` so busy calendars are not
 * silently truncated.
 */
export const GOOGLE_EVENTS_PAGE_SIZE = 250;

export const ICF_DIRECTORY_URL = 'https://apps.coachingfederation.org/eweb/DynamicPage.aspx?webcode=ICFDirectory&firstname={firstName}&lastname={lastName}';

export const SYSTEM_LOGS_TTL_DAYS = 7;
export const SUPPORT_REQUESTS_CLOSED_TTL_DAYS = 7;
export const ALLOWED_BOOKING_DURATIONS_MIN = [30, 60] as const;
export const MAX_SLOTS_PER_DAY = 48;

export const CRON_SCHEDULES = {
  DAILY_HOUSEKEEPING: "0 2 * * *",
} as const;

export const INPUT_LIMITS = {
  NAME: 100,
  BIO: 2500,
  SUPPORT_SUBJECT: 250,
  SUPPORT_MESSAGE: 2500,
  COACHING_TOPIC: 2500,
  CREDENTIAL_DETAILS: 2500,
} as const;
