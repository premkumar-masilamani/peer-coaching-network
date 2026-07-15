import type { DocumentData, Timestamp } from 'firebase/firestore';
import {
  type Qualification,
  type UserRole,
  type UserStatus,
  USER_STATUS,
} from '../config';
import {
  getUserProfile,
  updateUserProfile,
  fetchAllUsers,
  fetchUsersPage,
  fetchUsersByStatus,
  countUsersByStatus,
  fetchUsersByIds,
} from './firestoreRepository';
import { recalculateAvailableSlotsCache } from './slotsService';
import { logger } from '../utils/logger';
import type { UserProfile } from './types';

// Canonical approval/role helpers live in a dependency-free module so
// infrastructure services can reuse them without an import cycle; re-exported
// here so profile consumers keep a single import surface.
export { getEffectiveStatus, getEffectiveRole, isApproved } from './profileHelpers';

// ── Profile queries and mutators ──────────────────────────────────────────────
export const getProfile = async (uid: string): Promise<UserProfile | null> => {
  return getUserProfile(uid);
};

// Generic mutator. Used by admin operations that legitimately write privileged
// fields; server-side Firestore rules enforce that only admins may do so.
export const updateProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  await updateUserProfile(uid, updates);
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
  await updateUserProfile(uid, safeUpdates);
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
  return fetchAllUsers();
};

// One page of the admin user roster with an opaque cursor for the next page,
// bounding the first read rather than downloading the whole users collection.
export const getUsersPage = async (
  pageSize: number,
  pageCursor?: unknown
): Promise<{ users: UserProfile[]; nextCursor: unknown | null; hasMore: boolean }> => {
  return fetchUsersPage({ pageSize, pageCursor });
};

// One-shot query for ACTIVE users only (peer coaches), avoiding a full
// users-collection download for the dashboard. We filter on the
// userStatus field.
export const getActiveCoaches = async (): Promise<UserProfile[]> => {
  return fetchUsersByStatus(USER_STATUS.ACTIVE);
};

// Count of pending (inactive) users — transfers only pending documents
// rather than the whole collection just to derive a badge number.
export const getPendingUsersCount = async (): Promise<number> => {
  return countUsersByStatus(USER_STATUS.INACTIVE);
};

// Full list of pending (inactive) users. The pending set is small and transient,
// so it is fetched in full — this keeps the admin approval workflow complete
// even though the main roster is paginated by document id.
export const getPendingUsers = async (): Promise<UserProfile[]> => {
  return fetchUsersByStatus(USER_STATUS.INACTIVE);
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
  const updates: DocumentData = {};
  if (newQualifications) {
    updates.icf_acc = newQualifications.includes('ICF ACC');
    updates.icf_pcc = newQualifications.includes('ICF PCC');
    updates.icf_mcc = newQualifications.includes('ICF MCC');
    updates.icf_actc = newQualifications.includes('ICF ACTC');
  }
  await updateUserProfile(uid, updates);
  // Credential/qualification changes alter the denormalized filter fields in the
  // availability cache and day shards, so refresh them.
  recalculateAvailableSlotsCache(uid).catch((err) => logger.error(`Error recalculating slots cache for ${uid}:`, err));
};

export const getProfiles = async (uids: string[]): Promise<UserProfile[]> => {
  return fetchUsersByIds(uids);
};
