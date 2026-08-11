"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemplateSlots = exports.timestampToTimeString = exports.timeStringToTimestamp = void 0;
const firestore_1 = require("firebase-admin/firestore");
const timezoneHelpers_1 = require("./timezoneHelpers");
// Pure conversions between a display time string ("9:00 AM") and a Timestamp
// anchored to the Unix epoch date. These carry only an hour/minute; the epoch
// date is a placeholder so availability templates can be stored as Timestamps.
const timeStringToTimestamp = (timeStr) => {
    const { hour, minute } = (0, timezoneHelpers_1.parseLocalTime)(timeStr);
    const date = new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
    return firestore_1.Timestamp.fromDate(date);
};
exports.timeStringToTimestamp = timeStringToTimestamp;
const timestampToTimeString = (timestamp) => {
    const date = timestamp.toDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const displayMinute = String(minute).padStart(2, '0');
    return `${displayHour}:${displayMinute} ${ampm}`;
};
exports.timestampToTimeString = timestampToTimeString;
const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/**
 * Single source of truth for expanding a coach's weekly availability template
 * into concrete bookable slot start times (ISO strings, 30-minute cadence) over
 * a booking horizon. Shared by the availability-cache recalculation and the
 * Google Calendar fallback path so the two can never silently diverge.
 *
 * The optional range bounds implement the fallback's windowing; when omitted the
 * full horizon is generated (the recalculation behaviour).
 */
const generateTemplateSlots = ({ availableDays, blockedDates, timezone, anchorDate, horizonDays, rangeStartMs, rangeEndMs, }) => {
    const availableSlots = [];
    const localToday = (0, timezoneHelpers_1.getLocalDateInTimezone)(anchorDate, timezone);
    for (let i = 0; i < horizonDays; i++) {
        const currentDate = new Date(localToday);
        currentDate.setDate(localToday.getDate() + i);
        if (rangeEndMs !== undefined && currentDate.getTime() > rangeEndMs)
            break;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (blockedDates.includes(dateStr))
            continue;
        const dayName = DAYS_OF_WEEK[currentDate.getDay()];
        const daySched = availableDays[dayName] || { enabled: false, slots: [] };
        if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0)
            continue;
        for (const slot of daySched.slots) {
            const parsedStart = (0, timezoneHelpers_1.parseLocalTime)((0, exports.timestampToTimeString)(slot.startTime));
            const parsedEnd = (0, timezoneHelpers_1.parseLocalTime)((0, exports.timestampToTimeString)(slot.endTime));
            const startMinutes = parsedStart.hour * 60 + parsedStart.minute;
            const endMinutes = parsedEnd.hour * 60 + parsedEnd.minute;
            for (let min = startMinutes; min < endMinutes; min += 30) {
                const slotHour = Math.floor(min / 60);
                const slotMin = min % 60;
                const slotStartUtc = (0, timezoneHelpers_1.getUtcForLocalDateTime)(year, month, day, slotHour, slotMin, timezone);
                const t = slotStartUtc.getTime();
                if (rangeStartMs !== undefined && t < rangeStartMs)
                    continue;
                if (rangeEndMs !== undefined && t >= rangeEndMs)
                    continue;
                availableSlots.push(slotStartUtc.toISOString());
            }
        }
    }
    return availableSlots;
};
exports.generateTemplateSlots = generateTemplateSlots;
//# sourceMappingURL=slotGeneration.js.map