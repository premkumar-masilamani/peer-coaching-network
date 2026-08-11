import type { Gender, UserRole, UserStatus, SupportCategory, SupportStatus } from './config';

export interface FirestoreTimestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export interface TimeRangeTimestamp {
  startTime: FirestoreTimestamp;
  endTime: FirestoreTimestamp;
}

export interface DayAvailability {
  enabled: boolean;
  slots: TimeRangeTimestamp[];
}

export interface AvailableDays {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string; // Optional legacy field
  photoURL: string | null;
  gender: Gender;
  country: string;
  icf_acc?: boolean;
  icf_pcc?: boolean;
  icf_mcc?: boolean;
  icf_actc?: boolean;
  bio: string;
  timezone: string;
  userRole: UserRole;
  userStatus: UserStatus;
  onboardingComplete?: boolean;
  credentialDetails?: string;
  createdAt: FirestoreTimestamp;
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  createdAt: string; // ISO string
}

export interface SupportRequest {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface DiscoveryFilters {
  gender?: string;
  country?: string;
  icf_acc?: boolean;
  icf_pcc?: boolean;
  icf_mcc?: boolean;
  icf_actc?: boolean;
}

export interface Availability {
  coachUid: string;
  availableSlotsUtc: string[];
  lastUpdated: FirestoreTimestamp;
  // Denormalized user profile fields
  gender?: string;
  country?: string;
  icf_acc?: boolean;
  icf_pcc?: boolean;
  icf_mcc?: boolean;
  icf_actc?: boolean;
  userStatus?: UserStatus;
}
