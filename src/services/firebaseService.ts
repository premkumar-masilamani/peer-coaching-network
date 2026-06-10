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
  getDocs
} from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { setGoogleToken, clearGoogleToken } from './googleToken';

declare global {
  interface Window {
    _firebase_emulators_connected?: boolean;
  }
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface DayAvailability {
  enabled: boolean;
  slots: TimeRange[];
}

export interface AvailabilityTemplate {
  weekly: {
    monday: DayAvailability;
    tuesday: DayAvailability;
    wednesday: DayAvailability;
    thursday: DayAvailability;
    friday: DayAvailability;
    saturday: DayAvailability;
    sunday: DayAvailability;
  };
  blockedDates: string[];
}

export const DEFAULT_TEMPLATE: AvailabilityTemplate = {
  weekly: {
    monday: { enabled: true, slots: [{ start: '10:00 AM', end: '4:00 PM' }] },
    tuesday: { enabled: true, slots: [{ start: '10:00 AM', end: '4:00 PM' }] },
    wednesday: { enabled: true, slots: [{ start: '10:00 AM', end: '4:00 PM' }] },
    thursday: { enabled: true, slots: [{ start: '10:00 AM', end: '4:00 PM' }] },
    friday: { enabled: true, slots: [{ start: '10:00 AM', end: '4:00 PM' }] },
    saturday: { enabled: false, slots: [{ start: '10:00 AM', end: '4:00 PM' }] },
    sunday: { enabled: false, slots: [{ start: '10:00 AM', end: '4:00 PM' }] }
  },
  blockedDates: []
};

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  prefix?: string;
  photoURL: string | null;
  gender?: string;
  location?: {
    country: string;
  };
  qualifications?: string[];
  bio?: string;
  role?: 'admin' | 'user' | null;
  calendarSynced?: boolean;
  timezone?: string;
  userRole?: 'user' | 'admin';
  userStatus?: 'active' | 'inactive';
  theme?: 'light' | 'dark';
  createdAt?: string;
  availabilityTemplate?: AvailabilityTemplate;
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
  apiKey: requiredConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: requiredConfig.messagingSenderId,
  appId: requiredConfig.appId,
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
    // Create new pending user
    const newProfile: UserProfile = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      prefix: '',
      photoURL: result.user.photoURL,
      role: null, // No role = Pending
      userRole: 'user',
      userStatus: 'inactive',
      calendarSynced: false,
      qualifications: [],
      gender: '',
      location: { country: '' },
      bio: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: new Date().toISOString(),
      theme: 'dark',
      availabilityTemplate: DEFAULT_TEMPLATE
    };
    await setDoc(userDocRef, newProfile);
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
// (role/userRole/userStatus/qualifications) are intentionally excluded — they
// are admin-controlled and enforced server-side by Firestore rules. See BUG-002.
const OWN_EDITABLE_FIELDS: (keyof UserProfile)[] = [
  'prefix', 'displayName', 'photoURL', 'gender', 'location',
  'bio', 'timezone', 'calendarSynced', 'theme', 'availabilityTemplate'
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

// Canonical approval/role helpers — the single source of truth reconciling the
// legacy `role` field with the newer `userRole`/`userStatus` model. See BUG-012.
export const getEffectiveStatus = (p?: UserProfile | null): 'active' | 'inactive' => {
  if (!p) return 'inactive';
  if (p.userStatus) return p.userStatus;
  return p.role !== null && p.role !== undefined ? 'active' : 'inactive';
};

export const getEffectiveRole = (p?: UserProfile | null): 'admin' | 'user' => {
  if (!p) return 'user';
  if (p.userRole) return p.userRole;
  return p.role === 'admin' ? 'admin' : 'user';
};

export const isApproved = (p?: UserProfile | null): boolean => {
  return getEffectiveStatus(p) === 'active';
};

// Format a stored createdAt for display, accepting both ISO timestamps (new
// format) and legacy "Month, Year" display strings. See BUG-020.
export const formatMemberSince = (createdAt?: string): string => {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return createdAt;
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
// legacy `role` field because it is present on EVERY document (set on signup
// and kept in sync with userStatus), whereas `userStatus` may be absent on
// pre-migration docs — querying it would silently drop them. See BUG-002.
export const subscribeToActiveCoaches = (callback: (users: UserProfile[]) => void): (() => void) => {
  const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'user']));
  return onSnapshot(q, (querySnap) => {
    const users: UserProfile[] = [];
    querySnap.forEach((d) => users.push(d.data() as UserProfile));
    callback(users);
  });
};

// Live count of pending (inactive) users — transfers only pending documents
// rather than the whole collection just to derive a badge number (BUG-006).
// `role == null` is the canonical "pending" marker, present on every doc. See BUG-002.
export const subscribeToPendingUsersCount = (callback: (count: number) => void): (() => void) => {
  const q = query(collection(db, 'users'), where('role', '==', null));
  return onSnapshot(q, (querySnap) => callback(querySnap.size));
};

export const setUserRole = async (uid: string, role: 'admin' | 'user' | null): Promise<void> => {
  await updateProfile(uid, { role });
};

