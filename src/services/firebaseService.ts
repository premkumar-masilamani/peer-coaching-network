import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { 
  getAuth, 
  signInWithRedirect, 
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  connectAuthEmulator
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot,
  connectFirestoreEmulator,
  query,
  where,
  getDocs,
  Timestamp,
  deleteDoc,
  orderBy,
  or,
  and,
  documentId,
  writeBatch
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { setGoogleToken, clearGoogleToken, getGoogleToken } from './googleToken';
import { seededShuffle } from '../utils/seededShuffle';
import { BOOKING_HORIZON_DAYS, type Gender, type Theme, type Qualification, type UserRole, type UserStatus, USER_ROLE, USER_STATUS, THEME, BOOKING_STATUS, type SupportCategory, type SupportStatus, COLLECTIONS, COACH_DISCOVERY_LIMIT, ENABLE_GOOGLE_INTEGRATION, SLOT_DURATION_MS, GOOGLE_FREE_BUSY_URL } from '../config';
import { logger } from '../utils/logger';
import { TelemetryErrors } from '../config/telemetryErrors';

declare global {
  interface Window {
    _firebase_emulators_connected?: boolean;
  }
}

export interface TimeRangeTimestamp {
  startTime: Timestamp;
  endTime: Timestamp;
}

export interface DayAvailability {
  enabled: boolean;
  slots: TimeRangeTimestamp[];
}

export interface AvailableDays {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export const timeStringToTimestamp = (timeStr: string): Timestamp => {
  const { hour, minute } = parseLocalTime(timeStr);
  const date = new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
  return Timestamp.fromDate(date);
};

export const timestampToTimeString = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${ampm}`;
};

export const DEFAULT_AVAILABLE_DAYS: AvailableDays = {
  monday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  tuesday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  wednesday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  thursday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  friday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  saturday: { enabled: false, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  sunday: { enabled: false, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] }
};

export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string; // Optional legacy field
  photoURL: string | null;
  gender: Gender;
  country: string;
  icf_acc?: boolean;
  icf_pcc?: boolean;
  icf_mcc?: boolean;
  icf_actc?: boolean;
  bio: string;
  timezone: string;
  userRole: UserRole;
  userStatus: UserStatus;
  theme: Theme;
  onboardingComplete?: boolean;
  createdAt: Timestamp;
}

/**
 * Flag to connect to local Firebase emulators (Auth, Firestore) instead of Cloud.
 * Defaults to false. Set VITE_USE_FIREBASE_EMULATOR=true to enable.
 */
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

// Required config that has no safe default. Against the emulator these are not
// needed, but a real (cloud) build must supply them — we never silently fall
// back to dummy credentials.
const requiredConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (useEmulator ? 'peer-coaching-network-dev' : undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingConfig = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

if (!useEmulator && missingConfig.length > 0) {
  const message = `Missing required Firebase configuration: ${missingConfig.join(', ')}. ` +
    'Set these environment variables (see .env.prod / Firebase project settings).';
  // Fail fast in production rather than booting with broken credentials.
  if (import.meta.env.PROD) {
    throw new Error(message);
  } else {
    logger.error(message);
  }
}

const projectId = requiredConfig.projectId || 'peer-coaching-network-dev';

const firebaseConfig = {
  apiKey: requiredConfig.apiKey || (useEmulator ? 'mock-api-key' : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: requiredConfig.messagingSenderId || (useEmulator ? 'mock-sender-id' : undefined),
  appId: requiredConfig.appId || (useEmulator ? 'mock-app-id' : undefined),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID;
export const db = getFirestore(app, databaseId);

// Safe-initialize Google Analytics
let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    logger.error('Failed to initialize Firebase Analytics:', err);
  }
}

export const logAnalyticsEvent = (eventName: string, params?: Record<string, unknown>) => {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
      logger.debug(`[Analytics] Event logged: ${eventName}`, params);
    } catch (err) {
      logger.error(`[Analytics] Failed to log event "${eventName}":`, err);
    }
  }
};

if (useEmulator) {
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const alreadyConnected = typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>)._firebase_emulators_connected
    : (globalThis as unknown as Record<string, unknown>)._firebase_emulators_connected;
  if (isLocal && !alreadyConnected) {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>)._firebase_emulators_connected = true;
    } else {
      (globalThis as unknown as Record<string, unknown>)._firebase_emulators_connected = true;
    }
    try {
      connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, 8080);
      logger.info(`Connected to Auth and Firestore Emulators on ${host}`);
    } catch (e) {
      logger.error('Failed to connect to emulators:', e);
    }
  }
}

// Reflects whether real config was supplied (or we're running against the
// emulator), instead of being hardcoded true.
export const isFirebaseConfigured = useEmulator || missingConfig.length === 0;

export { auth };

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

// Firestore Profile Listeners and Mutators
export const subscribeToProfile = (uid: string, callback: (profile: UserProfile | null) => void): (() => void) => {
  const docRef = doc(db, COLLECTIONS.USERS, uid);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as UserProfile);
    } else {
      callback(null);
    }
  });
};

// Generic mutator. Used by admin operations that legitimately write privileged
// fields; server-side Firestore rules enforce that only admins may do so.
export const updateProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(docRef, updates);
  // Cache uses profile fields like status, gender, country, etc.
  recalculateAvailableSlotsCache(uid).catch(console.error);
};

// Fields a user may change on their OWN profile. Privileged fields
// (userRole/userStatus/qualifications) are intentionally excluded — they
// are admin-controlled and enforced server-side by Firestore rules.
const OWN_EDITABLE_FIELDS: (keyof UserProfile)[] = [
  'displayName', 'photoURL', 'gender', 'country',
  'bio', 'timezone', 'theme', 'onboardingComplete'
];

export const updateOwnProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const safeUpdates: DocumentData = {};
  for (const key of OWN_EDITABLE_FIELDS) {
    const value = updates[key];
    if (value !== undefined) {
      safeUpdates[key] = value;
    }
  }
  if (Object.keys(safeUpdates).length === 0) return;
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), safeUpdates);
  // Cache uses profile fields like status, gender, country, etc.
  recalculateAvailableSlotsCache(uid).catch(console.error);
};

// Canonical approval/role helpers — the single source of truth for user status and role.
export const getEffectiveStatus = (p?: UserProfile | null): UserStatus => {
  return p?.userStatus || USER_STATUS.INACTIVE;
};

export const getEffectiveRole = (p?: UserProfile | null): UserRole => {
  return p?.userRole || USER_ROLE.USER;
};

export const isApproved = (p?: UserProfile | null): boolean => {
  return getEffectiveStatus(p) === USER_STATUS.ACTIVE;
};

// Format a stored createdAt for display, accepting both Firestore Timestamps and legacy ISO strings.
export const formatMemberSince = (createdAt?: Timestamp | string | null): string => {
  if (!createdAt) return '';
  const date = (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt && typeof (createdAt as Timestamp).toDate === 'function')
    ? (createdAt as Timestamp).toDate()
    : new Date(createdAt as string);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return String(createdAt);
};

// Admin Specific Operations
export const subscribeToAllUsers = (callback: (users: UserProfile[]) => void): (() => void) => {
  const q = collection(db, COLLECTIONS.USERS);
  return onSnapshot(q, (querySnap) => {
    const users: UserProfile[] = [];
    querySnap.forEach((doc) => {
      users.push(doc.data() as UserProfile);
    });
    callback(users);
  });
};

// Live subscription to ACTIVE users only (peer coaches), avoiding a full
// users-collection download for the dashboard. We filter on the
// userStatus field.
export const subscribeToActiveCoaches = (callback: (users: UserProfile[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTIONS.USERS), where('userStatus', '==', USER_STATUS.ACTIVE));
  return onSnapshot(q, (querySnap) => {
    const users: UserProfile[] = [];
    querySnap.forEach((d) => users.push(d.data() as UserProfile));
    callback(users);
  });
};

// Live count of pending (inactive) users — transfers only pending documents
// rather than the whole collection just to derive a badge number.
export const subscribeToPendingUsersCount = (callback: (count: number) => void): (() => void) => {
  const q = query(collection(db, COLLECTIONS.USERS), where('userStatus', '==', USER_STATUS.INACTIVE));
  return onSnapshot(q, (querySnap) => callback(querySnap.size));
};

export const setUserRoleAndStatus = async (
  uid: string,
  role: UserRole,
  status: UserStatus
): Promise<void> => {
  await updateProfile(uid, {
    userRole: role,
    userStatus: status
  });
};



export const formatDisplayName = (user: { firstName?: string; lastName?: string; displayName?: string | null } | null | undefined): string => {
  if (!user) return '';
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return (user.displayName || '').replace(/\s*\([^)]*\)/g, '').trim();
};

export const updateVerifiedCredentials = async (uid: string, newQualifications: Qualification[]): Promise<void> => {
  const userDocRef = doc(db, COLLECTIONS.USERS, uid);
  const updates: DocumentData = {};
  if (newQualifications) {
    updates.icf_acc = newQualifications.includes('ICF ACC');
    updates.icf_pcc = newQualifications.includes('ICF PCC');
    updates.icf_mcc = newQualifications.includes('ICF MCC');
    updates.icf_actc = newQualifications.includes('ICF ACTC');
  }
  await updateDoc(userDocRef, updates);
  // Credential/qualification changes alter the denormalized filter fields in the
  // availability cache and day shards, so refresh them.
  recalculateAvailableSlotsCache(uid).catch(console.error);
};

export const getSchedule = async (userId: string): Promise<{ availableDays: AvailableDays; blockedDates: string[] }> => {
  const availableDaysRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
  const blockedDatesRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
  
  const [daysSnap, datesSnap] = await Promise.all([
    getDoc(availableDaysRef),
    getDoc(blockedDatesRef)
  ]);
  
  const availableDays = daysSnap.exists() ? (daysSnap.data() as AvailableDays) : DEFAULT_AVAILABLE_DAYS;
  const blockedDates = datesSnap.exists() ? (datesSnap.data().blockedDates as string[]) : [];
  
  return { availableDays, blockedDates };
};

export const updateSchedule = async (
  userId: string,
  availableDays: AvailableDays,
  blockedDates: string[]
): Promise<void> => {
  const availableDaysRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
  const blockedDatesRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
  
  await Promise.all([
    setDoc(availableDaysRef, availableDays),
    setDoc(blockedDatesRef, { blockedDates })
  ]);
  
  // Schedule changed, update the available slots cache
  recalculateAvailableSlotsCache(userId).catch(console.error);
};



// Remove any 1-hr slot (identified by its ISO start) that overlaps a busy
// interval. Exported for testing. A slot [start, start+1h) is busy if any
// interval overlaps it (b.start < slotEnd && b.end > slotStart).
export const subtractBusyIntervals = (
  slots: string[],
  busy: { start: number; end: number }[]
): string[] => {
  if (busy.length === 0) return slots;
  return slots.filter((iso) => {
    const start = new Date(iso).getTime();
    const end = start + SLOT_DURATION_MS;
    return !busy.some((b) => b.start < end && b.end > start);
  });
};

// Fetch the coach's Google Calendar busy intervals so genuinely-busy hours can be
// subtracted from their template availability. This is only possible on the
// coach's OWN authenticated session (their OAuth token). When recalc is triggered
// for a different user (e.g. an admin editing someone else's profile) we return
// an empty list and fall back to template-only availability. Exported for testing.
export const getGoogleBusyIntervals = async (
  uid: string,
  timeMin: Date,
  timeMax: Date
): Promise<{ start: number; end: number }[]> => {
  if (!ENABLE_GOOGLE_INTEGRATION || auth?.currentUser?.uid !== uid) {
    return [];
  }
  const token = getGoogleToken();
  if (!token) return [];
  try {
    const response = await fetch(GOOGLE_FREE_BUSY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }],
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const busy: { start: string; end: string }[] = data?.calendars?.primary?.busy || [];
    return busy.map((b) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }));
  } catch (e) {
    logger.error('Error fetching Google Calendar busy intervals:', e);
    return [];
  }
};

const recalcChains = new Map<string, Promise<void>>();

// Serialize recalculations per-uid so concurrent triggers cannot interleave and
// clobber each other's writes (lost update). Errors propagate so callers may
// retry rather than silently dropping them.
export const recalculateAvailableSlotsCache = (uid: string): Promise<void> => {
  const prev = recalcChains.get(uid) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => doRecalculateAvailableSlotsCache(uid));
  recalcChains.set(uid, next);
  next.finally(() => {
    if (recalcChains.get(uid) === next) recalcChains.delete(uid);
  }).catch(() => {});
  return next;
};

export const lazyRecalculateAvailableSlotsCache = async (uid: string): Promise<void> => {
  if (!db) return;
  const isOwner = auth?.currentUser?.uid === uid;
  if (!isOwner) {
    return;
  }

  const personalAvailabilityCacheRef = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid);
  try {
    const snap = await getDoc(personalAvailabilityCacheRef);
    let shouldRecalc = false;

    if (snap.exists()) {
      const data = snap.data();
      const lastUpdated = data.lastUpdated;
      if (lastUpdated) {
        const lastUpdatedMs = new Date(lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (ageMs > 24 * 60 * 60 * 1000) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} is older than 24 hours (${Math.round(ageMs / 3600000)}h).`);
        }
      } else {
        shouldRecalc = true;
        logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} has no lastUpdated timestamp.`);
      }
    } else {
      shouldRecalc = true;
      logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} does not exist.`);
    }

    if (shouldRecalc) {
      await recalculateAvailableSlotsCache(uid);
    }
  } catch (err) {
    logger.error(`Error in lazyRecalculateAvailableSlotsCache for ${uid}:`, err);
  }
};

