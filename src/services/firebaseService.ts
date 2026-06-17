import { initializeApp, getApps, getApp } from 'firebase/app';
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
  Timestamp
} from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { setGoogleToken, clearGoogleToken } from './googleToken';
import { BOOKING_HORIZON_DAYS } from '../config';

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
  displayName: string;
  photoURL: string | null;
  gender: 'Male' | 'Female' | 'Prefer not to say';
  country: string;
  qualifications?: ('ICF ACC' | 'ICF PCC' | 'ICF MCC')[];
  bio: string;
  timezone: string;
  userRole: 'user' | 'admin';
  userStatus: 'active' | 'inactive';
  theme: 'light' | 'dark' | 'system';
  createdAt: Timestamp;
}

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
    console.error(message);
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
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to Emulators during development/testing if configured
if (useEmulator) {
  if (!window._firebase_emulators_connected) {
    window._firebase_emulators_connected = true;
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      console.log('Connected to Auth and Firestore Emulators');
    } catch (e) {
      console.error('Failed to connect to emulators:', e);
    }
  }
}

// Reflects whether real config was supplied (or we're running against the
// emulator), instead of being hardcoded true. See BUG-013.
export const isFirebaseConfigured = useEmulator || missingConfig.length === 0;

export { auth, db };

// Standardized Auth Actions
export const loginWithGoogle = async (): Promise<{ user: User; credential?: OAuthCredential | null }> => {
  const provider = new GoogleAuthProvider();
  // Request Google Calendar access
  provider.addScope('https://www.googleapis.com/auth/calendar');
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  // Hold the access token in memory only (never persisted) for Calendar API calls
  if (credential?.accessToken) {
    setGoogleToken(credential.accessToken);
  }
  
  // Check/create user document in firestore
  const userDocRef = doc(db, 'users', result.user.uid);
  const userDoc = await getDoc(userDocRef);
  
  if (!userDoc.exists()) {
    const email = result.user.email;
    const displayName = result.user.displayName;
    if (!email || !displayName) {
      throw new Error('Google Sign-In did not return a valid email or display name.');
    }

    // Create new pending user
    const newProfile: UserProfile = {
      userId: result.user.uid,
      email,
      displayName,
      photoURL: result.user.photoURL,
      userRole: 'user',
      userStatus: 'inactive',
      qualifications: [],
      gender: 'Prefer not to say',
      country: '',
      bio: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      createdAt: Timestamp.now(),
      theme: 'system'
    };
    await setDoc(userDocRef, newProfile);

    // Initialize schedule sub-collection documents
    const availableDaysRef = doc(db, 'users', result.user.uid, 'schedule', 'availableDays');
    const blockedDatesRef = doc(db, 'users', result.user.uid, 'schedule', 'blockedDates');
    await setDoc(availableDaysRef, DEFAULT_AVAILABLE_DAYS);
    await setDoc(blockedDatesRef, { blockedDates: [] });
  } else {
    // Sync Google Profile picture URL in database during login
    const existingProfile = userDoc.data() as UserProfile;
    if (result.user.photoURL && existingProfile.photoURL !== result.user.photoURL) {
      await updateDoc(userDocRef, { photoURL: result.user.photoURL });
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
  const docRef = doc(db, 'users', uid);
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
  const docRef = doc(db, 'users', uid);
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
  await updateDoc(doc(db, 'users', uid), safeUpdates);
};

// Canonical approval/role helpers — the single source of truth for user status and role.
export const getEffectiveStatus = (p?: UserProfile | null): 'active' | 'inactive' => {
  return p?.userStatus || 'inactive';
};

export const getEffectiveRole = (p?: UserProfile | null): 'admin' | 'user' => {
  return p?.userRole || 'user';
};

export const isApproved = (p?: UserProfile | null): boolean => {
  return getEffectiveStatus(p) === 'active';
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
  const q = collection(db, 'users');
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
  const q = query(collection(db, 'users'), where('userStatus', '==', 'active'));
  return onSnapshot(q, (querySnap) => {
    const users: UserProfile[] = [];
    querySnap.forEach((d) => users.push(d.data() as UserProfile));
    callback(users);
  });
};

// Live count of pending (inactive) users — transfers only pending documents
// rather than the whole collection just to derive a badge number (BUG-006).
export const subscribeToPendingUsersCount = (callback: (count: number) => void): (() => void) => {
  const q = query(collection(db, 'users'), where('userStatus', '==', 'inactive'));
  return onSnapshot(q, (querySnap) => callback(querySnap.size));
};

export const setUserRoleAndStatus = async (
  uid: string,
  role: 'user' | 'admin',
  status: 'active' | 'inactive'
): Promise<void> => {
  await updateProfile(uid, {
    userRole: role,
    userStatus: status
  });
};

export const formatDisplayName = (user: { displayName?: string | null } | null | undefined): string => {
  if (!user) return '';
  return (user.displayName || '').replace(/\s*\([^)]*\)/g, '').trim();
};

export const getSchedule = async (userId: string): Promise<{ availableDays: AvailableDays; blockedDates: string[] }> => {
  const availableDaysRef = doc(db, 'users', userId, 'schedule', 'availableDays');
  const blockedDatesRef = doc(db, 'users', userId, 'schedule', 'blockedDates');
  
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
  const availableDaysRef = doc(db, 'users', userId, 'schedule', 'availableDays');
  const blockedDatesRef = doc(db, 'users', userId, 'schedule', 'blockedDates');
  
  await Promise.all([
    setDoc(availableDaysRef, availableDays),
    setDoc(blockedDatesRef, { blockedDates })
  ]);
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
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) return;
    
    const profile = userDoc.data() as UserProfile;
    const timezone = profile.timezone || 'UTC';
    
    // Get availability schedule from schedule sub-collection!
    const { availableDays, blockedDates } = await getSchedule(uid);
    
    // Query bookings
    const bookingsCol = collection(db, 'bookings');
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
      if (b.status === 'cancelled') return;
      
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
    
    // Save to busy slots cache document
    const busySlotsCacheRef = doc(db, 'busySlotsCache', uid);
    await setDoc(busySlotsCacheRef, {
      userId: uid,
      lastUpdated: new Date().toISOString(),
      busySlots
    });
  } catch (err) {
    console.error('Error recalculating busy slots cache:', err);
    throw err;
  }
};
