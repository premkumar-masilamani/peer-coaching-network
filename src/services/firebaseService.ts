import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  connectAuthEmulator
} from 'firebase/auth';
import type { User, OAuthCredential } from 'firebase/auth';
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
  deleteDoc
} from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { setGoogleToken, clearGoogleToken } from './googleToken';
import { BOOKING_HORIZON_DAYS, type Gender, type Theme, type Qualification, type UserRole, type UserStatus, USER_ROLE, USER_STATUS, THEME, BOOKING_STATUS, type SupportCategory, type SupportStatus, COLLECTIONS, type IcfCredential } from '../config';
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
  qualifications?: Qualification[];
  icfCredentials?: IcfCredential[];
  bio: string;
  timezone: string;
  userRole: UserRole;
  userStatus: UserStatus;
  theme: Theme;
  createdAt: Timestamp;
}

/**
 * Flag to connect to local Firebase emulators (Auth, Firestore) instead of Cloud.
 * Defaults to false. Set VITE_USE_FIREBASE_EMULATOR=true to enable.
 */
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

// Required config that has no safe default. Against the emulator these are not
// needed, but a real (cloud) build must supply them — we never silently fall
// back to dummy credentials. See BUG-013.
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

// Connect to Emulators during development/testing if configured
if (useEmulator) {
  if (!window._firebase_emulators_connected) {
    window._firebase_emulators_connected = true;
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      logger.info('Connected to Auth and Firestore Emulators');
    } catch (e) {
      logger.error('Failed to connect to emulators:', e);
    }
  }
}

// Reflects whether real config was supplied (or we're running against the
// emulator), instead of being hardcoded true. See BUG-013.
export const isFirebaseConfigured = useEmulator || missingConfig.length === 0;

export { auth };

// Standardized Auth Actions
export const loginWithGoogle = async (): Promise<{ user: User; credential?: OAuthCredential | null }> => {
  const provider = new GoogleAuthProvider();
  // Request Google Calendar access
  provider.addScope('https://www.googleapis.com/auth/calendar');
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  // Force Google to prompt the user to select an account on login
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  // Hold the access token in memory only (never persisted) for Calendar API calls
  if (credential?.accessToken) {
    setGoogleToken(credential.accessToken);
  }
  
  // Check/create user document in firestore
  const userDocRef = doc(db, COLLECTIONS.USERS, result.user.uid);
  const userDoc = await getDoc(userDocRef);
  
  if (!userDoc.exists()) {
    const email = result.user.email;
    const displayName = result.user.displayName;
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
       userId: result.user.uid,
       email: cleanEmail,
       firstName,
       lastName,
       displayName,
       photoURL: result.user.photoURL,
       userRole: assignedRole,
       userStatus: initialStatus,
       qualifications: [] as Qualification[],
       icfCredentials: [],
       gender: '' as unknown as Gender,
       country: '',
       bio: '',
       timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
       createdAt: Timestamp.now(),
       theme: THEME.LIGHT
     };
     await setDoc(userDocRef, newProfile);
 
     // Initialize schedule sub-collection documents
     const availableDaysRef = doc(db, COLLECTIONS.USERS, result.user.uid, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
     const blockedDatesRef = doc(db, COLLECTIONS.USERS, result.user.uid, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
     await setDoc(availableDaysRef, DEFAULT_AVAILABLE_DAYS);
     await setDoc(blockedDatesRef, { blockedDates: [] });
   } else {
     // Sync Google Profile data in database during login (Google takes priority)
     const existingProfile = userDoc.data() as UserProfile;
     const updates: Partial<UserProfile> = {};
     if (result.user.displayName) {
       const parts = result.user.displayName.trim().split(' ');
       const inFirst = parts[0] || '';
       const inLast = parts.slice(1).join(' ') || '';
       
       if (existingProfile.firstName !== inFirst || existingProfile.lastName !== inLast) {
         updates.firstName = inFirst;
         updates.lastName = inLast;
       }
       if (existingProfile.displayName !== result.user.displayName) {
         updates.displayName = result.user.displayName;
       }
     }
     const incomingEmail = result.user.email ? result.user.email.toLowerCase() : null;
     if (incomingEmail && existingProfile.email !== incomingEmail) {
       updates.email = incomingEmail;
     }
     if (result.user.photoURL && existingProfile.photoURL !== result.user.photoURL) {
       updates.photoURL = result.user.photoURL;
     }
     
     if (Object.keys(updates).length > 0) {
       await updateDoc(userDocRef, updates);
     }
  }
  
  return { user: result.user, credential };
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
};

// Fields a user may change on their OWN profile. Privileged fields
// (userRole/userStatus/qualifications) are intentionally excluded — they
// are admin-controlled and enforced server-side by Firestore rules. See BUG-002.
const OWN_EDITABLE_FIELDS: (keyof UserProfile)[] = [
  'displayName', 'photoURL', 'gender', 'country',
  'bio', 'timezone', 'theme'
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
// users-collection download for the dashboard (BUG-006). We filter on the
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
// rather than the whole collection just to derive a badge number (BUG-006).
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

export const updateVerifiedCredentials = async (uid: string, credentials: IcfCredential[], newQualifications?: Qualification[]): Promise<void> => {
  const userDocRef = doc(db, COLLECTIONS.USERS, uid);
  const updates: Partial<UserProfile> = {
    icfCredentials: credentials
  };
  if (newQualifications && newQualifications.length > 0) {
    updates.qualifications = newQualifications;
  }
  await updateDoc(userDocRef, updates);
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
};

const areBusySlotsEqual = (
  slotsA: { start: string; end: string }[],
  slotsB: { start: string; end: string }[]
): boolean => {
  if (slotsA.length !== slotsB.length) return false;
  const sortedA = [...slotsA].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const sortedB = [...slotsB].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i].start !== sortedB[i].start || sortedA[i].end !== sortedB[i].end) {
      return false;
    }
  }
  return true;
};

