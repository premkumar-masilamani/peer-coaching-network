import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { Auth, User, OAuthCredential } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';


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
}

// Check if Firebase configuration is provided
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
  firebaseConfig.apiKey.trim() !== ''
);

// Seeding Mock Data
const MOCK_PROFILES_KEY = 'pcn_mock_profiles';
const CURRENT_MOCK_USER_KEY = 'pcn_current_mock_user';

const defaultMockProfiles: UserProfile[] = [
  {
    uid: 'admin-1',
    email: 'admin@peercoaching.net',
    displayName: 'Eleanor Vance',
    prefix: '',
    photoURL: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    gender: 'Female',
    location: { country: 'United Kingdom' },
    qualifications: ['ICF MCC'],
    bio: 'Lead Administrator of the Peer Coaching Network and executive coach with 15+ years experience.',
    role: 'admin',
    userRole: 'admin',
    userStatus: 'active',
    calendarSynced: true,
    timezone: 'Europe/London',
    createdAt: 'October, 2024',
    theme: 'dark'
  },
  {
    uid: 'coach-1',
    email: 'marcus.brody@peercoaching.net',
    displayName: 'Marcus Brody',
    prefix: '',
    photoURL: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    gender: 'Male',
    location: { country: 'USA' },
    qualifications: ['ICF PCC'],
    bio: 'Specializing in leadership development, career transitions, and cognitive behavioral coaching.',
    role: 'user',
    userRole: 'user',
    userStatus: 'active',
    calendarSynced: true,
    timezone: 'America/New_York',
    createdAt: 'October, 2024',
    theme: 'dark'
  },
  {
    uid: 'coach-2',
    email: 'sarah.lin@peercoaching.net',
    displayName: 'Sarah Lin',
    prefix: 'Dr.',
    photoURL: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    gender: 'Female',
    location: { country: 'USA' },
    qualifications: ['ICF MCC'],
    bio: 'Life and wellness coach helping high-performers avoid burnout and build meaningful habits.',
    role: 'user',
    userRole: 'user',
    userStatus: 'active',
    calendarSynced: true,
    timezone: 'America/Los_Angeles',
    createdAt: 'January, 2025',
    theme: 'dark'
  },
  {
    uid: 'coach-3',
    email: 'david.chen@peercoaching.net',
    displayName: 'David Chen',
    prefix: '',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    gender: 'Male',
    location: { country: 'Canada' },
    qualifications: ['ICF ACC'],
    bio: 'Transitions coach focusing on early-career professionals and scaling tech startup founders.',
    role: 'user',
    userRole: 'user',
    userStatus: 'active',
    calendarSynced: false,
    timezone: 'America/Vancouver',
    createdAt: 'January, 2025',
    theme: 'dark'
  },
  {
    uid: 'pending-1',
    email: 'aria.sterling@peercoaching.net',
    displayName: 'Aria Sterling',
    prefix: '',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    gender: 'Female',
    location: { country: 'Australia' },
    qualifications: ['ICF ACC'],
    bio: 'Relationship and interpersonal coach seeking to connect with peer coaches around the world.',
    role: null,
    userRole: 'user',
    userStatus: 'inactive',
    calendarSynced: false,
    timezone: 'Australia/Sydney',
    createdAt: 'February, 2025',
    theme: 'dark'
  }
];

// Reseed old local storage profiles containing brackets or missing properties, or reset mock data on request
const MOCK_DATA_VERSION_KEY = 'pcn_mock_data_version';
const currentVersion = localStorage.getItem(MOCK_DATA_VERSION_KEY);
if (currentVersion !== 'v3') {
  localStorage.removeItem(MOCK_PROFILES_KEY);
  localStorage.removeItem(CURRENT_MOCK_USER_KEY);
  localStorage.removeItem('pcn_scheduled_meetings');
  localStorage.setItem(MOCK_DATA_VERSION_KEY, 'v3');
}

const storedProfiles = localStorage.getItem(MOCK_PROFILES_KEY);
if (storedProfiles) {
  try {
    const parsed = JSON.parse(storedProfiles) as UserProfile[];
    const needsMigration = parsed.some(
      p => (p.displayName && p.displayName.includes('(')) || p.userRole === undefined || p.userStatus === undefined || p.createdAt === undefined
    );
    if (needsMigration) {
      localStorage.removeItem(MOCK_PROFILES_KEY);
      localStorage.removeItem(CURRENT_MOCK_USER_KEY);
    }
  } catch (e) {
    localStorage.removeItem(MOCK_PROFILES_KEY);
  }
}

// Initialize Mock database if empty
if (!localStorage.getItem(MOCK_PROFILES_KEY)) {
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(defaultMockProfiles));
}

// Load mock profiles
const getMockProfiles = (): UserProfile[] => {
  return JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
};

const saveMockProfiles = (profiles: UserProfile[]) => {
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db, isFirebaseConfigured };

