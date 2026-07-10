/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { getEffectiveStatus, getEffectiveRole, isApproved } from '../profileHelpers';

// Pure predicates — no Firebase, no mocks required.
describe('profileHelpers', () => {
  const activeAdmin = { userId: '1', userRole: 'admin', userStatus: 'active' } as any;
  const inactiveUser = { userId: '2', userRole: 'user', userStatus: 'inactive' } as any;

  describe('getEffectiveStatus', () => {
    it('defaults to inactive for null/undefined/missing status', () => {
      expect(getEffectiveStatus(null)).toBe('inactive');
      expect(getEffectiveStatus(undefined)).toBe('inactive');
      expect(getEffectiveStatus({} as any)).toBe('inactive');
    });

    it('returns the profile status when present', () => {
      expect(getEffectiveStatus(activeAdmin)).toBe('active');
      expect(getEffectiveStatus(inactiveUser)).toBe('inactive');
    });
  });

  describe('getEffectiveRole', () => {
    it('defaults to user for null/undefined/missing role', () => {
      expect(getEffectiveRole(null)).toBe('user');
      expect(getEffectiveRole(undefined)).toBe('user');
      expect(getEffectiveRole({} as any)).toBe('user');
    });

    it('returns the profile role when present', () => {
      expect(getEffectiveRole(activeAdmin)).toBe('admin');
    });
  });

  describe('isApproved', () => {
    it('is true only for an active status', () => {
      expect(isApproved(activeAdmin)).toBe(true);
      expect(isApproved(inactiveUser)).toBe(false);
      expect(isApproved(null)).toBe(false);
    });
  });
});
