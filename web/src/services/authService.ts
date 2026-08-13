import {
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  type Gender,
  type UserRole,
  type UserStatus,
  USER_ROLE,
  USER_STATUS,
} from '../config';
import { auth, db } from './firebaseApp';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  writeSchedule,
} from './firestoreRepository';
import { setGoogleToken, clearGoogleToken } from './googleToken';
import { syncCalendar } from './googleCalendar';
import { DEFAULT_AVAILABLE_DAYS } from './scheduleService';
import type { UserProfile } from './types';
import { logger } from '../utils/logger';

// Standardized Auth Actions
const registerOrSyncGoogleUser = async (user: User, credentialAccessToken?: string): Promise<void> => {
  if (!db) return;

  // Hold the access token in memory only (never persisted) for Calendar API calls
  if (credentialAccessToken) {
    setGoogleToken(credentialAccessToken);
  }

  // Check/create user document in firestore
  const existingProfile = await getUserProfile(user.uid);

  if (!existingProfile) {
    const email = user.email;
    const displayName = user.displayName;
    if (!email || !displayName) {
      throw new Error('Google Sign-In did not return a valid email or display name.');
    }

    const cleanEmail = email.toLowerCase();

    const parts = displayName.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const assignedRole: UserRole = USER_ROLE.USER;
    const initialStatus: UserStatus = USER_STATUS.INACTIVE;

    // Create new user profile (createdAt is stamped by the repository).
    const newProfile: Omit<UserProfile, 'createdAt'> = {
      userId: user.uid,
      email: cleanEmail,
      firstName,
      lastName,
      displayName,
      photoURL: user.photoURL,
      userRole: assignedRole,
      userStatus: initialStatus,
      gender: '' as unknown as Gender,
      country: '',
      bio: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      icf_acc: false,
      icf_pcc: false,
      icf_mcc: false,
      icf_actc: false
    };
    await createUserProfile(user.uid, newProfile);

    // Initialize schedule sub-collection documents with defaults.
    await writeSchedule(user.uid, DEFAULT_AVAILABLE_DAYS, []);
  } else {
    // Sync Google Profile data in database during login (Google takes priority)
    const updates: Partial<UserProfile> = {};
    if (user.displayName) {
      const parts = user.displayName.trim().split(' ');
      const inFirst = parts[0] || '';
      const inLast = parts.slice(1).join(' ') || '';

      if (existingProfile.firstName !== inFirst || existingProfile.lastName !== inLast) {
        updates.firstName = inFirst;
        updates.lastName = inLast;
      }
      if (existingProfile.displayName !== user.displayName) {
        updates.displayName = user.displayName;
      }
    }
    const incomingEmail = user.email ? user.email.toLowerCase() : null;
    if (incomingEmail && existingProfile.email !== incomingEmail) {
      updates.email = incomingEmail;
    }
    if (user.photoURL && existingProfile.photoURL !== user.photoURL) {
      updates.photoURL = user.photoURL;
    }

    if (Object.keys(updates).length > 0) {
      await updateUserProfile(user.uid, updates);
    }
  }
};

// Guard against firing signInWithRedirect more than once before the browser
// actually navigates away. Expiry can be detected from several places at nearly
// the same time (dashboard load, a window-focus refresh, a booking attempt);
// without this, each could kick off its own redirect.
let redirectInFlight = false;

export const loginWithGoogle = async (): Promise<void> => {
  if (redirectInFlight) return;
  redirectInFlight = true;

  const provider = new GoogleAuthProvider();
  // Request Google Calendar access. Only the events scope is needed: every
  // Calendar API call in this app is event CRUD on the user's primary calendar
  // (create/patch/delete events, freeBusy queries). The broader `auth/calendar`
  // scope (full calendar management) is intentionally NOT requested — it would
  // enlarge the blast radius of a stolen token and worsen the consent screen.
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  // Force Google to prompt the user to select an account on login
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await signInWithRedirect(auth, provider);
  } catch (e) {
    // Navigation never happened, so allow a later retry.
    redirectInFlight = false;
    throw e;
  }
};

export const handleAuthRedirect = async (): Promise<boolean> => {
  const result = await getRedirectResult(auth);
  if (!result) {
    return false;
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  let token = credential?.accessToken || undefined;
  const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
  if (!token && isEmulator) {
    token = 'mock-emulator-google-token';
  }
  await registerOrSyncGoogleUser(result.user, token);
  
  if (token) {
    syncCalendar().catch(err => logger.error('Failed to sync calendar after login:', err));
  }
  
  return true;
};

export const logout = async (): Promise<void> => {
  clearGoogleToken();
  await signOut(auth);
};

export const subscribeToAuth = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};
