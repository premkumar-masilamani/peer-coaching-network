export const getHour24 = (parts: Intl.DateTimeFormatPart[]): number => {
  let hour = parseInt(parts.find(p => p.type === 'hour')!.value);
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value;
  if (dayPeriod) {
    const dp = dayPeriod.toLowerCase();
    if ((dp.includes('pm') || dp === 'pm') && hour < 12) {
      hour += 12;
    } else if ((dp.includes('am') || dp === 'am') && hour === 12) {
      hour = 0;
    }
  }
  return hour;
};

export const getLocalDateInTimezone = (date: Date, timeZone: string): Date => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(date);
  
  const y = parseInt(parts.find(p => p.type === 'year')!.value);
  const m = parseInt(parts.find(p => p.type === 'month')!.value);
  const d = parseInt(parts.find(p => p.type === 'day')!.value);
  
  return new Date(y, m - 1, d);
};

export const parseLocalTime = (timeStr: string): { hour: number; minute: number } => {
  const match = timeStr.match(/^(\d+):(\d+)(?:\s*(AM|PM))?$/i);
  if (!match) return { hour: 0, minute: 0 };
  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const ampm = match[3];
  // Range validation — reject impossible values (e.g. "25:99") instead of
  // letting them through as nonsensical minute totals. See BUG-011.
  if (minute < 0 || minute > 59) return { hour: 0, minute: 0 };
  if (ampm) {
    if (hour < 1 || hour > 12) return { hour: 0, minute: 0 };
    const ap = ampm.toUpperCase();
    if (ap === 'PM' && hour < 12) {
      hour += 12;
    } else if (ap === 'AM' && hour === 12) {
      hour = 0;
    }
  } else if (hour < 0 || hour > 23) {
    return { hour: 0, minute: 0 };
  }
  return { hour, minute };
};

export const getUtcForLocalDateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date => {
  let utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Fixed-point correction. Extra iterations give the offset room to settle
  // across DST transitions; it breaks early once converged. See BUG-014.
  for (let i = 0; i < 5; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(utcGuess);

    const tzYear = parseInt(parts.find(p => p.type === 'year')!.value);
    const tzMonth = parseInt(parts.find(p => p.type === 'month')!.value);
    const tzDay = parseInt(parts.find(p => p.type === 'day')!.value);
    const tzHour = getHour24(parts);
    const tzMinute = parseInt(parts.find(p => p.type === 'minute')!.value);

    const targetMinutes = hour * 60 + minute;
    const currentMinutes = tzHour * 60 + tzMinute;

    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0));
    const currentDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, 0, 0));
    const dayDiff = (targetDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000);

    const diffMinutes = dayDiff * 24 * 60 + (targetMinutes - currentMinutes);
    if (diffMinutes === 0) break;

    utcGuess = new Date(utcGuess.getTime() + diffMinutes * 60 * 1000);
  }
  return utcGuess;
};

// Convert a wall-clock hour on a given local date to the corresponding UTC
// instant. Thin wrapper over getUtcForLocalDateTime so this conversion lives in
// exactly one place (previously duplicated in CoachDashboard). See BUG-014.
export const getUtcForSlot = (date: Date, hour: number, timeZone: string): Date => {
  return getUtcForLocalDateTime(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    hour,
    0,
    timeZone
  );
};