const doRecalculateAvailableSlotsCache = async (uid: string): Promise<void> => {
  if (!db) return;
  logger.debug(`Starting available slots cache recalculation for user: ${uid}`);
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const personalAvailabilityCacheRef = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid);

    const [userDoc, schedule] = await Promise.all([
      getDoc(userDocRef),
      getSchedule(uid)
    ]);

    if (!userDoc.exists()) return;
    
    const profile = userDoc.data() as UserProfile;
    const timezone = profile.timezone || 'UTC';
    const { availableDays, blockedDates } = schedule;
    
    const availableSlots: string[] = [];
    const localToday = getLocalDateInTimezone(new Date(), timezone);
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
      const currentDate = new Date(localToday);
      currentDate.setDate(localToday.getDate() + i);
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (blockedDates.includes(dateStr)) {
        continue;
      }
      
      const dayName = daysOfWeek[currentDate.getDay()];
      const daySched = availableDays[dayName as keyof AvailableDays] || { enabled: false, slots: [] };
      
      if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) {
        continue;
      }
      
      for (const slot of daySched.slots) {
        const startTimeString = timestampToTimeString(slot.startTime);
        const endTimeString = timestampToTimeString(slot.endTime);
        
        const parsedStart = parseLocalTime(startTimeString);
        const parsedEnd = parseLocalTime(endTimeString);
        
        const startMinutes = parsedStart.hour * 60 + parsedStart.minute;
        const endMinutes = parsedEnd.hour * 60 + parsedEnd.minute;
        
        for (let min = startMinutes; min < endMinutes; min += 30) {
          const slotHour = Math.floor(min / 60);
          const slotMin = min % 60;
          const slotStartUtc = getUtcForLocalDateTime(year, month, day, slotHour, slotMin, timezone);
          availableSlots.push(slotStartUtc.toISOString());
        }
      }
    }

    // Subtract Google Calendar busy hours so the cache reflects genuinely
    // bookable time. Only possible on the coach's own authenticated session;
    // admin-triggered recalcs fall back to template-only availability.
    const horizonStart = new Date();
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setDate(horizonEnd.getDate() + BOOKING_HORIZON_DAYS + 1);
    const busyIntervals = await getGoogleBusyIntervals(uid, horizonStart, horizonEnd);
    // Deduplicate: overlapping template ranges on the same day (e.g. 9-12 and
    // 11-14) would otherwise emit the same hourly slot twice, inflating the
    // aggregate and pushing a day's shard past its 24-slot limit.
    const freeSlots = Array.from(new Set(subtractBusyIntervals(availableSlots, busyIntervals))).sort();

    const availableDatesUtc = Array.from(
      new Set(freeSlots.map(slotStr => slotStr.split('T')[0]))
    ).sort();

    // Denormalized filter fields, shared by the aggregate cache and the per-day
    // discovery shards so discovery can facet in-memory without joining users/.
    // userStatus is intentionally NOT denormalized onto shards: discovery gates
    // on the live, authoritative users/ profile status (see isApproved below),
    // so a stale or spoofed shard status can never make a coach discoverable.
    const filterFields = {
      gender: profile.gender || '',
      country: profile.country || '',
      icf_acc: !!profile.icf_acc,
      icf_pcc: !!profile.icf_pcc,
      icf_mcc: !!profile.icf_mcc,
      icf_actc: !!profile.icf_actc,
    };
    const lastUpdated = new Date().toISOString();

    const isDiscoverable = (profile.userRole === USER_ROLE.USER || profile.userRole === USER_ROLE.ADMIN) && isApproved(profile);
    const finalFreeSlots = isDiscoverable ? freeSlots : [];
    const finalAvailableDatesUtc = isDiscoverable ? availableDatesUtc : [];

    // Aggregate cache: retained for the coach's own "My Sessions" / personal
    // availability view (a single-document read). We always write because
    // profile metadata may have changed even when the slots are unchanged.
    // If the coach is deactivated or not a coach, we empty their slots to prevent
    // cache leakage.
    await setDoc(personalAvailabilityCacheRef, {
      userId: uid,
      lastUpdated,
      availableSlots: finalFreeSlots,
      availableDatesUtc: finalAvailableDatesUtc,
      ...filterFields,
      userStatus: profile.userStatus || USER_STATUS.INACTIVE,
    });

    // Per-day discovery shards: one owned document per coach per UTC date, so
    // discovery reads only the selected day and no two coaches share a document.
    //
    // Shards are owner-written only — Firestore rules pin the document ID to
    // "{ownUid}_{dateISO}" with no admin fallback, because an isAdmin() branch
    // would spend get() calls per document and exceed the 20-document-access
    // budget of a batched write. When an admin triggers a recalc for another
    // coach (profile/credential edits), we refresh the aggregate cache only; the
    // coach's shards are rebuilt on their next own recalc. Discovery gates on the
    // live users/ profile, so admin status changes apply without any shard write.
    if (auth?.currentUser?.uid !== uid) {
      logger.debug(`Skipping day-shard rebuild for ${uid}: not the coach's own session.`);
      logger.info(`Successfully recalculated aggregate availability cache for user: ${uid}`);
      return;
    }

    const slotsByDate = new Map<string, string[]>();
    for (const iso of finalFreeSlots) {
      const dateISO = iso.split('T')[0];
      const list = slotsByDate.get(dateISO) || [];
      list.push(iso);
      slotsByDate.set(dateISO, list);
    }

    // Read existing shards so dates that lost all availability can be deleted.
    const existingShardsSnap = await getDocs(
      query(collection(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE), where('coachUid', '==', uid))
    );

    const batch = writeBatch(db);
    for (const [dateISO, slots] of slotsByDate) {
      const shardRef = doc(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE, `${uid}_${dateISO}`);
      batch.set(shardRef, {
        coachUid: uid,
        dateISO,
        freeSlots: slots,
        lastUpdated,
        ...filterFields,
      });
    }
    existingShardsSnap.forEach((shardDoc) => {
      if (!slotsByDate.has(shardDoc.data().dateISO)) {
        batch.delete(shardDoc.ref);
      }
    });
    await batch.commit();

    logger.info(`Successfully recalculated available slots cache and day shards for user: ${uid}`);
  } catch (err) {
    logger.error('Error recalculating available slots cache:', err);
    try {
      await logger.telemetry('error', 'recalculation_failure', {
        userId: uid,
        errorCode: TelemetryErrors.RECALCULATION_FAILURE.code,
        errorMessage: TelemetryErrors.RECALCULATION_FAILURE.message,
        error: err instanceof Error ? err.message : String(err)
      });
    } catch (logErr) {
      logger.error('Failed to log recalculation failure:', logErr);
    }
    throw err;
  }
};

