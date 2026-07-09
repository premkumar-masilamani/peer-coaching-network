import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseApp';
import { COLLECTIONS } from '../config';
import { type AvailableDays } from './types';
import { DEFAULT_AVAILABLE_DAYS, recalculateAvailableSlotsCache } from './slotsService';

export const getSchedule = async (userId: string): Promise<{ availableDays: AvailableDays; blockedDates: string[] }> => {
  const availableDaysRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
  const blockedDatesRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
  
  const [daysSnap, datesSnap] = await Promise.all([
    getDoc(availableDaysRef),
    getDoc(blockedDatesRef)
  ]);
  
  const availableDays = daysSnap.exists() ? (daysSnap.data() as AvailableDays) : DEFAULT_AVAILABLE_DAYS;
  const blockedDates = datesSnap.exists() ? (datesSnap.data().blockedDates as string[]) : [];
  
  return { availableDays, blockedDates };
};

export const updateSchedule = async (
  userId: string,
  availableDays: AvailableDays,
  blockedDates: string[]
): Promise<void> => {
  const availableDaysRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
  const blockedDatesRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
  
  await Promise.all([
    setDoc(availableDaysRef, availableDays),
    setDoc(blockedDatesRef, { blockedDates })
  ]);
  
  await recalculateAvailableSlotsCache(userId);
};