const recalcChains = new Map<string, Promise<void>>();

// Serialize recalculations per-uid so concurrent triggers cannot interleave and
// clobber each other's writes (lost update). Errors propagate so callers may
// retry rather than silently dropping them. See BUG-009.
export const recalculateUserBusySlotsCache = (uid: string): Promise<void> => {
  const prev = recalcChains.get(uid) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => doRecalculateUserBusySlotsCache(uid));
  recalcChains.set(uid, next);
  next.finally(() => {
    if (recalcChains.get(uid) === next) recalcChains.delete(uid);
  }).catch(() => {});
  return next;
};

const doRecalculateUserBusySlotsCache = async (uid: string): Promise<void> => {
  if (!db) return;
  logger.debug(`Starting busy slots cache recalculation for user: ${uid}`);
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const busySlotsCacheRef = doc(db, COLLECTIONS.BUSY_SLOTS_CACHE, uid);

    const [userDoc, busySlotsCacheDoc, schedule] = await Promise.all([
      getDoc(userDocRef),
      getDoc(busySlotsCacheRef),
      getSchedule(uid)
    ]);

    if (!userDoc.exists()) return;
    
    const profile = userDoc.data() as UserProfile;
    const timezone = profile.timezone || 'UTC';
    const { availableDays, blockedDates } = schedule;
    
    // Query bookings
    const bookingsCol = collection(db, COLLECTIONS.BOOKINGS);
    const q1 = query(bookingsCol, where('coachUid', '==', uid));
    const snap1 = await getDocs(q1);
    
    const q2 = query(bookingsCol, where('clientUid', '==', uid));
    const snap2 = await getDocs(q2);
    
    const bookings: DocumentData[] = [];
    const seen = new Set<string>();
    const addSnap = (snap: QuerySnapshot<DocumentData>) => {
      snap.forEach((d) => {
        const data = d.data();
        if (data.bookingId && !seen.has(data.bookingId)) {
          seen.add(data.bookingId);
          bookings.push(data);
        }
      });
    };
    addSnap(snap1);
    addSnap(snap2);
    
    // Generate busy intervals for next BOOKING_HORIZON_DAYS days
    const busySlots: { start: string; end: string }[] = [];
    
    // 1. Process weekly template and blocked dates
    // Get local today in user's timezone
    const localToday = getLocalDateInTimezone(new Date(), timezone);
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
      const currentDate = new Date(localToday);
      currentDate.setDate(localToday.getDate() + i);
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      
      // Check if blocked date
      // Format current local date as YYYY-MM-DD
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (blockedDates.includes(dateStr)) {
        // Block entire day
        const dayStart = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
        const dayEnd = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
        busySlots.push({
          start: dayStart.toISOString(),
          end: dayEnd.toISOString()
        });
        continue;
      }
      
      const dayName = daysOfWeek[currentDate.getDay()];
      const daySched = availableDays[dayName as keyof AvailableDays] || { enabled: false, slots: [] };
      
      if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) {
        // Entire day is unavailable
        const dayStart = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
        const dayEnd = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
        busySlots.push({
          start: dayStart.toISOString(),
          end: dayEnd.toISOString()
        });
      } else {
        // Compute busy intervals (gaps outside the enabled slots)
        // Sort slots by time
        const sortedSlots = [...daySched.slots].map(s => {
          const startTimeString = timestampToTimeString(s.startTime);
          const endTimeString = timestampToTimeString(s.endTime);
          
          const parsedStart = parseLocalTime(startTimeString);
          const parsedEnd = parseLocalTime(endTimeString);
          return {
            startMin: parsedStart.hour * 60 + parsedStart.minute,
            endMin: parsedEnd.hour * 60 + parsedEnd.minute,
            startStr: startTimeString,
            endStr: endTimeString
          };
        }).sort((a, b) => a.startMin - b.startMin);
        
        // Gap 1: from 00:00 to start of first slot
        if (sortedSlots[0].startMin > 0) {
          const startUtc = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
          const parsedS = parseLocalTime(sortedSlots[0].startStr);
          const endUtc = getUtcForLocalDateTime(year, month, day, parsedS.hour, parsedS.minute, timezone);
          busySlots.push({
            start: startUtc.toISOString(),
            end: endUtc.toISOString()
          });
        }
        
        // Gaps between slots
        for (let j = 0; j < sortedSlots.length - 1; j++) {
          const currentSlot = sortedSlots[j];
          const nextSlot = sortedSlots[j + 1];
          if (nextSlot.startMin > currentSlot.endMin) {
            const parsedC = parseLocalTime(currentSlot.endStr);
            const parsedN = parseLocalTime(nextSlot.startStr);
            const startUtc = getUtcForLocalDateTime(year, month, day, parsedC.hour, parsedC.minute, timezone);
            const endUtc = getUtcForLocalDateTime(year, month, day, parsedN.hour, parsedN.minute, timezone);
            busySlots.push({
              start: startUtc.toISOString(),
              end: endUtc.toISOString()
            });
          }
        }
        
        // Gap 3: from end of last slot to 24:00
        const lastSlot = sortedSlots[sortedSlots.length - 1];
        if (lastSlot.endMin < 24 * 60) {
          const parsedL = parseLocalTime(lastSlot.endStr);
          const startUtc = getUtcForLocalDateTime(year, month, day, parsedL.hour, parsedL.minute, timezone);
          const endUtc = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
          busySlots.push({
            start: startUtc.toISOString(),
            end: endUtc.toISOString()
          });
        }
      }
    }
    
    // 2. Process active bookings (skip cancelled and already-finished ones so
    //    busy slots don't accrete forever). See BUG-016.
    const nowMs = Date.now();
    bookings.forEach(b => {
      if (b.status === BOOKING_STATUS.CANCELLED) return;
      
      // Support both Firestore Timestamp and date strings/objects
      const bStart = b.startTime && typeof b.startTime.toDate === 'function' ? b.startTime.toDate() : new Date(b.startTime?.dateTime || b.startTime);
      const bEnd = b.endTime && typeof b.endTime.toDate === 'function' ? b.endTime.toDate() : new Date(b.endTime?.dateTime || b.endTime);
      
      if (bStart && bEnd && !isNaN(bStart.getTime()) && !isNaN(bEnd.getTime())) {
        if (bEnd.getTime() < nowMs) return;
        busySlots.push({
          start: bStart.toISOString(),
          end: bEnd.toISOString()
        });
      }
    });

    // Check if the calculated busy slots are identical to the stored ones to avoid redundant write
    let shouldWrite = true;
    if (busySlotsCacheDoc.exists()) {
      const existingData = busySlotsCacheDoc.data();
      const existingSlots = existingData?.busySlots || [];
      if (areBusySlotsEqual(busySlots, existingSlots)) {
        shouldWrite = false;
      }
    }
    
    if (shouldWrite) {
      await setDoc(busySlotsCacheRef, {
        userId: uid,
        lastUpdated: new Date().toISOString(),
        busySlots
      });
      logger.info(`Successfully recalculated and updated busy slots cache for user: ${uid}`);
    } else {
      logger.debug(`Busy slots cache recalculation finished, no changes for user: ${uid}`);
    }
  } catch (err) {
    logger.error('Error recalculating busy slots cache:', err);
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
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), where('userId', '==', userId));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(d.data() as SupportRequest));
  // Sort by updatedAt desc client-side
  return requests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const getAllSupportRequests = async (): Promise<SupportRequest[]> => {
  if (!db) return [];
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(d.data() as SupportRequest));
  return requests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