export const subscribeToBookings = (callback: (bookings: DocumentData[]) => void): (() => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLLECTIONS.BOOKINGS), where('status', '==', BOOKING_STATUS.CONFIRMED));
  return onSnapshot(q, (querySnap) => {
    const list: DocumentData[] = [];
    querySnap.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (err) => {
    logger.error('Error in subscribeToBookings:', err);
  });
};

// ── Support and Feedback Ticket System ────────────────────────────────────────

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  createdAt: string; // ISO string
}

export interface SupportRequest {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  messages: SupportMessage[];
}

export const createSupportRequest = async (
  userId: string,
  userDisplayName: string,
  userEmail: string,
  category: SupportCategory,
  subject: string,
  messageText: string
): Promise<string> => {
  if (!db) throw new Error('Firestore not initialized');
  const now = new Date().toISOString();
  
  const initialMessage: SupportMessage = {
    id: Date.now().toString(),
    senderId: userId,
    senderName: userDisplayName,
    senderRole: USER_ROLE.USER,
    content: messageText,
    createdAt: now,
  };

  const supportRequestsRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS);
  const docRef = doc(supportRequestsRef); // Generate new ID
  
  const newRequest: SupportRequest = {
    id: docRef.id,
    userId,
    userDisplayName,
    userEmail,
    category,
    subject,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    messages: [initialMessage]
  };

  await setDoc(docRef, newRequest);
  return docRef.id;
};

