import {
  // collections
  COLLECTIONS as _COLLECTIONS,
  // bookingTypes
  BOOKING_STATUS as _BOOKING_STATUS,
  BOOKING_STATUSES as _BOOKING_STATUSES,
  EVENT_TYPE as _EVENT_TYPE,
  BOOKING_ERROR as _BOOKING_ERROR,
  BOOKING_ERROR_MESSAGES as _BOOKING_ERROR_MESSAGES,
  SCHEDULE_MODAL_STATUS as _SCHEDULE_MODAL_STATUS,
  // constants
  BOOKING_START_OFFSET_DAYS as _BOOKING_START_OFFSET_DAYS,
  BOOKING_HORIZON_DAYS as _BOOKING_HORIZON_DAYS,
  GOOGLE_TOKEN_LIFETIME_MS as _GOOGLE_TOKEN_LIFETIME_MS,
  GOOGLE_TOKEN_EXPIRY_BUFFER_MS as _GOOGLE_TOKEN_EXPIRY_BUFFER_MS,
  COACH_DISCOVERY_LIMIT as _COACH_DISCOVERY_LIMIT,
  SLOT_DURATION_MS as _SLOT_DURATION_MS,
  GOOGLE_FREE_BUSY_URL as _GOOGLE_FREE_BUSY_URL,
  GOOGLE_EVENTS_PAGE_SIZE as _GOOGLE_EVENTS_PAGE_SIZE,
  ICF_DIRECTORY_URL as _ICF_DIRECTORY_URL,
  INPUT_LIMITS as _INPUT_LIMITS,
  SYSTEM_LOGS_TTL_DAYS as _SYSTEM_LOGS_TTL_DAYS,
  SUPPORT_REQUESTS_CLOSED_TTL_DAYS as _SUPPORT_REQUESTS_CLOSED_TTL_DAYS,
  // systemTypes
  LOG_SEVERITY as _LOG_SEVERITY,
  LOG_SEVERITIES as _LOG_SEVERITIES,
  TABS as _TABS,
  SUPPORT_STATUS as _SUPPORT_STATUS,
  SUPPORT_STATUSES as _SUPPORT_STATUSES,
  SUPPORT_CATEGORY as _SUPPORT_CATEGORY,
  SUPPORT_CATEGORIES as _SUPPORT_CATEGORIES,
  // telemetryErrors
  TelemetryErrors as _TelemetryErrors,
  // userTypes
  GENDER as _GENDER,
  GENDER_OPTIONS as _GENDER_OPTIONS,
  QUALIFICATION as _QUALIFICATION,
  QUALIFICATION_OPTIONS as _QUALIFICATION_OPTIONS,
  USER_ROLE as _USER_ROLE,
  USER_ROLES as _USER_ROLES,
  USER_STATUS as _USER_STATUS,
  USER_STATUSES as _USER_STATUSES,
} from '@pcn/shared';

import type {
  BookingStatus as _BookingStatus,
  EventType as _EventType,
  BookingError as _BookingError,
  ScheduleModalStatus as _ScheduleModalStatus,
  LogSeverity as _LogSeverity,
  TabKey as _TabKey,
  SupportStatus as _SupportStatus,
  SupportCategory as _SupportCategory,
  Gender as _Gender,
  Qualification as _Qualification,
  UserRole as _UserRole,
  UserStatus as _UserStatus,
} from '@pcn/shared';

import { USER_MESSAGES } from './messages';
import type { UserMessages } from './messages';

// Export types
export type {
  _BookingStatus as BookingStatus,
  _EventType as EventType,
  _BookingError as BookingError,
  _ScheduleModalStatus as ScheduleModalStatus,
  _LogSeverity as LogSeverity,
  _TabKey as TabKey,
  _SupportStatus as SupportStatus,
  _SupportCategory as SupportCategory,
  _Gender as Gender,
  _Qualification as Qualification,
  _UserRole as UserRole,
  _UserStatus as UserStatus,
  UserMessages,
};

// Export values
export const COLLECTIONS = _COLLECTIONS;
export const BOOKING_STATUS = _BOOKING_STATUS;
export const BOOKING_STATUSES = _BOOKING_STATUSES;
export const EVENT_TYPE = _EVENT_TYPE;
export const BOOKING_ERROR = _BOOKING_ERROR;
export const BOOKING_ERROR_MESSAGES = _BOOKING_ERROR_MESSAGES;
export const SCHEDULE_MODAL_STATUS = _SCHEDULE_MODAL_STATUS;
export const BOOKING_START_OFFSET_DAYS = _BOOKING_START_OFFSET_DAYS;
export const BOOKING_HORIZON_DAYS = _BOOKING_HORIZON_DAYS;
export const GOOGLE_TOKEN_LIFETIME_MS = _GOOGLE_TOKEN_LIFETIME_MS;
export const GOOGLE_TOKEN_EXPIRY_BUFFER_MS = _GOOGLE_TOKEN_EXPIRY_BUFFER_MS;
export const COACH_DISCOVERY_LIMIT = _COACH_DISCOVERY_LIMIT;
export const SLOT_DURATION_MS = _SLOT_DURATION_MS;
export const GOOGLE_FREE_BUSY_URL = _GOOGLE_FREE_BUSY_URL;
export const GOOGLE_EVENTS_PAGE_SIZE = _GOOGLE_EVENTS_PAGE_SIZE;
export const ICF_DIRECTORY_URL = _ICF_DIRECTORY_URL;
export const INPUT_LIMITS = _INPUT_LIMITS;
export const SYSTEM_LOGS_TTL_DAYS = _SYSTEM_LOGS_TTL_DAYS;
export const SUPPORT_REQUESTS_CLOSED_TTL_DAYS = _SUPPORT_REQUESTS_CLOSED_TTL_DAYS;
export const LOG_SEVERITY = _LOG_SEVERITY;
export const LOG_SEVERITIES = _LOG_SEVERITIES;
export const TABS = _TABS;
export const SUPPORT_STATUS = _SUPPORT_STATUS;
export const SUPPORT_STATUSES = _SUPPORT_STATUSES;
export const SUPPORT_CATEGORY = _SUPPORT_CATEGORY;
export const SUPPORT_CATEGORIES = _SUPPORT_CATEGORIES;
export const TelemetryErrors = _TelemetryErrors;
export const GENDER = _GENDER;
export const GENDER_OPTIONS = _GENDER_OPTIONS;
export const QUALIFICATION = _QUALIFICATION;
export const QUALIFICATION_OPTIONS = _QUALIFICATION_OPTIONS;
export const USER_ROLE = _USER_ROLE;
export const USER_ROLES = _USER_ROLES;
export const USER_STATUS = _USER_STATUS;
export const USER_STATUSES = _USER_STATUSES;
export const APP_URL = (import.meta.env.VITE_APP_URL as string) || '';
export const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string) || '';
export { USER_MESSAGES };

