"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORT_CATEGORIES = exports.SUPPORT_CATEGORY = exports.SUPPORT_STATUSES = exports.SUPPORT_STATUS = exports.TABS = exports.LOG_SEVERITIES = exports.LOG_SEVERITY = void 0;
/**
 * System and operational enumerations.
 */
exports.LOG_SEVERITY = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
};
exports.LOG_SEVERITIES = [exports.LOG_SEVERITY.ERROR, exports.LOG_SEVERITY.WARN, exports.LOG_SEVERITY.INFO];
exports.TABS = {
    DASHBOARD: 'dashboard',
    PROFILE: 'profile',
    AVAILABILITY: 'availability',
    BOOKINGS: 'bookings',
    ADMIN: 'admin',
    SUPPORT: 'support',
};
exports.SUPPORT_STATUS = {
    OPEN: 'open',
    CLOSED: 'closed',
};
exports.SUPPORT_STATUSES = [exports.SUPPORT_STATUS.OPEN, exports.SUPPORT_STATUS.CLOSED];
exports.SUPPORT_CATEGORY = {
    BUG: 'Report Bugs',
    FEATURE: 'Feature Request',
    INQUIRY: 'General Inquiry',
};
exports.SUPPORT_CATEGORIES = [exports.SUPPORT_CATEGORY.BUG, exports.SUPPORT_CATEGORY.FEATURE, exports.SUPPORT_CATEGORY.INQUIRY];
//# sourceMappingURL=systemTypes.js.map