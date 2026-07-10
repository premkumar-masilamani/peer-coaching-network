import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOKING_HORIZON_DAYS,
  COLLECTIONS,
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
import { isApproved } from './profileHelpers';
import { getGoogleToken } from './googleToken';
import { generateTemplateSlots } from '../utils/slotGeneration';
import { logger } from '../utils/logger';
import { TelemetryErrors } from '../config/telemetryErrors';
import type { UserProfile } from './types';

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

  const personalAvailabilityCacheRef = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid);
  try {
    const snap = await getDoc(personalAvailabilityCacheRef);
    let shouldRecalc = false;

    if (snap.exists()) {
      const data = snap.data();
      const lastUpdated = data.lastUpdated;
      if (lastUpdated) {
        const lastUpdatedMs = new Date(lastUpdated).getTime();
        const ageMs = Date.now() - lastUpdatedMs;
        if (ageMs > 24 * 60 * 60 * 1000) {
          shouldRecalc = true;
          logger.info(`lazyRecalculateAvailableSlotsCache: Cache for ${uid} is older than 24 hours (${Math.round(ageMs / 3600000)}h).`);
        }
      } else {
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
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const personalAvailabilityCacheRef = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid);

    const [userDoc, schedule] = await Promise.all([
      getDoc(userDocRef),
      getSchedule(uid)
    ]);

    if (!userDoc.exists()) return;

    const profile = userDoc.data() as UserProfile;
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
    horizonEnd.setDate(horizonEnd.getDate() + BOOKING_HORIZON_DAYS + 1);
    const busyIntervals = await getGoogleBusyIntervals(uid, horizonStart, horizonEnd);
    // Deduplicate: overlapping template ranges on the same day (e.g. 9-12 and
    // 11-14) would otherwise emit the same hourly slot twice, inflating the
    // aggregate and pushing a day's shard past its 24-slot limit.
    const freeSlots = Array.from(new Set(subtractBusyIntervals(availableSlots, busyIntervals))).sort();

    const availableDatesUtc = Array.from(
      new Set(freeSlots.map(slotStr => slotStr.split('T')[0]))
    ).sort();

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

    // Aggregate cache: retained for the coach's own "My Sessions" / personal
    // availability view (a single-document read). We always write because
    // profile metadata may have changed even when the slots are unchanged.
    // If the coach is deactivated or not a coach, we empty their slots to prevent
    // cache leakage.
    await setDoc(personalAvailabilityCacheRef, {
      userId: uid,
      lastUpdated,
      availableSlots: finalFreeSlots,
      availableDatesUtc: finalAvailableDatesUtc,
      ...filterFields,
      userStatus: profile.userStatus || USER_STATUS.INACTIVE,
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

    const slotsByDate = new Map<string, string[]>();
    for (const iso of finalFreeSlots) {
      const dateISO = iso.split('T')[0];
      const list = slotsByDate.get(dateISO) || [];
      list.push(iso);
      slotsByDate.set(dateISO, list);
    }

    // Read existing shards so dates that lost all availability can be deleted.
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

  lazyRecalculateAvailableSlotsCache(uid).catch((err) => {
    logger.error(`Error triggering lazy check for ${uid}:`, err);
  });

  const ref = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().availableSlots || []) : [];
};
