import type { Timestamp } from 'firebase/firestore';

export interface IcfCredential {
  level: string; // 'ACC' | 'PCC' | 'MCC'
  expiryDate: Timestamp;
}

/**
 * User-related enumerations and types.
 */
export const GENDER = {
  FEMALE: 'Female',
  MALE:   'Male',
  OTHERS: 'Others',
} as const;
export const GENDER_OPTIONS = [GENDER.FEMALE, GENDER.MALE, GENDER.OTHERS] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const THEME = {
  LIGHT: 'light',
  DARK:  'dark',
} as const;
export const THEME_OPTIONS = [THEME.LIGHT, THEME.DARK] as const;
export type Theme = (typeof THEME_OPTIONS)[number];

export const QUALIFICATION = {
  ACC: 'ICF ACC',
  PCC: 'ICF PCC',
  MCC: 'ICF MCC',
  ACTC: 'ICF ACTC',
} as const;
export const QUALIFICATION_OPTIONS = [QUALIFICATION.ACC, QUALIFICATION.PCC, QUALIFICATION.MCC, QUALIFICATION.ACTC] as const;
export type Qualification = (typeof QUALIFICATION_OPTIONS)[number];

export const USER_ROLE = {
  USER:  'user',
  ADMIN: 'admin',
} as const;
export const USER_ROLES = [USER_ROLE.USER, USER_ROLE.ADMIN] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUS = {
  ACTIVE:   'active',
  INACTIVE: 'inactive',
} as const;
export const USER_STATUSES = [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
