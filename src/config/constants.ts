/**
 * General application-wide constants.
 */
export const BOOKING_START_OFFSET_DAYS = 1;
export const BOOKING_HORIZON_DAYS = 60;

export const USE_FIREBASE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
export const ENABLE_GOOGLE_INTEGRATION = !USE_FIREBASE_EMULATOR;

export const DEV_API_URL = 'http://localhost:5000/api';
export const PROD_API_URL = 'https://app.peercoachingnetwork.com';

export const ICF_DIRECTORY_URL = 'https://apps.coachingfederation.org/eweb/DynamicPage.aspx?webcode=ICFDirectory&firstname={firstName}&lastname={lastName}';
