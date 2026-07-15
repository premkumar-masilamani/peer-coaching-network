import { fetchScheduleRaw, writeSchedule } from './firestoreRepository';
// Lazy import cycle with slotsService (it reads getSchedule from here). Only
// referenced inside updateSchedule below (call-time), so module evaluation order
// is irrelevant — do not hoist this call to module top level.
import { recalculateAvailableSlotsCache } from './slotsService';
import { logger } from '../utils/logger';
import { timeStringToTimestamp, timestampToTimeString } from '../utils/slotGeneration';
import type { AvailableDays } from './types';

// Re-exported so existing callers can keep importing the time-string helpers
// from the schedule domain (their canonical home is a side-effect-free util).
export { timeStringToTimestamp, timestampToTimeString };

export const DEFAULT_AVAILABLE_DAYS: AvailableDays = {
  monday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  tuesday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  wednesday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  thursday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  friday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  saturday: { enabled: false, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  sunday: { enabled: false, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] }
};

export const getSchedule = async (userId: string): Promise<{ availableDays: AvailableDays; blockedDates: string[] }> => {
  const { availableDays, blockedDates } = await fetchScheduleRaw(userId);
  return {
    availableDays: availableDays ?? DEFAULT_AVAILABLE_DAYS,
    blockedDates: blockedDates ?? [],
  };
};

export const updateSchedule = async (
  userId: string,
  availableDays: AvailableDays,
  blockedDates: string[]
): Promise<void> => {
  await writeSchedule(userId, availableDays, blockedDates);

  // Schedule changed, update the available slots cache
  recalculateAvailableSlotsCache(userId).catch((err) => logger.error(`Error recalculating slots cache for ${userId}:`, err));
};