export const getSupportRequestsForUser = async (userId: string): Promise<SupportRequest[]> => {
  if (!db) return [];
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(d.data() as SupportRequest));
  return requests;
};

export const getAllSupportRequests = async (): Promise<SupportRequest[]> => {
  if (!db) return [];
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(d.data() as SupportRequest));
  return requests;
};

export const addMessageToSupportRequest = async (
  requestId: string,
  senderId: string,
  senderName: string,
  isAdmin: boolean,
  content: string
): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Support request not found');
  }
  
  const request = docSnap.data() as SupportRequest;
  const now = new Date().toISOString();
  
  const newMessage: SupportMessage = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    senderId,
    senderName,
    senderRole: isAdmin ? USER_ROLE.ADMIN : USER_ROLE.USER,
    content,
    createdAt: now,
  };

  const updatedMessages = [...(request.messages || []), newMessage];
  
  await updateDoc(docRef, {
    messages: updatedMessages,
    updatedAt: now,
    status: 'open' // Always set to open when a new message is sent
  });
};

export const updateSupportRequestStatus = async (requestId: string, status: SupportStatus): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  await updateDoc(docRef, {
    status,
    updatedAt: new Date().toISOString()
  });
};

export const deleteSupportRequest = async (requestId: string): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  await deleteDoc(docRef);
};

