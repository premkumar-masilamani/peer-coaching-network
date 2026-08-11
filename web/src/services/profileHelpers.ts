import { type UserRole, type UserStatus, USER_ROLE, USER_STATUS } from '../config';
import type { UserProfile } from './types';

// ── Pure, side-effect-free profile predicates ────────────────────────────────
// Canonical source of truth for user status/role. Kept dependency-free (config +
// types only) so infrastructure modules like slotsService/discoveryService can
// gate on approval without importing profileService — which would create an
// import cycle (profileService depends on slotsService for cache recalculation).

export const getEffectiveStatus = (p?: UserProfile | null): UserStatus => {
  return p?.userStatus || USER_STATUS.INACTIVE;
};

export const getEffectiveRole = (p?: UserProfile | null): UserRole => {
  return p?.userRole || USER_ROLE.USER;
};

export const isApproved = (p?: UserProfile | null): boolean => {
  return getEffectiveStatus(p) === USER_STATUS.ACTIVE;
};
