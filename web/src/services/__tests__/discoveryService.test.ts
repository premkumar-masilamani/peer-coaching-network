import { describe, it, expect, vi, beforeEach } from 'vitest';
import { USER_STATUS } from '../../config';

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    fetchUsersByStatus: vi.fn(),
    fetchAvailabilityByIds: vi.fn(),
    fetchConfirmedBookingsByParticipant: vi.fn(),
    subscribeToAvailability: vi.fn(),
  },
}));

vi.mock('../firebaseApp', () => ({
  db: { type: 'mock-db' },
}));

vi.mock('../firestoreRepository', () => mockRepo);

import { queryAvailableCoachesForDay, getUserBookings } from '../discoveryService';

describe('discoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryAvailableCoachesForDay', () => {
    const mockCoaches = [
      {
        userId: 'coach-1',
        displayName: 'Coach 1',
        gender: 'female',
        country: 'India',
        userStatus: USER_STATUS.ACTIVE,
        icf_pcc: true,
      },
      {
        userId: 'coach-2',
        displayName: 'Coach 2',
        gender: 'male',
        country: 'United States',
        userStatus: USER_STATUS.ACTIVE,
        icf_acc: true,
      },
    ];

    const mockAvailability = [
      {
        coachUid: 'coach-1',
        gender: 'female',
        country: 'India',
        icf_pcc: true,
        availableSlotsUtc: ['2026-09-01T10:00:00.000Z'],
      },
      {
        coachUid: 'coach-2',
        gender: 'male',
        country: 'United States',
        icf_acc: true,
        availableSlotsUtc: ['2026-09-01T10:00:00.000Z'],
      },
    ];

    it('returns available coaches matching slots and filters', async () => {
      mockRepo.fetchUsersByStatus.mockResolvedValueOnce(mockCoaches);
      mockRepo.fetchAvailabilityByIds.mockResolvedValueOnce(mockAvailability);

      const slots = [
        {
          startTime: new Date('2026-09-01T10:00:00.000Z'),
          endTime: new Date('2026-09-01T10:30:00.000Z'),
        },
      ];

      const result = await queryAvailableCoachesForDay(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-09-01T23:59:59.000Z'),
        slots,
        { gender: 'female' },
        'seed-123',
        'current-user-uid'
      );

      expect(result['2026-09-01T10:00:00.000Z']).toHaveLength(1);
      expect(result['2026-09-01T10:00:00.000Z'][0].userId).toBe('coach-1');
    });

    it('excludes current user from discovery results', async () => {
      mockRepo.fetchUsersByStatus.mockResolvedValueOnce(mockCoaches);
      mockRepo.fetchAvailabilityByIds.mockResolvedValueOnce(mockAvailability);

      const slots = [
        {
          startTime: new Date('2026-09-01T10:00:00.000Z'),
          endTime: new Date('2026-09-01T10:30:00.000Z'),
        },
      ];

      const result = await queryAvailableCoachesForDay(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-09-01T23:59:59.000Z'),
        slots,
        {},
        'seed-123',
        'coach-1'
      );

      expect(result['2026-09-01T10:00:00.000Z']).toHaveLength(1);
      expect(result['2026-09-01T10:00:00.000Z'][0].userId).toBe('coach-2');
    });
  });

  describe('getUserBookings', () => {
    it('retrieves confirmed bookings from repository', async () => {
      const mockBookings = [
        { id: 'b-1', coachUid: 'c-1', clientUid: 'u-1', status: 'confirmed' },
      ];
      mockRepo.fetchConfirmedBookingsByParticipant.mockResolvedValueOnce(mockBookings);

      const bookings = await getUserBookings('u-1');
      expect(mockRepo.fetchConfirmedBookingsByParticipant).toHaveBeenCalledWith('u-1');
      expect(bookings).toEqual(mockBookings);
    });
  });
});
