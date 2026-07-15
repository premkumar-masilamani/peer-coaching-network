import {
  BOOKING_HORIZON_DAYS,
  USER_ROLE,
  USER_STATUS,
  ENABLE_GOOGLE_INTEGRATION,
  SLOT_DURATION_MS,
  GOOGLE_FREE_BUSY_URL,
} from '../config';
import { db, auth } from './firebaseApp';
// Lazy import cycle: scheduleService.updateSchedule triggers recalculation here,
// and recalculation reads the template via getSchedule. Safe because every
// cross-module reference below is inside a function body (call-time), never at
// module top level — keep it that way.
import { getSchedule } from './scheduleService';
import {
  getUserProfile,
  getPersonalAvailabilityCache,
  writePersonalAvailabilityCache,
  syncCoachAvailabilityShards,
  fetchBusySlotsByCoach,
} from './firestoreRepository';
import { isApproved } from './profileHelpers';
import { getGoogleToken } from './googleToken';
import { generateTemplateSlots } from '../utils/slotGeneration';
import { logger } from '../utils/logger';
import { TelemetryErrors } from '../config/telemetryErrors';

// Remove any 1-hr slot (identified by its ISO start) that overlaps a busy
// interval. Exported for testing. A slot [start, start+1h) is busy if any
// interval overlaps it (b.start < slotEnd && b.end > slotStart).
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

// Fetch the coach's Google Calendar busy intervals so genuinely-busy hours can be
// subtracted from their template availability. This is only possible on the
// coach's OWN authenticated session (their OAuth token). When recalc is triggered
// for a different user (e.g. an admin editing someone else's profile) we return
// an empty list and fall back to template-only availability. Exported for testing.
//
// KNOWN LIMITATION (all-day / OOO events): the freeBusy API reports all-day,
// out-of-office, and "tentative"-configured events as opaque busy intervals
// spanning a full 24h (or more), with no event metadata to distinguish them. As
// a result a single all-day "Holiday" event removes EVERY slot that day with no
// signal to the coach. freeBusy cannot be filtered by duration/transparency here
// because it returns only { start, end } — distinguishing these would require
// switching to the events endpoint and inspecting `transparency`/`eventType`.
// This is accepted for now; documented so the behavior is not mistaken for a bug.
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

// Padding (in days) added to the Google freeBusy query window beyond the booking
// horizon. Availability slots are built per LOCAL calendar day, while the busy
// window is expressed in UTC; for far-east timezones (up to UTC+14) a local
// day's late slots can fall past a UTC-aligned horizon end. One full day of
// padding (24h) comfortably covers the maximum ±14h UTC offset so no trailing
// slot escapes busy-subtraction.
const TIMEZONE_HORIZON_PADDING_DAYS = 1;

// Build the coach's genuinely-bookable slot list: expand the availability
// template over the horizon, subtract Google Calendar busy hours, then
// deduplicate (overlapping template ranges on the same day can emit the same
// hourly slot twice) and sort. Returns both the flat slot list and the distinct
// UTC dates it spans. Busy subtraction is only possible on the coach's own
// authenticated session; admin-triggered recalcs pass an empty busy list.
// Exported for testing.
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

