import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallable, mockRepo } = vi.hoisted(() => ({
  mockCallable: vi.fn().mockResolvedValue({ data: { success: true } }),
  mockRepo: {
    getUserProfile: vi.fn(),
    fetchAllUsers: vi.fn(),
    fetchUsersPage: vi.fn(),
    fetchUsersByStatus: vi.fn(),
    countUsersByStatus: vi.fn(),
    fetchUsersByIds: vi.fn(),
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../firebaseApp', () => ({
  functions: { type: 'mock-functions' },
  db: { type: 'mock-db' },
}));

vi.mock('../firestoreRepository', () => mockRepo);

import {
  getProfile,
  updateProfile,
  updateOwnProfile,
  formatMemberSince,
  formatDisplayName,
  getAllUsers,
  getUsersPage,
  getPendingUsersCount,
  getPendingUsers,
  setUserRoleAndStatus,
  updateVerifiedCredentials,
  getProfiles,
} from '../profileService';
import { USER_ROLE, USER_STATUS } from '../../config';

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProfile & getProfiles', () => {
    it('retrieves single profile by uid', async () => {
      mockRepo.getUserProfile.mockResolvedValueOnce({
        userId: 'u-1',
        firstName: 'Alice',
        lastName: 'User',
        userRole: USER_ROLE.USER,
      });

      const profile = await getProfile('u-1');
      expect(mockRepo.getUserProfile).toHaveBeenCalledWith('u-1');
      expect(profile?.firstName).toBe('Alice');
    });

    it('retrieves multiple profiles by uids', async () => {
      mockRepo.fetchUsersByIds.mockResolvedValueOnce([
        { userId: 'u-1', displayName: 'Alice' },
        { userId: 'u-2', displayName: 'Bob' },
      ]);

      const profiles = await getProfiles(['u-1', 'u-2']);
      expect(mockRepo.fetchUsersByIds).toHaveBeenCalledWith(['u-1', 'u-2']);
      expect(profiles).toHaveLength(2);
    });
  });

  describe('updateProfile & updateOwnProfile', () => {
    it('calls cloud function for updateProfile', async () => {
      await updateProfile('u-1', { bio: 'New bio' });
      expect(mockCallable).toHaveBeenCalledWith({
        userId: 'u-1',
        profileData: { bio: 'New bio' },
      });
    });

    it('filters only allowed editable fields in updateOwnProfile', async () => {
      await updateOwnProfile('u-1', {
        bio: 'Valid bio',
        gender: 'Female',
        userRole: USER_ROLE.ADMIN as unknown as undefined,
      });

      expect(mockCallable).toHaveBeenCalledWith({
        userId: 'u-1',
        profileData: {
          bio: 'Valid bio',
          gender: 'Female',
        },
      });
    });

    it('does nothing if no valid editable fields provided in updateOwnProfile', async () => {
      await updateOwnProfile('u-1', {
        userRole: USER_ROLE.ADMIN as unknown as undefined,
      });
      expect(mockCallable).not.toHaveBeenCalled();
    });
  });

  describe('formatMemberSince', () => {
    it('formats FirestoreTimestamp properly', () => {
      const mockTimestamp = {
        toDate: () => new Date('2026-03-15T12:00:00Z'),
        seconds: 1773576000,
        nanoseconds: 0,
        toMillis: () => 1773576000000,
      };
      expect(formatMemberSince(mockTimestamp)).toBe('March 2026');
    });

    it('formats ISO string properly', () => {
      expect(formatMemberSince('2026-08-01T00:00:00.000Z')).toBe('August 2026');
    });

    it('returns empty string on null or undefined', () => {
      expect(formatMemberSince(null)).toBe('');
      expect(formatMemberSince(undefined)).toBe('');
    });
  });

  describe('formatDisplayName', () => {
    it('combines firstName and lastName if present', () => {
      expect(formatDisplayName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
      expect(formatDisplayName({ firstName: 'Jane' })).toBe('Jane');
    });

    it('falls back to displayName stripping bracketed notes', () => {
      expect(formatDisplayName({ displayName: 'John Doe (Coach)' })).toBe('John Doe');
    });

    it('returns empty string if user is null or undefined', () => {
      expect(formatDisplayName(null)).toBe('');
      expect(formatDisplayName(undefined)).toBe('');
    });
  });

  describe('Admin operations', () => {
    it('getAllUsers, getUsersPage, getPendingUsersCount, getPendingUsers', async () => {
      mockRepo.fetchAllUsers.mockResolvedValueOnce([{ userId: 'u-1' }]);
      mockRepo.fetchUsersPage.mockResolvedValueOnce({ users: [{ userId: 'u-1' }], nextCursor: null, hasMore: false });
      mockRepo.countUsersByStatus.mockResolvedValueOnce(3);
      mockRepo.fetchUsersByStatus.mockResolvedValueOnce([{ userId: 'pending-1' }]);

      expect(await getAllUsers()).toHaveLength(1);
      expect((await getUsersPage(10)).users).toHaveLength(1);
      expect(await getPendingUsersCount()).toBe(3);
      expect(await getPendingUsers()).toHaveLength(1);
    });

    it('setUserRoleAndStatus updates both role and status', async () => {
      await setUserRoleAndStatus('u-1', USER_ROLE.ADMIN, USER_STATUS.ACTIVE);
      expect(mockCallable).toHaveBeenCalledWith({
        userId: 'u-1',
        profileData: {
          userRole: USER_ROLE.ADMIN,
          userStatus: USER_STATUS.ACTIVE,
        },
      });
    });

    it('updateVerifiedCredentials sets qualification flags', async () => {
      await updateVerifiedCredentials('u-1', ['ICF PCC', 'ICF ACTC']);
      expect(mockCallable).toHaveBeenCalledWith({
        userId: 'u-1',
        profileData: {
          icf_acc: false,
          icf_pcc: true,
          icf_mcc: false,
          icf_actc: true,
        },
      });
    });
  });
});
