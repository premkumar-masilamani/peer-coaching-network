"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSlotAvailable = exports.getTimezoneCode = exports.getUtcForSlot = exports.getUtcForLocalDateTime = exports.parseLocalTime = exports.getLocalDateInTimezone = exports.getHour24 = void 0;
const getHour24 = (parts) => {
    let hour = parseInt(parts.find(p => p.type === 'hour').value);
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value;
    if (dayPeriod) {
        const dp = dayPeriod.toLowerCase();
        if ((dp.includes('pm') || dp === 'pm') && hour < 12) {
            hour += 12;
        }
        else if ((dp.includes('am') || dp === 'am') && hour === 12) {
            hour = 0;
        }
    }
    return hour;
};
exports.getHour24 = getHour24;
const getLocalDateInTimezone = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(date);
    const y = parseInt(parts.find(p => p.type === 'year').value);
    const m = parseInt(parts.find(p => p.type === 'month').value);
    const d = parseInt(parts.find(p => p.type === 'day').value);
    return new Date(y, m - 1, d);
};
exports.getLocalDateInTimezone = getLocalDateInTimezone;
const parseLocalTime = (timeStr) => {
    const match = timeStr.match(/^(\d+):(\d+)(?:\s*(AM|PM))?$/i);
    if (!match)
        return { hour: 0, minute: 0 };
    let hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    const ampm = match[3];
    // Range validation — reject impossible values (e.g. "25:99") instead of
    // letting them through as nonsensical minute totals.
    if (minute < 0 || minute > 59)
        return { hour: 0, minute: 0 };
    if (ampm) {
        if (hour < 1 || hour > 12)
            return { hour: 0, minute: 0 };
        const ap = ampm.toUpperCase();
        if (ap === 'PM' && hour < 12) {
            hour += 12;
        }
        else if (ap === 'AM' && hour === 12) {
            hour = 0;
        }
    }
    else if (hour < 0 || hour > 23) {
        return { hour: 0, minute: 0 };
    }
    return { hour, minute };
};
exports.parseLocalTime = parseLocalTime;
const getUtcForLocalDateTime = (year, month, day, hour, minute, timeZone) => {
    let utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
    // Fixed-point correction. Extra iterations give the offset room to settle
    // across DST transitions; it breaks early once converged.
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
        const tzYear = parseInt(parts.find(p => p.type === 'year').value);
        const tzMonth = parseInt(parts.find(p => p.type === 'month').value);
        const tzDay = parseInt(parts.find(p => p.type === 'day').value);
        const tzHour = (0, exports.getHour24)(parts);
        const tzMinute = parseInt(parts.find(p => p.type === 'minute').value);
        const targetMinutes = hour * 60 + minute;
        const currentMinutes = tzHour * 60 + tzMinute;
        const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0));
        const currentDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, 0, 0));
        const dayDiff = (targetDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000);
        const diffMinutes = dayDiff * 24 * 60 + (targetMinutes - currentMinutes);
        if (diffMinutes === 0)
            break;
        utcGuess = new Date(utcGuess.getTime() + diffMinutes * 60 * 1000);
    }
    return utcGuess;
};
exports.getUtcForLocalDateTime = getUtcForLocalDateTime;
// Convert a wall-clock hour on a given local date to the corresponding UTC
// instant. Thin wrapper over getUtcForLocalDateTime so this conversion lives in
// exactly one place (previously duplicated in CoachDashboard).
const getUtcForSlot = (date, hour, timeZone) => {
    return (0, exports.getUtcForLocalDateTime)(date.getFullYear(), date.getMonth() + 1, date.getDate(), hour, 0, timeZone);
};
exports.getUtcForSlot = getUtcForSlot;
const getTimezoneCode = (date, timeZone) => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            timeZoneName: 'short'
        }).formatToParts(date);
        return parts.find(p => p.type === 'timeZoneName')?.value || timeZone;
    }
    catch {
        return timeZone;
    }
};
exports.getTimezoneCode = getTimezoneCode;
/**
 * Checks if a dynamic query slot [slotStart, slotEnd] is fully covered by the available slots.
 * Each available slot represents a 30-minute availability window starting at the ISO date/time.
 */
const isSlotAvailable = (availableSlots, slotStart, slotEnd) => {
    if (availableSlots.length === 0)
        return false;
    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotEnd.getTime();
    const stepMs = 30 * 60 * 1000; // 30 minutes
    const intervals = availableSlots
        .map(s => {
        const start = new Date(s).getTime();
        return { start, end: start + stepMs };
    })
        .sort((a, b) => a.start - b.start);
    const merged = [];
    for (const interval of intervals) {
        if (merged.length === 0) {
            merged.push(interval);
        }
        else {
            const last = merged[merged.length - 1];
            if (interval.start <= last.end) {
                last.end = Math.max(last.end, interval.end);
            }
            else {
                merged.push(interval);
            }
        }
    }
    return merged.some(interval => interval.start <= slotStartMs && slotEndMs <= interval.end);
};
exports.isSlotAvailable = isSlotAvailable;
//# sourceMappingURL=timezoneHelpers.js.map