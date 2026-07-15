/**
 * General application-wide constants.
 */
export const BOOKING_START_OFFSET_DAYS = 1;
export const BOOKING_HORIZON_DAYS = 30;
export const COACH_DISCOVERY_LIMIT = 5;

/** Duration of a single bookable availability slot, in milliseconds (30 minutes). */
export const SLOT_DURATION_MS = 30 * 60 * 1000;

const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
export const ENABLE_GOOGLE_INTEGRATION = !isEmulator && import.meta.env.VITE_ENABLE_GOOGLE_INTEGRATION !== 'false';

export const DEV_API_URL = 'http://localhost:5000/api';
export const PROD_API_URL = 'https://app.peercoachingnetwork.com';

/** Google Calendar freeBusy endpoint, used to subtract busy hours from availability. */
export const GOOGLE_FREE_BUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

/**
 * Page size for Google Calendar events list requests. 250 is Google's default
 * cap; we set it explicitly and follow `nextPageToken` so busy calendars are not
 * silently truncated.
 */
export const GOOGLE_EVENTS_PAGE_SIZE = 250;

export const ICF_DIRECTORY_URL = 'https://apps.coachingfederation.org/eweb/DynamicPage.aspx?webcode=ICFDirectory&firstname={firstName}&lastname={lastName}';

export const INPUT_LIMITS = {
  BIO: 2000,
  SUPPORT_SUBJECT: 200,
  SUPPORT_MESSAGE: 2000,
  COACHING_TOPIC: 1000,
} as const;
