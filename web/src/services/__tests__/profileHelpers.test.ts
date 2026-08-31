import { describe, it, expect } from 'vitest';
import { getEffectiveRole, getEffectiveStatus, isApproved } from '../profileHelpers';
import { USER_ROLE, USER_STATUS } from '../../config';
import type { UserProfile } from '../types';

describe('profileHelpers', () => {
  const createMockProfile = (partial: Partial<UserProfile>): UserProfile =>
    ({
      userId: 'user-1',
      email: 'user@example.com',
      firstName: 'User',
      lastName: 'One',
      userRole: USER_ROLE.USER,
      userStatus: USER_STATUS.ACTIVE,
      ...partial,
    }) as unknown as UserProfile;

  describe('getEffectiveStatus', () => {
    it('returns userStatus when profile exists', () => {
      const p = createMockProfile({ userStatus: USER_STATUS.ACTIVE });
      expect(getEffectiveStatus(p)).toBe(USER_STATUS.ACTIVE);
    });

    it('returns INACTIVE when profile is null or undefined', () => {
      expect(getEffectiveStatus(null)).toBe(USER_STATUS.INACTIVE);
      expect(getEffectiveStatus(undefined)).toBe(USER_STATUS.INACTIVE);
    });
  });

  describe('getEffectiveRole', () => {
    it('returns userRole when profile exists', () => {
      const p = createMockProfile({ userRole: USER_ROLE.ADMIN });
      expect(getEffectiveRole(p)).toBe(USER_ROLE.ADMIN);
    });

    it('returns USER when profile is null or undefined', () => {
      expect(getEffectiveRole(null)).toBe(USER_ROLE.USER);
      expect(getEffectiveRole(undefined)).toBe(USER_ROLE.USER);
    });
  });

  describe('isApproved', () => {
    it('returns true if status is active', () => {
      const p = createMockProfile({ userStatus: USER_STATUS.ACTIVE });
      expect(isApproved(p)).toBe(true);
    });

    it('returns false if status is inactive or not active', () => {
      const p1 = createMockProfile({ userStatus: USER_STATUS.INACTIVE });
      expect(isApproved(p1)).toBe(false);

      expect(isApproved(null)).toBe(false);
    });
  });
});
