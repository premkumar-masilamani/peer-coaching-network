"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INPUT_LIMITS = exports.ICF_DIRECTORY_URL = exports.GOOGLE_EVENTS_PAGE_SIZE = exports.GOOGLE_FREE_BUSY_URL = exports.PROD_API_URL = exports.DEV_API_URL = exports.ENABLE_GOOGLE_INTEGRATION = exports.SLOT_DURATION_MS = exports.COACH_DISCOVERY_LIMIT = exports.BOOKING_HORIZON_DAYS = exports.BOOKING_START_OFFSET_DAYS = void 0;
/**
 * General application-wide constants.
 */
exports.BOOKING_START_OFFSET_DAYS = 1;
exports.BOOKING_HORIZON_DAYS = 30;
exports.COACH_DISCOVERY_LIMIT = 5;
/** Duration of a single bookable availability slot, in milliseconds (30 minutes). */
exports.SLOT_DURATION_MS = 30 * 60 * 1000;
const isEmulator = process.env.VITE_USE_FIREBASE_EMULATOR === 'true';
exports.ENABLE_GOOGLE_INTEGRATION = !isEmulator && process.env.VITE_ENABLE_GOOGLE_INTEGRATION !== 'false';
exports.DEV_API_URL = 'http://localhost:5000/api';
exports.PROD_API_URL = 'https://app.peercoachingnetwork.com';
/** Google Calendar freeBusy endpoint, used to subtract busy hours from availability. */
exports.GOOGLE_FREE_BUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
/**
 * Page size for Google Calendar events list requests. 250 is Google's default
 * cap; we set it explicitly and follow `nextPageToken` so busy calendars are not
 * silently truncated.
 */
exports.GOOGLE_EVENTS_PAGE_SIZE = 250;
exports.ICF_DIRECTORY_URL = 'https://apps.coachingfederation.org/eweb/DynamicPage.aspx?webcode=ICFDirectory&firstname={firstName}&lastname={lastName}';
exports.INPUT_LIMITS = {
    BIO: 2000,
    SUPPORT_SUBJECT: 200,
    SUPPORT_MESSAGE: 2000,
    COACHING_TOPIC: 1000,
    CREDENTIAL_DETAILS: 1000,
};
//# sourceMappingURL=constants.js.map