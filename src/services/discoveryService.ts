import type { DocumentData } from 'firebase/firestore';
import { COACH_DISCOVERY_LIMIT, USER_ROLE } from '../config';
import { db } from './firebaseApp';
import {
  fetchCoachAvailabilityByDates,
  fetchBusySlotsInDayRange,
  fetchActiveUsersByIds,
  fetchConfirmedBookingsByParticipant,
} from './firestoreRepository';
import { isApproved } from './profileHelpers';
import { logger } from '../utils/logger';
import type { UserProfile, DiscoveryFilters } from './types';


export const queryAvailableCoachesForDay = async (
  localDayStart: Date,
  localDayEnd: Date,
  slots: { startTime: Date; endTime: Date }[],
  filters: DiscoveryFilters,
  _sessionSeed: string,
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
  const cacheDocs = await fetchCoachAvailabilityByDates(uniqueUtcDates);
  const cacheMap = new Map<string, string[]>();
  const rejected = new Set<string>();

  cacheDocs.forEach((data) => {
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

  // Public busy intervals for the day (coach-keyed) mark which coaches are taken.
  const busySlots = await fetchBusySlotsInDayRange(localDayStart, localDayEnd);
  const slotBusyUsers = new Map<string, Set<string>>();

  busySlots.forEach((b) => {
    const startStr = b.startTime && typeof b.startTime.toDate === 'function'
      ? b.startTime.toDate().toISOString()
      : (b.startTime?.dateTime || b.startTime);
    if (!startStr) return;

    if (!slotBusyUsers.has(startStr)) {
      slotBusyUsers.set(startStr, new Set<string>());
    }
    const busySet = slotBusyUsers.get(startStr)!;
    if (b.coachUid) busySet.add(b.coachUid);
  });

  // Calculate merged intervals in-memory
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

  // Identify available candidate UIDs for each slot (before fetching profiles)
  const slotAvailableUids = new Map<string, string[]>();
  slots.forEach((slot) => {
    const slotIso = slot.startTime.toISOString();
    const slotStartMs = slot.startTime.getTime();
    const slotEndMs = slot.endTime.getTime();
    const busySet = slotBusyUsers.get(slotIso) || new Set<string>();

    const available = candidateUids.filter((uid) => {
      const merged = coachMergedIntervals.get(uid) || [];
      const isCovered = merged.some(
        interval => interval.start <= slotStartMs && slotEndMs <= interval.end
      );
      if (!isCovered) return false;
      if (busySet.has(uid)) return false;
      return true;
    });
    slotAvailableUids.set(slotIso, available);
  });

  // Multi-pass lazy profile fetch loop
  const coachProfilesMap = new Map<string, UserProfile>();
  const slotFetchedOffset = new Map<string, number>(); // track progress through slotAvailableUids
  slots.forEach(s => slotFetchedOffset.set(s.startTime.toISOString(), 0));

  const slotsSatisfied = (): boolean => {
    return slots.every((slot) => {
      const slotIso = slot.startTime.toISOString();
      const available = slotAvailableUids.get(slotIso) || [];
      const offset = slotFetchedOffset.get(slotIso) || 0;

      const activeCount = available.slice(0, offset).filter(uid => coachProfilesMap.has(uid)).length;
      return activeCount >= COACH_DISCOVERY_LIMIT || offset >= available.length;
    });
  };

  while (!slotsSatisfied()) {
    const uidsToFetchThisPass = new Set<string>();

    slots.forEach((slot) => {
      const slotIso = slot.startTime.toISOString();
      const available = slotAvailableUids.get(slotIso) || [];
      const offset = slotFetchedOffset.get(slotIso) || 0;

      const activeCount = available.slice(0, offset).filter(uid => coachProfilesMap.has(uid)).length;
      const needed = COACH_DISCOVERY_LIMIT - activeCount;
      if (needed <= 0 || offset >= available.length) return;

      const nextSlice = available.slice(offset, offset + needed);
      nextSlice.forEach(uid => {
        if (!coachProfilesMap.has(uid)) {
          uidsToFetchThisPass.add(uid);
        }
      });
      slotFetchedOffset.set(slotIso, offset + needed);
    });

    const chunk = Array.from(uidsToFetchThisPass);
    if (chunk.length === 0) {
      break;
    }

    // Repository fetches only ACTIVE users (server-side); we still gate on the
    // live, authoritative profile below so stale shards can never surface a
    // pending/inactive coach for booking.
    const activeProfiles = await fetchActiveUsersByIds(chunk);
    activeProfiles.forEach((profile) => {
      if ((profile.userRole === USER_ROLE.USER || profile.userRole === USER_ROLE.ADMIN) && isApproved(profile)) {
        coachProfilesMap.set(profile.userId, profile);
      }
    });
  }

  // Build final results mapping slotIso -> active profiles (sliced to limit)
  const result: Record<string, UserProfile[]> = {};
  slots.forEach((slot) => {
    const slotIso = slot.startTime.toISOString();
    const available = slotAvailableUids.get(slotIso) || [];
    const activeProfiles: UserProfile[] = [];

    for (const uid of available) {
      if (activeProfiles.length >= COACH_DISCOVERY_LIMIT) break;
      const profile = coachProfilesMap.get(uid);
      if (profile) {
        activeProfiles.push(profile);
      }
    }
    result[slotIso] = activeProfiles;
  });

  return result;
};

export const getUserBookings = async (uid: string): Promise<DocumentData[]> => {
  if (!db) return [];
  try {
    return await fetchConfirmedBookingsByParticipant(uid);
  } catch (err) {
    logger.error('Error in getUserBookings:', err);
    return [];
  }
};
