import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BOOKING_STATUS } from '../../config';

const { mockGoogleToken, mockCallable, mockRepo, mockProfileService } = vi.hoisted(() => ({
  mockGoogleToken: vi.fn(),
  mockCallable: vi.fn().mockResolvedValue({ data: { success: true } }),
  mockRepo: {
    fetchUpcomingBookingsByClient: vi.fn(),
    fetchUpcomingBookingsByCoach: vi.fn(),
    fetchBookingsByClient: vi.fn(),
    fetchBookingsByCoach: vi.fn(),
  },
  mockProfileService: {
    getProfiles: vi.fn().mockResolvedValue([
      { userId: 'coach-1', displayName: 'Coach One', email: 'coach@example.com' },
      { userId: 'u-1', displayName: 'Client One', email: 'client@example.com' },
    ]),
    formatDisplayName: (u: { displayName?: string } | null | undefined) => u?.displayName || 'User',
  },
}));

vi.mock('../firebaseApp', () => ({
  db: { type: 'mock-db' },
  auth: { currentUser: { uid: 'u-1', email: 'user@example.com' } },
  functions: { type: 'mock-functions' },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('../firestoreRepository', () => mockRepo);
vi.mock('../profileService', () => mockProfileService);

vi.mock('../googleToken', () => ({
  getGoogleToken: mockGoogleToken,
  clearGoogleToken: vi.fn(),
}));

import {
  getUpcomingEvents,
  scheduleMeeting,
  cancelBooking,
} from '../googleCalendar';

describe('googleCalendar service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogleToken.mockReturnValue(null);
  });

  describe('getUpcomingEvents', () => {
    it('fetches upcoming bookings from Firestore when no Google token is available', async () => {
      mockRepo.fetchUpcomingBookingsByClient.mockResolvedValueOnce([
        {
          bookingId: 'booking-1',
          coachUid: 'coach-1',
          clientUid: 'u-1',
          topic: 'Growth Mindset',
          status: BOOKING_STATUS.CONFIRMED,
          startTime: { toDate: () => new Date('2026-09-01T10:00:00Z') },
          endTime: { toDate: () => new Date('2026-09-01T10:30:00Z') },
        },
      ]);
      mockRepo.fetchUpcomingBookingsByCoach.mockResolvedValueOnce([]);

      const events = await getUpcomingEvents();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('booking-1');
      expect(events[0].summary).toContain('Peer Coaching Session');
    });
  });

  describe('scheduleMeeting & cancelBooking', () => {
    it('calls manageBooking cloud function on scheduleMeeting', async () => {
      mockGoogleToken.mockReturnValue('valid-token');
      const result = await scheduleMeeting(
        'coach-1',
        'coach@example.com',
        'Coach Name',
        'u-1',
        'Client Name',
        '2026-09-01T10:00:00.000Z',
        '2026-09-01T10:30:00.000Z',
        'Topic'
      );

      expect(mockCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'book',
          coachUid: 'coach-1',
          startIso: '2026-09-01T10:00:00.000Z',
          endIso: '2026-09-01T10:30:00.000Z',
          topic: 'Topic',
        })
      );
      expect(result).toBeDefined();
    });

    it('calls manageBooking cloud function on cancelBooking', async () => {
      mockGoogleToken.mockReturnValue('valid-token');
      await cancelBooking('booking-123');

      expect(mockCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          bookingId: 'booking-123',
        })
      );
    });
  });
});