// Serialize recalculations per-uid so concurrent triggers cannot interleave and
// clobber each other's writes (lost update). Errors propagate so callers may
// retry rather than silently dropping them.
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
    const data = await getPersonalAvailabilityCache(uid);
    let shouldRecalc = false;

    if (data) {
      const lastUpdated = data.lastUpdated;

      // Compare userStatus or credentials to propagate changes
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
        const lastUpdatedMs = new Date(lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (ageMs > 24 * 60 * 60 * 1000) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} is older than 24 hours (${Math.round(ageMs / 3600000)}h).`);
        }
      } else if (!shouldRecalc) {
        shouldRecalc = true;
        logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} has no lastUpdated timestamp.`);
      }
    } else {
      shouldRecalc = true;
      logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} does not exist.`);
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
  logger.debug(`Starting available slots cache recalculation for user: ${uid}`);
  try {
    const [profile, schedule, existingCache] = await Promise.all([
      getUserProfile(uid),
      getSchedule(uid),
      getPersonalAvailabilityCache(uid),
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

    // Subtract Google Calendar busy hours so the cache reflects genuinely
    // bookable time. Only possible on the coach's own authenticated session;
    // admin-triggered recalcs fall back to template-only availability.
    const horizonStart = new Date();
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setDate(horizonEnd.getDate() + BOOKING_HORIZON_DAYS + TIMEZONE_HORIZON_PADDING_DAYS);
    const busyIntervals = await getGoogleBusyIntervals(uid, horizonStart, horizonEnd);
    const { freeSlots, availableDatesUtc } = computeFreeSlots(availableSlots, busyIntervals);

    // Denormalized filter fields, shared by the aggregate cache and the per-day
    // discovery shards so discovery can facet in-memory without joining users/.
    // userStatus is intentionally NOT denormalized onto shards: discovery gates
    // on the live, authoritative users/ profile status (see isApproved below),
    // so a stale or spoofed shard status can never make a coach discoverable.
    const filterFields = {
      gender: profile.gender || '',
      country: profile.country || '',
      icf_acc: !!profile.icf_acc,
      icf_pcc: !!profile.icf_pcc,
      icf_mcc: !!profile.icf_mcc,
      icf_actc: !!profile.icf_actc,
    };
    const lastUpdated = new Date().toISOString();

    const isDiscoverable = (profile.userRole === USER_ROLE.USER || profile.userRole === USER_ROLE.ADMIN) && isApproved(profile);
    const finalFreeSlots = isDiscoverable ? freeSlots : [];
    const finalAvailableDatesUtc = isDiscoverable ? availableDatesUtc : [];

    const targetUserStatus = profile.userStatus || USER_STATUS.INACTIVE;

    // Compare with the existing cached document to detect structural changes.
    let skipShardWrites = false;
    const existingSlotsByDate = new Map<string, string[]>();
    let areFilterFieldsEqual = false;

    if (existingCache) {
      const existingSlots = existingCache.availableSlots || [];

      for (const iso of existingSlots) {
        const dateISO = iso.split('T')[0];
        const list = existingSlotsByDate.get(dateISO) || [];
        list.push(iso);
        existingSlotsByDate.set(dateISO, list);
      }

      // Check structural equality of the sorted slots arrays
      const slotsEqual = existingSlots.length === finalFreeSlots.length &&
        existingSlots.every((slot: string, idx: number) => slot === finalFreeSlots[idx]);

      // Check filter fields equality
      areFilterFieldsEqual =
        existingCache.gender === filterFields.gender &&
        existingCache.country === filterFields.country &&
        existingCache.icf_acc === filterFields.icf_acc &&
        existingCache.icf_pcc === filterFields.icf_pcc &&
        existingCache.icf_mcc === filterFields.icf_mcc &&
        existingCache.icf_actc === filterFields.icf_actc;

      // Check status equality to honor userStatus updates
      const statusEqual = existingCache.userStatus === targetUserStatus;

      if (slotsEqual && areFilterFieldsEqual && statusEqual) {
        skipShardWrites = true;
      }
    }

    // Aggregate cache: retained for the coach's own "My Sessions" / personal
    // availability view (a single-document read). We always write because
    // profile metadata may have changed even when the slots are unchanged.
    // If the coach is deactivated or not a coach, we empty their slots to prevent
    // cache leakage.
    await writePersonalAvailabilityCache(uid, {
      userId: uid,
      lastUpdated,
      availableSlots: finalFreeSlots,
      availableDatesUtc: finalAvailableDatesUtc,
      ...filterFields,
      userStatus: targetUserStatus,
    });

    // Per-day discovery shards: one owned document per coach per UTC date, so
    // discovery reads only the selected day and no two coaches share a document.
    //
    // Shards are owner-written only — Firestore rules pin the document ID to
    // "{ownUid}_{dateISO}" with no admin fallback, because an isAdmin() branch
    // would spend get() calls per document and exceed the 20-document-access
    // budget of a batched write. When an admin triggers a recalc for another
    // coach (profile/credential edits), we refresh the aggregate cache only; the
    // coach's shards are rebuilt on their next own recalc. Discovery gates on the
    // live users/ profile, so admin status changes apply without any shard write.
    if (auth?.currentUser?.uid !== uid) {
      logger.debug(`Skipping day-shard rebuild for ${uid}: not the coach's own session.`);
      logger.info(`Successfully recalculated aggregate availability cache for user: ${uid}`);
      return;
    }

    if (skipShardWrites) {
      logger.info(`Successfully recalculated slots cache; day shards are already up-to-date for user: ${uid}`);
      return;
    }

    const slotsByDate = new Map<string, string[]>();
    for (const iso of finalFreeSlots) {
      const dateISO = iso.split('T')[0];
      const list = slotsByDate.get(dateISO) || [];
      list.push(iso);
      slotsByDate.set(dateISO, list);
    }

    // Reconcile the coach's per-day shards in a single batch: write changed
    // shards and delete shards for dates that lost all availability.
    await syncCoachAvailabilityShards(uid, {
      slotsByDate,
      existingSlotsByDate,
      filterFields,
      areFilterFieldsEqual,
      lastUpdated,
    });

    logger.info(`Successfully recalculated available slots cache and day shards for user: ${uid}`);
  } catch (err) {
    logger.error('Error recalculating available slots cache:', err);
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

  const cache = await getPersonalAvailabilityCache(uid);
  return cache ? (cache.availableSlots || []) : [];
};

export const getCoachBusySlots = async (coachUid: string): Promise<{ startTime: Date; endTime: Date }[]> => {
  const busyDocs = await fetchBusySlotsByCoach(coachUid);
  return busyDocs.map(doc => {
    const startTime = doc.startTime && typeof doc.startTime.toDate === 'function'
      ? doc.startTime.toDate()
      : new Date(doc.startTime?.dateTime || doc.startTime);
    const endTime = doc.endTime && typeof doc.endTime.toDate === 'function'
      ? doc.endTime.toDate()
      : new Date(doc.endTime?.dateTime || doc.endTime);
    return { startTime, endTime };
  });
};
