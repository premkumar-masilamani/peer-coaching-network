import { Timestamp } from 'firebase/firestore';
import {
  type Gender,
  type Theme,
  type Qualification,
  type UserRole,
  type UserStatus,
  type SupportCategory,
  type SupportStatus,
  type IcfCredential
} from '../config';

export interface TimeRangeTimestamp {
  startTime: Timestamp;
  endTime: Timestamp;
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
  icfCredentials?: IcfCredential[];
  bio: string;
  timezone: string;
  userRole: UserRole;
  userStatus: UserStatus;
  theme: Theme;
  onboardingComplete?: boolean;
  createdAt: Timestamp;
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
  messages: SupportMessage[];
}

export interface DiscoveryFilters {
  gender?: string;
  country?: string;
  icf_acc?: boolean;
  icf_pcc?: boolean;
  icf_mcc?: boolean;
  icf_actc?: boolean;
}
