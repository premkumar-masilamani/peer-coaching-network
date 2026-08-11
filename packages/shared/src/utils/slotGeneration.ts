import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from './timezoneHelpers';
import type { AvailableDays, FirestoreTimestamp } from '../models';

export const timeStringToTimestamp = <T>(timeStr: string, fromDate: (d: Date) => T): T => {
  const { hour, minute } = parseLocalTime(timeStr);
  const date = new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
  return fromDate(date);
};

export const timestampToTimeString = (timestamp: FirestoreTimestamp): string => {
  const date = timestamp.toDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${ampm}`;
};

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export interface GenerateTemplateSlotsParams {
  availableDays: AvailableDays;
  blockedDates: string[];
  timezone: string;
  /** Reference instant whose local date is day 0 of the sweep. */
  anchorDate: Date;
  /** Number of days to project forward from the anchor's local date. */
  horizonDays: number;
  /** Inclusive lower bound (ms). Slots before this are dropped. */
  rangeStartMs?: number;
  /** Exclusive upper bound (ms). Slots at/after this are dropped, and the day
   *  sweep short-circuits once the current local day passes it. */
  rangeEndMs?: number;
}

export const generateTemplateSlots = ({
  availableDays,
  blockedDates,
  timezone,
  anchorDate,
  horizonDays,
  rangeStartMs,
  rangeEndMs,
}: GenerateTemplateSlotsParams): string[] => {
  const availableSlots: string[] = [];
  const localToday = getLocalDateInTimezone(anchorDate, timezone);

  for (let i = 0; i < horizonDays; i++) {
    const currentDate = new Date(localToday);
    currentDate.setDate(localToday.getDate() + i);
    if (rangeEndMs !== undefined && currentDate.getTime() > rangeEndMs) break;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (blockedDates.includes(dateStr)) continue;

    const dayName = DAYS_OF_WEEK[currentDate.getDay()];
    const daySched = availableDays[dayName as keyof AvailableDays] || { enabled: false, slots: [] };

    if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) continue;

    for (const slot of daySched.slots) {
      const parsedStart = parseLocalTime(timestampToTimeString(slot.startTime));
      const parsedEnd = parseLocalTime(timestampToTimeString(slot.endTime));

      const startMinutes = parsedStart.hour * 60 + parsedStart.minute;
      const endMinutes = parsedEnd.hour * 60 + parsedEnd.minute;

      for (let min = startMinutes; min < endMinutes; min += 30) {
        const slotHour = Math.floor(min / 60);
        const slotMin = min % 60;
        const slotStartUtc = getUtcForLocalDateTime(year, month, day, slotHour, slotMin, timezone);
        const t = slotStartUtc.getTime();
        if (rangeStartMs !== undefined && t < rangeStartMs) continue;
        if (rangeEndMs !== undefined && t >= rangeEndMs) continue;
        availableSlots.push(slotStartUtc.toISOString());
      }
    }
  }

  return availableSlots;
};
