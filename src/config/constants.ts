/**
 * General application-wide constants.
 */
export const BOOKING_START_OFFSET_DAYS = 1;
export const BOOKING_HORIZON_DAYS = 14;
export const COACH_DISCOVERY_LIMIT = 10;

const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
export const ENABLE_GOOGLE_INTEGRATION = !isEmulator && import.meta.env.VITE_ENABLE_GOOGLE_INTEGRATION !== 'false';

export const DEV_API_URL = 'http://localhost:5000/api';
export const PROD_API_URL = 'https://app.peercoachingnetwork.com';

export const ICF_DIRECTORY_URL = 'https://apps.coachingfederation.org/eweb/DynamicPage.aspx?webcode=ICFDirectory&firstname={firstName}&lastname={lastName}';

export const INPUT_LIMITS = {
  BIO: 2000,
  SUPPORT_SUBJECT: 200,
  SUPPORT_MESSAGE: 2000,
  COACHING_TOPIC: 1000,
} as const;
