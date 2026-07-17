/**
 * System and operational enumerations.
 */
export const LOG_SEVERITY = {
  ERROR: 'error',
  WARN:  'warn',
  INFO:  'info',
} as const;
export const LOG_SEVERITIES = [LOG_SEVERITY.ERROR, LOG_SEVERITY.WARN, LOG_SEVERITY.INFO] as const;
export type LogSeverity = (typeof LOG_SEVERITIES)[number];

export const TABS = {
  DASHBOARD:    'dashboard',
  PROFILE:      'profile',
  AVAILABILITY: 'availability',
  BOOKINGS:     'bookings',
  ADMIN:        'admin',
  SUPPORT:      'support',
  DIRECTORY:    'directory',
} as const;
export type TabKey = (typeof TABS)[keyof typeof TABS];

export const SUPPORT_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;
export const SUPPORT_STATUSES = [SUPPORT_STATUS.OPEN, SUPPORT_STATUS.CLOSED] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_CATEGORY = {
  BUG: 'Report Bugs',
  FEATURE: 'Feature Request',
  INQUIRY: 'General Inquiry',
} as const;
export const SUPPORT_CATEGORIES = [SUPPORT_CATEGORY.BUG, SUPPORT_CATEGORY.FEATURE, SUPPORT_CATEGORY.INQUIRY] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

