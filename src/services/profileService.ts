import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  documentId,
} from 'firebase/firestore';
import type { DocumentData, Timestamp } from 'firebase/firestore';
import {
  type Qualification,
  type UserRole,
  type UserStatus,
  USER_STATUS,
  COLLECTIONS,
} from '../config';
import { db } from './firebaseApp';
import { recalculateAvailableSlotsCache } from './slotsService';
import { chunkArray } from '../utils/chunkArray';
import { logger } from '../utils/logger';
import type { UserProfile } from './types';

// Canonical approval/role helpers live in a dependency-free module so
// infrastructure services can reuse them without an import cycle; re-exported
// here so profile consumers keep a single import surface.
export { getEffectiveStatus, getEffectiveRole, isApproved } from './profileHelpers';

// ── Profile queries and mutators ──────────────────────────────────────────────
export const getProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, COLLECTIONS.USERS, uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
};

// Generic mutator. Used by admin operations that legitimately write privileged
// fields; server-side Firestore rules enforce that only admins may do so.
export const updateProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(docRef, updates);
  // Cache uses profile fields like status, gender, country, etc.
  recalculateAvailableSlotsCache(uid).catch((err) => logger.error(`Error recalculating slots cache for ${uid}:`, err));
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
  recalculateAvailableSlotsCache(uid).catch((err) => logger.error(`Error recalculating slots cache for ${uid}:`, err));
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

// ── Admin-specific operations ─────────────────────────────────────────────────
export const getAllUsers = async (): Promise<UserProfile[]> => {
  const querySnap = await getDocs(collection(db, COLLECTIONS.USERS));
  const users: UserProfile[] = [];
  querySnap.forEach((doc) => {
    users.push(doc.data() as UserProfile);
  });
  return users;
};

// One-shot query for ACTIVE users only (peer coaches), avoiding a full
// users-collection download for the dashboard. We filter on the
// userStatus field.
export const getActiveCoaches = async (): Promise<UserProfile[]> => {
  const q = query(collection(db, COLLECTIONS.USERS), where('userStatus', '==', USER_STATUS.ACTIVE));
  const querySnap = await getDocs(q);
  const users: UserProfile[] = [];
  querySnap.forEach((d) => users.push(d.data() as UserProfile));
  return users;
};

// Count of pending (inactive) users — transfers only pending documents
// rather than the whole collection just to derive a badge number.
export const getPendingUsersCount = async (): Promise<number> => {
  const q = query(collection(db, COLLECTIONS.USERS), where('userStatus', '==', USER_STATUS.INACTIVE));
  const querySnap = await getDocs(q);
  return querySnap.size;
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
  recalculateAvailableSlotsCache(uid).catch((err) => logger.error(`Error recalculating slots cache for ${uid}:`, err));
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
