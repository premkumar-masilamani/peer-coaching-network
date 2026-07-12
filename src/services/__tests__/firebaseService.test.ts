/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect } from 'vitest';
import * as barrel from '../firebaseService';

// firebaseService.ts is now a pure backward-compatibility barrel. Domain
// behaviour is tested in the per-service suites (authService.test.ts,
// profileService.test.ts, scheduleService.test.ts, slotsService.test.ts,
// supportService.test.ts, discoveryService.test.ts, firebaseApp.test.ts).
// This suite only guards that the barrel keeps re-exporting the full public
// surface the app's 20+ importers depend on.
vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock({ currentUser: null }));
vi.mock('firebase/firestore', async () => {
  const { createFirestoreShared, buildFirestoreMock } = await import('./helpers/firebaseMocks');
  return buildFirestoreMock(createFirestoreShared());
});
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());

describe('firebaseService barrel', () => {
  const expectedExports = [
    // firebaseApp
    'db', 'auth', 'isFirebaseConfigured', 'logAnalyticsEvent',
    // authService
    'loginWithGoogle', 'handleAuthRedirect', 'logout', 'subscribeToAuth',
    // profileService
    'subscribeToProfile', 'updateProfile', 'updateOwnProfile', 'getEffectiveStatus',
    'getEffectiveRole', 'isApproved', 'formatMemberSince', 'subscribeToAllUsers',
    'subscribeToActiveCoaches', 'subscribeToPendingUsersCount', 'setUserRoleAndStatus',
    'formatDisplayName', 'updateVerifiedCredentials', 'getProfiles',
    // scheduleService
    'timeStringToTimestamp', 'timestampToTimeString', 'DEFAULT_AVAILABLE_DAYS',
    'getSchedule', 'updateSchedule',
    // slotsService
    'subtractBusyIntervals', 'getGoogleBusyIntervals', 'recalculateAvailableSlotsCache',
    'lazyRecalculateAvailableSlotsCache', 'getUserAvailableSlots',
    // supportService
    'createSupportRequest', 'getSupportRequestsForUser', 'getAllSupportRequests',
    'addMessageToSupportRequest', 'updateSupportRequestStatus', 'deleteSupportRequest',
    // discoveryService
    'queryAvailableCoachesForDay', 'subscribeToUserBookings',
  ];

  it.each(expectedExports)('re-exports %s', (name) => {
    expect((barrel as any)[name]).toBeDefined();
  });

  it('re-exports DEFAULT_AVAILABLE_DAYS as a usable object', () => {
    expect(barrel.DEFAULT_AVAILABLE_DAYS.monday.enabled).toBe(true);
  });
});
