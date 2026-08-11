import type { AvailableDays, UserProfile } from './models';

export interface ManageBookingRequest {
  action: 'book' | 'cancel';
  bookingId: string;
  coachUid?: string;
  startIso?: string;
  endIso?: string;
  topic?: string;
  googleAccessToken?: string;
  clientName?: string;
  coachName?: string;
  coachEmail?: string;
}

export interface ManageBookingResponse {
  success: boolean;
  bookingId?: string;
  googleEventId?: string;
  googleMeetLink?: string;
}

export interface UpdateUserProfileAndScheduleRequest {
  profileData?: Partial<UserProfile>;
  availableDays?: AvailableDays;
  blockedDates?: string[];
  userId?: string;
}

export interface SyncMyCalendarRequest {
  googleAccessToken: string;
}
