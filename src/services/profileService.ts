import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  Timestamp, 
  type DocumentData 
} from 'firebase/firestore';
import { db } from './firebaseApp';
import { 
  type UserRole, 
  type UserStatus, 
  USER_ROLE, 
  USER_STATUS, 
  COLLECTIONS 
} from '../config';
import { type UserProfile } from './types';
import { recalculateAvailableSlotsCache } from './slotsService';
import { type IcfCredential, type Qualification } from '../config';

export const getEffectiveStatus = (p?: UserProfile | null): UserStatus => {
  return p?.userStatus || USER_STATUS.INACTIVE;
};

export const getEffectiveRole = (p?: UserProfile | null): UserRole => {
  return p?.userRole || USER_ROLE.USER;
};

export const isApproved = (p?: UserProfile | null): boolean => {
  return getEffectiveStatus(p) === USER_STATUS.ACTIVE;
};

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

export const formatDisplayName = (user: { firstName?: string; lastName?: string; displayName?: string | null } | null | undefined): string => {
  if (!user) return '';
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return (user.displayName || '').replace(/\s*\([^)]*\)/g, '').trim();
};

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

export const updateProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(docRef, updates);
  await recalculateAvailableSlotsCache(uid);
};

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
  await recalculateAvailableSlotsCache(uid);
};

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

export const subscribeToActiveCoaches = (callback: (users: UserProfile[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTIONS.USERS), where('userStatus', '==', USER_STATUS.ACTIVE));
  return onSnapshot(q, (querySnap) => {
    const users: UserProfile[] = [];
    querySnap.forEach((d) => users.push(d.data() as UserProfile));
    callback(users);
  });
};

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

export const updateVerifiedCredentials = async (uid: string, credentials: IcfCredential[], newQualifications?: Qualification[]): Promise<void> => {
  const userDocRef = doc(db, COLLECTIONS.USERS, uid);
  const updates: DocumentData = {
    icfCredentials: credentials
  };
  if (newQualifications) {
    updates.icf_acc = newQualifications.includes('ICF ACC');
    updates.icf_pcc = newQualifications.includes('ICF PCC');
    updates.icf_mcc = newQualifications.includes('ICF MCC');
    updates.icf_actc = newQualifications.includes('ICF ACTC');
  }
  await updateDoc(userDocRef, updates);
  await recalculateAvailableSlotsCache(uid);
};
