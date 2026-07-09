import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  query, 
  collection, 
  where, 
  writeBatch,
  Timestamp,
  type DocumentData
} from 'firebase/firestore';
import { db, auth } from './firebaseApp';
import { 
  BOOKING_HORIZON_DAYS, 
  SLOT_DURATION_MS, 
  GOOGLE_FREE_BUSY_URL, 
  ENABLE_GOOGLE_INTEGRATION, 
  COLLECTIONS,
  USER_ROLE,
  USER_STATUS
} from '../config';
import { type UserProfile, type AvailableDays, type TimeRangeTimestamp } from './types';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { logger } from '../utils/logger';
import { TelemetryErrors } from '../config/telemetryErrors';
import { getGoogleToken } from './googleToken';

export const timeStringToTimestamp = (timeStr: string): Timestamp => {
  const { hour, minute } = parseLocalTime(timeStr);
  const date = new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
  return Timestamp.fromDate(date);
};

export const timestampToTimeString = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${ampm}`;
};

export const DEFAULT_AVAILABLE_DAYS: AvailableDays = {
  monday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  tuesday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  wednesday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  thursday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  friday: { enabled: true, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  saturday: { enabled: false, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] },
  sunday: { enabled: false, slots: [{ startTime: timeStringToTimestamp('9:00 AM'), endTime: timeStringToTimestamp('5:00 PM') }] }
};

export const generateSlotsForDate = (
  date: Date,
  availableDays: AvailableDays,
  blockedDates: string[],
  timezone: string
): string[] => {
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (blockedDates.includes(dateStr)) {
    return [];
  }

  const dayName = daysOfWeek[date.getDay()];
  const daySched = availableDays[dayName as keyof AvailableDays] || { enabled: false, slots: [] };

  if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) {
    return [];
  }

  const slots: string[] = [];
  for (const slot of daySched.slots) {
    const startTimeString = timestampToTimeString(slot.startTime);
    const endTimeString = timestampToTimeString(slot.endTime);

    const parsedStart = parseLocalTime(startTimeString);
    const parsedEnd = parseLocalTime(endTimeString);

    for (let hour = parsedStart.hour; hour < parsedEnd.hour; hour++) {
      const slotStartUtc = getUtcForLocalDateTime(year, month, day, hour, parsedStart.minute, timezone);
      slots.push(slotStartUtc.toISOString());
    }
  }
  return slots;
};

export const subtractBusyIntervals = (
  slots: string[],
  busy: { start: number; end: number }[]
): string[] => {
  if (busy.length === 0) return slots;
  return slots.filter((iso) => {
    const start = new Date(iso).getTime();
    const end = start + SLOT_DURATION_MS;
    return !busy.some((b) => b.start < end && b.end > start);
  });
};

export const getGoogleBusyIntervals = async (
  uid: string,
  timeMin: Date,
  timeMax: Date
): Promise<{ start: number; end: number }[]> => {
  if (!ENABLE_GOOGLE_INTEGRATION || auth?.currentUser?.uid !== uid) {
    return [];
  }
  const token = getGoogleToken();
  if (!token) return [];
  try {
    const response = await fetch(GOOGLE_FREE_BUSY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }],
      }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const busy: { start: string; end: string }[] = data?.calendars?.primary?.busy || [];
    return busy.map((b) => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }));
  } catch (e) {
    logger.error('Error fetching Google Calendar busy intervals:', e);
    return [];
  }
};

const recalcChains = new Map<string, Promise<void>>();

export const recalculateAvailableSlotsCache = (uid: string): Promise<void> => {
  const prev = recalcChains.get(uid) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => doRecalculateAvailableSlotsCache(uid));
  recalcChains.set(uid, next);
  next.finally(() => {
    if (recalcChains.get(uid) === next) recalcChains.delete(uid);
  }).catch(() => {});
  return next;
};

const doRecalculateAvailableSlotsCache = async (uid: string): Promise<void> => {
  if (!db) return;
  logger.debug(`Starting available slots cache recalculation for user: ${uid}`);
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const personalAvailabilityCacheRef = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid);

    const availableDaysRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
    const blockedDatesRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);

    const [userDoc, daysSnap, datesSnap] = await Promise.all([
      getDoc(userDocRef),
      getDoc(availableDaysRef),
      getDoc(blockedDatesRef)
    ]);

    if (!userDoc.exists()) return;
    
    const profile = userDoc.data() as UserProfile;
    const isCoachActive = profile.userRole === USER_ROLE.USER && profile.userStatus === USER_STATUS.ACTIVE;

    const availableSlots: string[] = [];
    let freeSlots: string[] = [];
    let availableDatesUtc: string[] = [];

    const filterFields = {
      gender: profile.gender || '',
      country: profile.country || '',
      icf_acc: !!profile.icf_acc,
      icf_pcc: !!profile.icf_pcc,
      icf_mcc: !!profile.icf_mcc,
      icf_actc: !!profile.icf_actc,
    };
    const lastUpdated = new Date().toISOString();

    if (isCoachActive) {
      const timezone = profile.timezone || 'UTC';
      const availableDays = daysSnap.exists() ? (daysSnap.data() as AvailableDays) : DEFAULT_AVAILABLE_DAYS;
      const blockedDates = datesSnap.exists() ? (datesSnap.data().blockedDates as string[]) : [];

      const localToday = getLocalDateInTimezone(new Date(), timezone);

      for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
        const currentDate = new Date(localToday);
        currentDate.setDate(localToday.getDate() + i);
        const daySlots = generateSlotsForDate(currentDate, availableDays, blockedDates, timezone);
        availableSlots.push(...daySlots);
      }

      const horizonStart = new Date();
      const horizonEnd = new Date(horizonStart);
      horizonEnd.setDate(horizonEnd.getDate() + BOOKING_HORIZON_DAYS + 1);
      const busyIntervals = await getGoogleBusyIntervals(uid, horizonStart, horizonEnd);

      freeSlots = Array.from(new Set(subtractBusyIntervals(availableSlots, busyIntervals))).sort();

      availableDatesUtc = Array.from(
        new Set(freeSlots.map(slotStr => slotStr.split('T')[0]))
      ).sort();
    }

    await setDoc(personalAvailabilityCacheRef, {
      userId: uid,
      lastUpdated,
      availableSlots: freeSlots,
      availableDatesUtc,
      ...filterFields,
      userStatus: profile.userStatus || USER_STATUS.INACTIVE,
    });

    if (auth?.currentUser?.uid !== uid) {
      logger.debug(`Skipping day-shard rebuild for ${uid}: not the coach's own session.`);
      logger.info(`Successfully recalculated aggregate availability cache for user: ${uid}`);
      return;
    }

    const slotsByDate = new Map<string, string[]>();
    for (const iso of freeSlots) {
      const dateISO = iso.split('T')[0];
      const list = slotsByDate.get(dateISO) || [];
      list.push(iso);
      slotsByDate.set(dateISO, list);
    }

    const existingShardsSnap = await getDocs(
      query(collection(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE), where('coachUid', '==', uid))
    );

    const batch = writeBatch(db);
    for (const [dateISO, slots] of slotsByDate) {
      const shardRef = doc(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE, `${uid}_${dateISO}`);
      batch.set(shardRef, {
        coachUid: uid,
        dateISO,
        freeSlots: slots,
        lastUpdated,
        ...filterFields,
      });
    }
    existingShardsSnap.forEach((shardDoc) => {
      if (!slotsByDate.has(shardDoc.data().dateISO)) {
        batch.delete(shardDoc.ref);
      }
    });
    await batch.commit();

    logger.info(`Successfully recalculated available slots cache and day shards for user: ${uid}`);
  } catch (err) {
    logger.error('Error recalculating available slots cache:', err);
    try {
      await logger.telemetry('error', 'recalculation_failure', {
        userId: uid,
        errorCode: TelemetryErrors.RECALCULATION_FAILURE.code,
        errorMessage: TeleculeErrorFixRequired(err),
        error: err instanceof Error ? err.message : String(err)
      });
    } catch (logErr) {
      logger.error('Failed to log recalculation failure:', logErr);
    }
    throw err;
  }
};

const TeleculeErrorFixRequired = (err: any): string => {
  return err instanceof Error ? err.message : 'Recalculation failed';
};
