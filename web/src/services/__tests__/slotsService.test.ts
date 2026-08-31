import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallable, mockGetUserProfile, mockGetAvailability, mockAuth } = vi.hoisted(() => ({
  mockCallable: vi.fn().mockResolvedValue({ data: { success: true } }),
  mockGetUserProfile: vi.fn(),
  mockGetAvailability: vi.fn(),
  mockAuth: { currentUser: { uid: 'user-1' } },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../firebaseApp', () => ({
  functions: { type: 'mock-functions' },
  db: { type: 'mock-db' },
  auth: mockAuth,
}));

vi.mock('../firestoreRepository', () => ({
  getUserProfile: mockGetUserProfile,
  getAvailability: mockGetAvailability,
}));

import {
  recalculateAvailableSlotsCache,
  lazyRecalculateAvailableSlotsCache,
  getUserAvailableSlots,
} from '../slotsService';

describe('slotsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetUserProfile.mockResolvedValue({ userId: 'user-1', userStatus: 'active' });
  });

  describe('recalculateAvailableSlotsCache', () => {
    it('skips GCF call if user profile is not active', async () => {
      mockGetUserProfile.mockResolvedValue({
        userId: 'user-1',
        userStatus: 'inactive',
      });

      await recalculateAvailableSlotsCache('user-1');
      expect(mockCallable).not.toHaveBeenCalled();
    });

    it('triggers GCF call if user profile is active', async () => {
      mockGetUserProfile.mockResolvedValue({
        userId: 'user-1',
        userStatus: 'active',
      });

      await recalculateAvailableSlotsCache('user-1');
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  describe('lazyRecalculateAvailableSlotsCache', () => {
    it('does nothing if current user is not the owner', async () => {
      mockAuth.currentUser = { uid: 'different-user' };
      await lazyRecalculateAvailableSlotsCache('user-1');
      expect(mockGetAvailability).not.toHaveBeenCalled();
    });

    it('triggers recalc if cache is missing', async () => {
      mockGetAvailability.mockResolvedValueOnce(null);

      await lazyRecalculateAvailableSlotsCache('user-1');
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('triggers recalc if profile status changed', async () => {
      mockGetAvailability.mockResolvedValueOnce({
        userStatus: 'inactive',
        lastUpdated: { toDate: () => new Date() },
      });

      await lazyRecalculateAvailableSlotsCache('user-1');
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('triggers recalc if cache is older than 24 hours', async () => {
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
      mockGetAvailability.mockResolvedValueOnce({
        userStatus: 'active',
        lastUpdated: { toDate: () => thirtyHoursAgo },
      });

      await lazyRecalculateAvailableSlotsCache('user-1');
      expect(mockCallable).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  describe('getUserAvailableSlots', () => {
    it('returns availableSlotsUtc from cache', async () => {
      mockGetAvailability.mockResolvedValue({
        availableSlotsUtc: ['2026-09-01T10:00:00.000Z'],
        lastUpdated: { toDate: () => new Date() },
        userStatus: 'active',
      });

      const slots = await getUserAvailableSlots('user-1');
      expect(slots).toEqual(['2026-09-01T10:00:00.000Z']);
    });
  });
});
