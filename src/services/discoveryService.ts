import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
  documentId,
  or,
  and,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { COLLECTIONS, BOOKING_STATUS, COACH_DISCOVERY_LIMIT, USER_ROLE } from '../config';
import { db } from './firebaseApp';
import { isApproved } from './profileHelpers';
import { chunkArray } from '../utils/chunkArray';
import { seededShuffle } from '../utils/seededShuffle';
import { logger } from '../utils/logger';
import type { UserProfile, DiscoveryFilters } from './types';

export const subscribeToBookings = (callback: (bookings: DocumentData[]) => void): (() => void) => {
  if (!db) return () => {};
  const q = query(collection(db, COLLECTIONS.BOOKINGS), where('status', '==', BOOKING_STATUS.CONFIRMED));
  return onSnapshot(q, (querySnap) => {
    const list: DocumentData[] = [];
    querySnap.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (err) => {
    logger.error('Error in subscribeToBookings:', err);
  });
};

export const queryAvailableCoachesForDay = async (
  localDayStart: Date,
  localDayEnd: Date,
  slots: { startTime: Date; endTime: Date }[],
  filters: DiscoveryFilters,
  sessionSeed: string,
  currentUserUid?: string
): Promise<Record<string, UserProfile[]>> => {
  if (!db) return {};

  const uniqueUtcDates = Array.from(
    new Set(
      slots.map(s => s.startTime.toISOString().split('T')[0])
    )
  );
  if (uniqueUtcDates.length === 0) return {};

  // Read only the selected day's per-coach shards (1-2 UTC dates → within the
  // `in` limit of 30). Each shard is a small, coach-owned document, so no two
  // coaches share a document and we never read the whole booking horizon.
  const q = query(
    collection(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE),
    where('dateISO', 'in', uniqueUtcDates)
  );

  const cacheSnap = await getDocs(q);
  const cacheMap = new Map<string, string[]>();
  const rejected = new Set<string>();

  cacheSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const uid = data.coachUid;
    if (uid === currentUserUid || rejected.has(uid)) return;

    // A coach can have up to two shards (local day spanning two UTC dates);
    // union their freeSlots and run the faceted filter once per coach.
    const existing = cacheMap.get(uid);
    if (existing) {
      existing.push(...(data.freeSlots || []));
      return;
    }

    // In-memory faceted filtering to avoid Firestore combinatorial index explosion
    if (filters.gender && data.gender !== filters.gender) { rejected.add(uid); return; }
    if (filters.country && data.country !== filters.country) { rejected.add(uid); return; }

    const hasAnyRequestedCredential =
      (filters.icf_acc && data.icf_acc) ||
      (filters.icf_pcc && data.icf_pcc) ||
      (filters.icf_mcc && data.icf_mcc) ||
      (filters.icf_actc && data.icf_actc);

    // If any credential filter is selected, the user must have at least one of them
    const isCredentialFilterActive = filters.icf_acc || filters.icf_pcc || filters.icf_mcc || filters.icf_actc;
    if (isCredentialFilterActive && !hasAnyRequestedCredential) { rejected.add(uid); return; }

    cacheMap.set(uid, [...(data.freeSlots || [])]);
  });

  const candidateUids = Array.from(cacheMap.keys());
  if (candidateUids.length === 0) return {};

  const bookingsQuery = query(
    collection(db, COLLECTIONS.BOOKINGS),
    where('startTime', '>=', Timestamp.fromDate(localDayStart)),
    where('startTime', '<=', Timestamp.fromDate(localDayEnd)),
    where('status', '==', BOOKING_STATUS.CONFIRMED)
  );

  const bookingsSnap = await getDocs(bookingsQuery);
  const slotBusyUsers = new Map<string, Set<string>>();

  bookingsSnap.forEach((doc) => {
    const b = doc.data();
    const startStr = b.startTime && typeof b.startTime.toDate === 'function'
      ? b.startTime.toDate().toISOString()
      : (b.startTime?.dateTime || b.startTime);
    if (!startStr) return;

    if (!slotBusyUsers.has(startStr)) {
      slotBusyUsers.set(startStr, new Set<string>());
    }
    const busySet = slotBusyUsers.get(startStr)!;
    if (b.coachUid) busySet.add(b.coachUid);
    if (b.clientUid) busySet.add(b.clientUid);
  });

  const profileChunks = chunkArray(candidateUids, 30);
  const coachProfiles: UserProfile[] = [];

  const profileSnaps = await Promise.all(
    profileChunks.map(chunk =>
      getDocs(query(collection(db, COLLECTIONS.USERS), where(documentId(), 'in', chunk)))
    )
  );

  profileSnaps.forEach((snap) => {
    snap.forEach((docSnap) => {
      const profile = docSnap.data() as UserProfile;
       // Gate on the live, authoritative profile: only active coaches (role USER or ADMIN,
       // status active) are discoverable. Inactive/pending coaches with a stale
       // availability shard must never surface for booking.
       if ((profile.userRole === USER_ROLE.USER || profile.userRole === USER_ROLE.ADMIN) && isApproved(profile)) {
         coachProfiles.push(profile);
       }
    });
  });

  const coachMergedIntervals = new Map<string, { start: number; end: number }[]>();
  cacheMap.forEach((slotsList, uid) => {
    const slotDurationMs = 30 * 60 * 1000;
    const intervals = slotsList
      .map(s => {
        const start = new Date(s).getTime();
        return { start, end: start + slotDurationMs };
      })
      .sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    for (const interval of intervals) {
      if (merged.length === 0) {
        merged.push(interval);
      } else {
        const last = merged[merged.length - 1];
        if (interval.start <= last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          merged.push(interval);
        }
      }
    }
    coachMergedIntervals.set(uid, merged);
  });

  const result: Record<string, UserProfile[]> = {};

  slots.forEach((slot) => {
    const slotIso = slot.startTime.toISOString();
    const slotStartMs = slot.startTime.getTime();
    const slotEndMs = slot.endTime.getTime();
    const busySet = slotBusyUsers.get(slotIso) || new Set<string>();

    let availableCoaches = coachProfiles.filter((coach) => {
      const merged = coachMergedIntervals.get(coach.userId) || [];
      const isCovered = merged.some(
        interval => interval.start <= slotStartMs && slotEndMs <= interval.end
      );
      if (!isCovered) return false;
      if (busySet.has(coach.userId)) return false;
      return true;
    });

    availableCoaches = seededShuffle(availableCoaches, sessionSeed + slotIso);
    result[slotIso] = availableCoaches.slice(0, COACH_DISCOVERY_LIMIT);
  });

  return result;
};

export const subscribeToUserBookings = (uid: string, callback: (bookings: DocumentData[]) => void): (() => void) => {
  if (!db) return () => {};
  const q = query(
    collection(db, COLLECTIONS.BOOKINGS),
    and(
      where('status', '==', BOOKING_STATUS.CONFIRMED),
      or(
        where('clientUid', '==', uid),
        where('coachUid', '==', uid)
      )
    )
  );
  return onSnapshot(q, (querySnap) => {
    const list: DocumentData[] = [];
    querySnap.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (err) => {
    logger.error('Error in subscribeToUserBookings:', err);
  });
};
