/**
 * General application-wide constants.
 */
export const BOOKING_START_OFFSET_DAYS = 1;
export const BOOKING_HORIZON_DAYS = 60;

export const ENABLE_GOOGLE_INTEGRATION = import.meta.env.VITE_ENABLE_GOOGLE_INTEGRATION !== 'false';

export const DEV_API_URL = 'http://localhost:5000/api';
export const PROD_API_URL = 'https://app.peercoachingnetwork.com';