export const setUserRoleAndStatus = async (
  uid: string,
  role: 'user' | 'admin',
  status: 'active' | 'inactive'
): Promise<void> => {
  const legacyRole = status === 'active' ? role : null;
  await updateProfile(uid, {
    userRole: role,
    userStatus: status,
    role: legacyRole
  });
};

export const formatDisplayName = (user: { displayName?: string | null; prefix?: string } | null | undefined): string => {
  if (!user) return '';
  const cleanName = (user.displayName || '').replace(/\s*\([^)]*\)/g, '').trim();
  if (user.prefix && user.prefix.trim() !== '') {
    if (cleanName.startsWith(user.prefix)) {
      return cleanName;
    }
    return `${user.prefix} ${cleanName}`;
  }
  return cleanName;
};

const recalcChains = new Map<string, Promise<void>>();

// Serialize recalculations per-uid so concurrent triggers cannot interleave and
// clobber each other's writes (lost update). Errors propagate so callers may
// retry rather than silently dropping them. See BUG-009.
export const recalculateUserAvailability = (uid: string): Promise<void> => {
  const prev = recalcChains.get(uid) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => doRecalculateUserAvailability(uid));
  recalcChains.set(uid, next);
  next.finally(() => {
    if (recalcChains.get(uid) === next) recalcChains.delete(uid);
  }).catch(() => {});
  return next;
};

const doRecalculateUserAvailability = async (uid: string): Promise<void> => {
  if (!db) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) return;
    
    const profile = userDoc.data() as UserProfile;
    const timezone = profile.timezone || 'UTC';
    
    // Get availability template
    const template = profile.availabilityTemplate || DEFAULT_TEMPLATE;
    const weekly = template.weekly || DEFAULT_TEMPLATE.weekly;
    const blockedDates = template.blockedDates || [];
    
    // Query bookings
    const bookingsCol = collection(db, 'bookings');
    const q1 = query(bookingsCol, where('coachUid', '==', uid));
    const snap1 = await getDocs(q1);
    
    const q2 = query(bookingsCol, where('menteeUid', '==', uid));
    const snap2 = await getDocs(q2);
    
    const bookings: DocumentData[] = [];
    const seen = new Set<string>();
    const addSnap = (snap: QuerySnapshot<DocumentData>) => {
      snap.forEach((d) => {
        const data = d.data();
        if (data.id && !seen.has(data.id)) {
          seen.add(data.id);
          bookings.push(data);
        }
      });
    };
    addSnap(snap1);
    addSnap(snap2);
    
    // Generate busy intervals for next 56 days
    const busySlots: { start: string; end: string; source: 'template' | 'booking' | 'block' }[] = [];
    
    // 1. Process weekly template and blocked dates
    // Get local today in user's timezone
    const localToday = getLocalDateInTimezone(new Date(), timezone);
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    for (let i = 0; i < 56; i++) {
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
          end: dayEnd.toISOString(),
          source: 'block'
        });
        continue;
      }
      
      const dayName = daysOfWeek[currentDate.getDay()];
      const daySched = weekly[dayName as keyof typeof weekly] || { enabled: false, slots: [] };
      
      if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) {
        // Entire day is unavailable
        const dayStart = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
        const dayEnd = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
        busySlots.push({
          start: dayStart.toISOString(),
          end: dayEnd.toISOString(),
          source: 'template'
        });
      } else {
        // Compute busy intervals (gaps outside the enabled slots)
        // Sort slots by time
        const sortedSlots = [...daySched.slots].map(s => {
          const parsedStart = parseLocalTime(s.start);
          const parsedEnd = parseLocalTime(s.end);
          return {
            startMin: parsedStart.hour * 60 + parsedStart.minute,
            endMin: parsedEnd.hour * 60 + parsedEnd.minute,
            startStr: s.start,
            endStr: s.end
          };
        }).sort((a, b) => a.startMin - b.startMin);
        
        // Gap 1: from 00:00 to start of first slot
        if (sortedSlots[0].startMin > 0) {
          const startUtc = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
          const parsedS = parseLocalTime(sortedSlots[0].startStr);
          const endUtc = getUtcForLocalDateTime(year, month, day, parsedS.hour, parsedS.minute, timezone);
          busySlots.push({
            start: startUtc.toISOString(),
            end: endUtc.toISOString(),
            source: 'template'
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
              end: endUtc.toISOString(),
              source: 'template'
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
            end: endUtc.toISOString(),
            source: 'template'
          });
        }
      }
    }
    
    // 2. Process active bookings (skip cancelled and already-finished ones so
    //    busy slots don't accrete forever). See BUG-016.
    const nowMs = Date.now();
    bookings.forEach(b => {
      if (b.status === 'cancelled') return;
      const bStart = b.start?.dateTime || b.start;
      const bEnd = b.end?.dateTime || b.end;
      if (bStart && bEnd) {
        if (new Date(bEnd).getTime() < nowMs) return;
        busySlots.push({
          start: new Date(bStart).toISOString(),
          end: new Date(bEnd).toISOString(),
          source: 'booking'
        });
      }
    });
    
    // Save to availability document
    const availDocRef = doc(db, 'availability', uid);
    await setDoc(availDocRef, {
      uid,
      lastUpdated: new Date().toISOString(),
      busySlots
    });
  } catch (err) {
    console.error('Error recalculating availability:', err);
    throw err;
  }
};
