import {
  BOOKING_HORIZON_DAYS,
  USER_ROLE,
  USER_STATUS,
  ENABLE_GOOGLE_INTEGRATION,
  SLOT_DURATION_MS,
  GOOGLE_FREE_BUSY_URL,
} from '../config';
import { db, auth } from './firebaseApp';
import { getSchedule } from './scheduleService';
import {
  getUserProfile,
  getAvailability,
  syncAvailability,
} from './firestoreRepository';
import { isApproved } from './profileHelpers';
import { getGoogleToken } from './googleToken';
import { generateTemplateSlots } from '../utils/slotGeneration';
import { logger } from '../utils/logger';
import { TelemetryErrors } from '../config/telemetryErrors';

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

const TIMEZONE_HORIZON_PADDING_DAYS = 1;

export const computeFreeSlots = (
  availableSlots: string[],
  busyIntervals: { start: number; end: number }[]
): { freeSlots: string[]; availableDatesUtc: string[] } => {
  const freeSlots = Array.from(
    new Set(subtractBusyIntervals(availableSlots, busyIntervals))
  ).sort();
  const availableDatesUtc = Array.from(
    new Set(freeSlots.map((slotStr) => slotStr.split('T')[0]))
  ).sort();
  return { freeSlots, availableDatesUtc };
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

export const lazyRecalculateAvailableSlotsCache = async (uid: string): Promise<void> => {
  if (!db) return;
  const isOwner = auth?.currentUser?.uid === uid;
  if (!isOwner) {
    return;
  }

  try {
    const data = await getAvailability(uid);
    let shouldRecalc = false;

    if (data) {
      const lastUpdated = data.lastUpdated;

      const profile = await getUserProfile(uid);
      if (profile) {
        if (data.userStatus !== profile.userStatus) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Status changed from ${data.userStatus} to ${profile.userStatus}.`);
        }
        const hasSameAcc = !!data.icf_acc === !!profile.icf_acc;
        const hasSamePcc = !!data.icf_pcc === !!profile.icf_pcc;
        const hasSameMcc = !!data.icf_mcc === !!profile.icf_mcc;
        const hasSameActc = !!data.icf_actc === !!profile.icf_actc;
        if (!hasSameAcc || !hasSamePcc || !hasSameMcc || !hasSameActc) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Credentials changed.`);
        }
      }

      if (!shouldRecalc && lastUpdated) {
        // lastUpdated might be a Timestamp
        const lastUpdatedMs = typeof lastUpdated.toDate === 'function' ? lastUpdated.toDate().getTime() : new Date(lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (ageMs > 24 * 60 * 60 * 1000) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} is older than 24 hours (${Math.round(ageMs / 3600000)}h).`);
        }
      } else if (!shouldRecalc) {
        shouldRecalc = true;
      }
    } else {
      shouldRecalc = true;
    }

    if (shouldRecalc) {
      await recalculateAvailableSlotsCache(uid);
    }
  } catch (err) {
    logger.error(`Error in lazyRecalculateAvailableSlotsCache for ${uid}:`, err);
  }
};

const doRecalculateAvailableSlotsCache = async (uid: string): Promise<void> => {
  if (!db) return;
  logger.debug(`Starting availability recalculation for user: ${uid}`);
  try {
    const [profile, schedule, existingCache] = await Promise.all([
      getUserProfile(uid),
      getSchedule(uid),
      getAvailability(uid),
    ]);

    if (!profile) return;

    const timezone = profile.timezone || 'UTC';
    const { availableDays, blockedDates } = schedule;

    const availableSlots = generateTemplateSlots({
      availableDays,
      blockedDates,
      timezone,
      anchorDate: new Date(),
      horizonDays: BOOKING_HORIZON_DAYS,
    });

    const horizonStart = new Date();
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setDate(horizonEnd.getDate() + BOOKING_HORIZON_DAYS + TIMEZONE_HORIZON_PADDING_DAYS);
    const busyIntervals = await getGoogleBusyIntervals(uid, horizonStart, horizonEnd);
    const { freeSlots } = computeFreeSlots(availableSlots, busyIntervals);

    const filterFields = {
      gender: profile.gender || '',
      country: profile.country || '',
      icf_acc: !!profile.icf_acc,
      icf_pcc: !!profile.icf_pcc,
      icf_mcc: !!profile.icf_mcc,
      icf_actc: !!profile.icf_actc,
      userStatus: profile.userStatus || USER_STATUS.INACTIVE,
    };

    const isDiscoverable = (profile.userRole === USER_ROLE.USER || profile.userRole === USER_ROLE.ADMIN) && isApproved(profile);
    const finalFreeSlots = isDiscoverable ? freeSlots : [];

    let skipWrites = false;
    let areFilterFieldsEqual = false;

    if (existingCache) {
      const existingSlots = existingCache.availableSlotsUtc || [];
      const slotsEqual = existingSlots.length === finalFreeSlots.length &&
        existingSlots.every((slot: string, idx: number) => slot === finalFreeSlots[idx]);

      areFilterFieldsEqual =
        existingCache.gender === filterFields.gender &&
        existingCache.country === filterFields.country &&
        existingCache.icf_acc === filterFields.icf_acc &&
        existingCache.icf_pcc === filterFields.icf_pcc &&
        existingCache.icf_mcc === filterFields.icf_mcc &&
        existingCache.icf_actc === filterFields.icf_actc &&
        existingCache.userStatus === filterFields.userStatus;

      if (slotsEqual && areFilterFieldsEqual) {
        skipWrites = true;
      }
    }

    if (skipWrites) {
      logger.info(`Successfully recalculated slots cache; already up-to-date for user: ${uid}`);
      return;
    }

    await syncAvailability(uid, {
      availableSlotsUtc: finalFreeSlots,
      filterFields,
      areFilterFieldsEqual,
    });

    logger.info(`Successfully recalculated availability cache for user: ${uid}`);
  } catch (err) {
    logger.error('Error recalculating availability cache:', err);
    try {
      await logger.telemetry('error', 'recalculation_failure', {
        userId: uid,
        errorCode: TelemetryErrors.RECALCULATION_FAILURE.code,
        errorMessage: TelemetryErrors.RECALCULATION_FAILURE.message,
        error: err instanceof Error ? err.message : String(err)
      });
    } catch (logErr) {
      logger.error('Failed to log recalculation failure:', logErr);
    }
    throw err;
  }
};

export const getUserAvailableSlots = async (uid: string): Promise<string[]> => {
  if (!db) return [];

  lazyRecalculateAvailableSlotsCache(uid);

  const cache = await getAvailability(uid);
  return cache ? (cache.availableSlotsUtc || []) : [];
};
