import {
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import {
  type Gender,
  type UserRole,
  type UserStatus,
  USER_ROLE,
  USER_STATUS,
  THEME,
  COLLECTIONS,
} from '../config';
import { auth, db } from './firebaseApp';
import { setGoogleToken, clearGoogleToken } from './googleToken';
import { DEFAULT_AVAILABLE_DAYS } from './scheduleService';
import type { UserProfile } from './types';

// Standardized Auth Actions
const registerOrSyncGoogleUser = async (user: User, credentialAccessToken?: string): Promise<void> => {
  if (!db) return;

  // Hold the access token in memory only (never persisted) for Calendar API calls
  if (credentialAccessToken) {
    setGoogleToken(credentialAccessToken);
  }

  // Check/create user document in firestore
  const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
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

    // Create new user profile
    const newProfile: UserProfile = {
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
      createdAt: Timestamp.now(),
      theme: THEME.LIGHT,
      icf_acc: false,
      icf_pcc: false,
      icf_mcc: false,
      icf_actc: false
    };
    await setDoc(userDocRef, newProfile as DocumentData);

    // Initialize schedule sub-collection documents
    const availableDaysRef = doc(db, COLLECTIONS.USERS, user.uid, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
    const blockedDatesRef = doc(db, COLLECTIONS.USERS, user.uid, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
    await setDoc(availableDaysRef, DEFAULT_AVAILABLE_DAYS);
    await setDoc(blockedDatesRef, { blockedDates: [] });
  } else {
    // Sync Google Profile data in database during login (Google takes priority)
    const existingProfile = userDoc.data() as UserProfile;
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
      await updateDoc(userDocRef, updates);
    }
  }
};

export const loginWithGoogle = async (): Promise<void> => {
  const provider = new GoogleAuthProvider();
  // Request Google Calendar access
  provider.addScope('https://www.googleapis.com/auth/calendar');
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  // Force Google to prompt the user to select an account on login
  provider.setCustomParameters({ prompt: 'select_account' });

  await signInWithRedirect(auth, provider);
};

export const handleAuthRedirect = async (): Promise<boolean> => {
  const result = await getRedirectResult(auth);
  if (!result) {
    return false;
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  await registerOrSyncGoogleUser(result.user, credential?.accessToken || undefined);
  return true;
};

export const logout = async (): Promise<void> => {
  clearGoogleToken();
  await signOut(auth);
};

export const subscribeToAuth = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};
