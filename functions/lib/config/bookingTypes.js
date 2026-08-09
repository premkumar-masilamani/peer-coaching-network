"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEDULE_MODAL_STATUS = exports.BOOKING_ERROR_MESSAGES = exports.BOOKING_ERROR = exports.EVENT_TYPE = exports.BOOKING_STATUSES = exports.BOOKING_STATUS = void 0;
/**
 * Booking and event types.
 */
exports.BOOKING_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
};
exports.BOOKING_STATUSES = [exports.BOOKING_STATUS.PENDING, exports.BOOKING_STATUS.CONFIRMED, exports.BOOKING_STATUS.CANCELLED];
exports.EVENT_TYPE = {
    PEER_COACHING: 'peer-coaching',
};
exports.BOOKING_ERROR = {
    SLOT_TAKEN: 'SLOT_TAKEN',
    BOOKED_AS_CLIENT: 'BOOKED_AS_CLIENT',
    BOOKED_AS_COACH: 'BOOKED_AS_COACH',
    GOOGLE_TOKEN_EXPIRED: 'GOOGLE_TOKEN_EXPIRED',
    GOOGLE_API_ERROR: 'GOOGLE_API_ERROR',
    UNKNOWN: 'UNKNOWN'
};
exports.BOOKING_ERROR_MESSAGES = {
    [exports.BOOKING_ERROR.SLOT_TAKEN]: 'Sorry, this slot was just scheduled by someone else. Please pick another time.',
    [exports.BOOKING_ERROR.BOOKED_AS_CLIENT]: 'You already have a session scheduled at this time. Please pick another slot.',
    [exports.BOOKING_ERROR.BOOKED_AS_COACH]: 'You already have a session scheduled at this time. Please pick another slot.',
    [exports.BOOKING_ERROR.GOOGLE_TOKEN_EXPIRED]: 'Your Google Calendar connection has expired. Please reconnect your account to schedule sessions.',
    [exports.BOOKING_ERROR.GOOGLE_API_ERROR]: 'Network error or Google Calendar API is currently unreachable. Please try again.',
    [exports.BOOKING_ERROR.UNKNOWN]: 'Something went wrong while scheduling. Please try again.',
};
exports.SCHEDULE_MODAL_STATUS = {
    IDLE: 'idle',
    BOOKING: 'booking',
    SUCCESS: 'success',
    ERROR: 'error',
};
//# sourceMappingURL=bookingTypes.js.map