// Standardized Auth Actions
export const loginWithGoogle = async (mockUid?: string): Promise<{ user: User | UserProfile; credential?: OAuthCredential | null }> => {
  if (isFirebaseConfigured) {
    const provider = new GoogleAuthProvider();
    // Request Google Calendar access
    provider.addScope('https://www.googleapis.com/auth/calendar');
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    const result = await signInWithPopup(auth!, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    // Store access token in session storage for Calendar API calls
    if (credential?.accessToken) {
      sessionStorage.setItem('google_access_token', credential.accessToken);
    }
    
    // Check/create user document in firestore
    const userDocRef = doc(db!, 'users', result.user.uid);
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
        createdAt: `${new Date().toLocaleString('en-US', { month: 'long' })}, ${new Date().getFullYear()}`,
        theme: 'dark'
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
  } else {
    // Mock Login
    const profiles = getMockProfiles();
    const targetUid = mockUid || 'pending-1';
    let targetUser = profiles.find(p => p.uid === targetUid);
    
    if (!targetUser) {
      // Create it if it doesn't exist
      targetUser = {
        uid: targetUid,
        email: `${targetUid}@example.com`,
        displayName: targetUid.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        prefix: '',
        photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${targetUid}`,
        role: null,
        userRole: 'user',
        userStatus: 'inactive',
        calendarSynced: false,
        qualifications: [],
        gender: '',
        location: { country: '' },
        bio: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: `${new Date().toLocaleString('en-US', { month: 'long' })}, ${new Date().getFullYear()}`,
        theme: 'dark'
      };
      profiles.push(targetUser);
      saveMockProfiles(profiles);
    }
    
    localStorage.setItem(CURRENT_MOCK_USER_KEY, JSON.stringify(targetUser));
    // Simulate token
    sessionStorage.setItem('google_access_token', 'mock_google_access_token');
    
    // Trigger auth state change listeners
    if (mockAuthListener) {
      mockAuthListener(targetUser);
    }
    return { user: targetUser };
  }
};

export const logout = async (): Promise<void> => {
  if (isFirebaseConfigured) {
    sessionStorage.removeItem('google_access_token');
    await signOut(auth!);
  } else {
    localStorage.removeItem(CURRENT_MOCK_USER_KEY);
    sessionStorage.removeItem('google_access_token');
    if (mockAuthListener) {
      mockAuthListener(null);
    }
  }
};

let mockAuthListener: ((user: User | UserProfile | null) => void) | null = null;

export const subscribeToAuth = (callback: (user: User | UserProfile | null) => void): (() => void) => {
  if (isFirebaseConfigured) {
    return onAuthStateChanged(auth!, callback);
  } else {
    mockAuthListener = callback;
    const currentMock = localStorage.getItem(CURRENT_MOCK_USER_KEY);
    const user = currentMock ? JSON.parse(currentMock) : null;
    // Delayed call to simulate async auth check
    setTimeout(() => {
      callback(user);
    }, 100);
    return () => {
      mockAuthListener = null;
    };
  }
};

// Firestore Profile Listeners and Mutators
export const subscribeToProfile = (uid: string, callback: (profile: UserProfile | null) => void): (() => void) => {
  if (isFirebaseConfigured) {
    const docRef = doc(db!, 'users', uid);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as UserProfile);
      } else {
        callback(null);
      }
    });
  } else {
    const checkAndSend = () => {
      const profiles = getMockProfiles();
      const user = profiles.find(p => p.uid === uid) || null;
      callback(user);
    };
    checkAndSend();
    
    // Watch localStorage for edits (polling mock listener)
    const interval = setInterval(checkAndSend, 1000);
    return () => clearInterval(interval);
  }
};

export const updateProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  if (isFirebaseConfigured) {
    const docRef = doc(db!, 'users', uid);
    await updateDoc(docRef, updates);
  } else {
    const profiles = getMockProfiles();
    const index = profiles.findIndex(p => p.uid === uid);
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updates };
      saveMockProfiles(profiles);
      
      // Update current logged-in mock user reference if matching
      const currentMock = localStorage.getItem(CURRENT_MOCK_USER_KEY);
      if (currentMock) {
        const parsed = JSON.parse(currentMock);
        if (parsed.uid === uid) {
          localStorage.setItem(CURRENT_MOCK_USER_KEY, JSON.stringify(profiles[index]));
        }
      }
    }
  }
};

// Admin Specific Operations
export const subscribeToAllUsers = (callback: (users: UserProfile[]) => void): (() => void) => {
  if (isFirebaseConfigured) {
    const q = collection(db!, 'users');
    return onSnapshot(q, (querySnap) => {
      const users: UserProfile[] = [];
      querySnap.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      callback(users);
    });
  } else {
    const checkAndSend = () => {
      callback(getMockProfiles());
    };
    checkAndSend();
    const interval = setInterval(checkAndSend, 1000);
    return () => clearInterval(interval);
  }
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