export interface DiscoveryFilters {
  gender?: string;
  country?: string;
  icf_acc?: boolean;
  icf_pcc?: boolean;
  icf_mcc?: boolean;
  icf_actc?: boolean;
}

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export const queryAvailableCoachesForDay = async (
  localDayStart: Date,
  localDayEnd: Date,
  slots: { startTime: Date; endTime: Date }[],
  filters: DiscoveryFilters,
  sessionSeed: string,
  currentUserUid?: string
): Promise<Record<string, UserProfile[]>> => {
  if (!db) return {};

  const uniqueUtcDates = Array.from(
    new Set(
      slots.map(s => s.startTime.toISOString().split('T')[0])
    )
  );
  if (uniqueUtcDates.length === 0) return {};

  // Read only the selected day's per-coach shards (1-2 UTC dates → within the
  // `in` limit of 30). Each shard is a small, coach-owned document, so no two
  // coaches share a document and we never read the whole booking horizon.
  const q = query(
    collection(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE),
    where('dateISO', 'in', uniqueUtcDates)
  );

  const cacheSnap = await getDocs(q);
  const cacheMap = new Map<string, string[]>();
  const rejected = new Set<string>();

  cacheSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const uid = data.coachUid;
    if (uid === currentUserUid || rejected.has(uid)) return;

    // A coach can have up to two shards (local day spanning two UTC dates);
    // union their freeSlots and run the faceted filter once per coach.
    const existing = cacheMap.get(uid);
    if (existing) {
      existing.push(...(data.freeSlots || []));
      return;
    }

    // In-memory faceted filtering to avoid Firestore combinatorial index explosion
    if (filters.gender && data.gender !== filters.gender) { rejected.add(uid); return; }
    if (filters.country && data.country !== filters.country) { rejected.add(uid); return; }

    const hasAnyRequestedCredential =
      (filters.icf_acc && data.icf_acc) ||
      (filters.icf_pcc && data.icf_pcc) ||
      (filters.icf_mcc && data.icf_mcc) ||
      (filters.icf_actc && data.icf_actc);

    // If any credential filter is selected, the user must have at least one of them
    const isCredentialFilterActive = filters.icf_acc || filters.icf_pcc || filters.icf_mcc || filters.icf_actc;
    if (isCredentialFilterActive && !hasAnyRequestedCredential) { rejected.add(uid); return; }

    cacheMap.set(uid, [...(data.freeSlots || [])]);
  });

  const candidateUids = Array.from(cacheMap.keys());
  if (candidateUids.length === 0) return {};

  const bookingsQuery = query(
    collection(db, COLLECTIONS.BOOKINGS),
    where('startTime', '>=', Timestamp.fromDate(localDayStart)),
    where('startTime', '<=', Timestamp.fromDate(localDayEnd)),
    where('status', '==', BOOKING_STATUS.CONFIRMED)
  );
  
  const bookingsSnap = await getDocs(bookingsQuery);
  const slotBusyUsers = new Map<string, Set<string>>();
  
  bookingsSnap.forEach((doc) => {
    const b = doc.data();
    const startStr = b.startTime && typeof b.startTime.toDate === 'function'
      ? b.startTime.toDate().toISOString()
      : (b.startTime?.dateTime || b.startTime);
    if (!startStr) return;
    
    if (!slotBusyUsers.has(startStr)) {
      slotBusyUsers.set(startStr, new Set<string>());
    }
    const busySet = slotBusyUsers.get(startStr)!;
    if (b.coachUid) busySet.add(b.coachUid);
    if (b.clientUid) busySet.add(b.clientUid);
  });

  const profileChunks = chunkArray(candidateUids, 30);
  const coachProfiles: UserProfile[] = [];

  const profileSnaps = await Promise.all(
    profileChunks.map(chunk =>
      getDocs(query(collection(db, COLLECTIONS.USERS), where(documentId(), 'in', chunk)))
    )
  );

  profileSnaps.forEach((snap) => {
    snap.forEach((docSnap) => {
      const profile = docSnap.data() as UserProfile;
       // Gate on the live, authoritative profile: only active coaches (role USER or ADMIN,
       // status active) are discoverable. Inactive/pending coaches with a stale
       // availability shard must never surface for booking.
       if ((profile.userRole === USER_ROLE.USER || profile.userRole === USER_ROLE.ADMIN) && isApproved(profile)) {
         coachProfiles.push(profile);
       }
    });
  });

  const coachMergedIntervals = new Map<string, { start: number; end: number }[]>();
  cacheMap.forEach((slotsList, uid) => {
    const slotDurationMs = 30 * 60 * 1000;
    const intervals = slotsList
      .map(s => {
        const start = new Date(s).getTime();
        return { start, end: start + slotDurationMs };
      })
      .sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    for (const interval of intervals) {
      if (merged.length === 0) {
        merged.push(interval);
      } else {
        const last = merged[merged.length - 1];
        if (interval.start <= last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          merged.push(interval);
        }
      }
    }
    coachMergedIntervals.set(uid, merged);
  });

  const result: Record<string, UserProfile[]> = {};

  slots.forEach((slot) => {
    const slotIso = slot.startTime.toISOString();
    const slotStartMs = slot.startTime.getTime();
    const slotEndMs = slot.endTime.getTime();
    const busySet = slotBusyUsers.get(slotIso) || new Set<string>();

    let availableCoaches = coachProfiles.filter((coach) => {
      const merged = coachMergedIntervals.get(coach.userId) || [];
      const isCovered = merged.some(
        interval => interval.start <= slotStartMs && slotEndMs <= interval.end
      );
      if (!isCovered) return false;
      if (busySet.has(coach.userId)) return false;
      return true;
    });

    availableCoaches = seededShuffle(availableCoaches, sessionSeed + slotIso);
    result[slotIso] = availableCoaches.slice(0, COACH_DISCOVERY_LIMIT);
  });

  return result;
};

