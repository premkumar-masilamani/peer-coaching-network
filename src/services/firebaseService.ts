// ─────────────────────────────────────────────────────────────────────────────
// Barrel module (backward-compatibility surface).
//
// The former 900+ line "god module" has been split into focused, single-domain
// services. This file re-exports their public API so existing importers keep a
// single, stable entry point. It contains NO logic and NO side effects of its
// own — the only import-time side effect is Firebase bootstrap, which lives in
// `firebaseApp.ts`.
//
//   • types.ts          — side-effect-free domain types
//   • firebaseApp.ts    — Firebase bootstrap (app/auth/db/analytics/emulators)
//   • authService.ts    — Google auth + session lifecycle
//   • profileService.ts — profile CRUD, admin queries, role/status helpers
//   • scheduleService.ts— availability template read/write + time helpers
//   • slotsService.ts   — availability-cache recalculation + Google busy merge
//   • supportService.ts — support/feedback tickets
//   • discoveryService.ts — coach discovery + booking queries
//
// Prefer importing directly from the specific service in new code.
// ─────────────────────────────────────────────────────────────────────────────

export type {
  TimeRangeTimestamp,
  DayAvailability,
  AvailableDays,
  UserProfile,
  SupportMessage,
  SupportRequest,
  DiscoveryFilters,
} from './types';

export { db, auth, isFirebaseConfigured, firebaseConfigError, logAnalyticsEvent } from './firebaseApp';

export {
  loginWithGoogle,
  handleAuthRedirect,
  logout,
  subscribeToAuth,
} from './authService';

export {
  getProfile,
  updateProfile,
  updateOwnProfile,
  getEffectiveStatus,
  getEffectiveRole,
  isApproved,
  formatMemberSince,
  getAllUsers,
  getUsersPage,
  getActiveCoaches,
  getPendingUsersCount,
  setUserRoleAndStatus,
  formatDisplayName,
  updateVerifiedCredentials,
  getProfiles,
} from './profileService';

export {
  timeStringToTimestamp,
  timestampToTimeString,
  DEFAULT_AVAILABLE_DAYS,
  getSchedule,
  updateSchedule,
} from './scheduleService';

export {
  subtractBusyIntervals,
  getGoogleBusyIntervals,
  recalculateAvailableSlotsCache,
  lazyRecalculateAvailableSlotsCache,
  getUserAvailableSlots,
  getCoachBusySlots,
} from './slotsService';

export {
  createSupportRequest,
  getSupportRequestsForUser,
  getAllSupportRequests,
  getSupportRequestsPage,
  getSupportMessages,
  addMessageToSupportRequest,
  updateSupportRequestStatus,
  deleteSupportRequest,
} from './supportService';

export {
  queryAvailableCoachesForDay,
  getUserBookings,
} from './discoveryService';