export const subscribeToUserBookings = (uid: string, callback: (bookings: DocumentData[]) => void): (() => void) => {
  if (!db) return () => {};
  const q = query(
    collection(db, COLLECTIONS.BOOKINGS),
    and(
      where('status', '==', BOOKING_STATUS.CONFIRMED),
      or(
        where('clientUid', '==', uid),
        where('coachUid', '==', uid)
      )
    )
  );
  return onSnapshot(q, (querySnap) => {
    const list: DocumentData[] = [];
    querySnap.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (err) => {
    logger.error('Error in subscribeToUserBookings:', err);
  });
};

export const getUserAvailableSlots = async (uid: string): Promise<string[]> => {
  if (!db) return [];
  
  lazyRecalculateAvailableSlotsCache(uid).catch((err) => {
    logger.error(`Error triggering lazy check for ${uid}:`, err);
  });

  const ref = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().availableSlots || []) : [];
};

export const getProfiles = async (uids: string[]): Promise<UserProfile[]> => {
  if (!db || uids.length === 0) return [];
  const chunks = chunkArray(uids, 30);
  const profiles: UserProfile[] = [];
  const snaps = await Promise.all(
    chunks.map(c => getDocs(query(collection(db, COLLECTIONS.USERS), where(documentId(), 'in', c))))
  );
  snaps.forEach(snap => {
    snap.forEach(d => {
      profiles.push(d.data() as UserProfile);
    });
  });
  return profiles;
};
