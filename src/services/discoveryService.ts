import { 
  query, 
  collection, 
  where, 
  getDocs, 
  onSnapshot, 
  Timestamp, 
  documentId,
  type QuerySnapshot,
  type DocumentData
} from 'firebase/firestore';
import { db } from './firebaseApp';
import { 
  COLLECTIONS, 
  BOOKING_STATUS, 
  USER_ROLE, 
  COACH_DISCOVERY_LIMIT 
} from '../config';
import { type UserProfile, type DiscoveryFilters } from './types';
import { isApproved } from './profileService';
import { chunkArray } from '../utils/arrayUtils';
import { seededShuffle } from '../utils/seededShuffle';
import { logger } from '../utils/logger';
import { isCoachAvailableForSlot } from '../utils/timezoneHelpers';

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

    const existing = cacheMap.get(uid);
    if (existing) {
      existing.push(...(data.freeSlots || []));
      return;
    }

    if (filters.gender && data.gender !== filters.gender) { rejected.add(uid); return; }
    if (filters.country && data.country !== filters.country) { rejected.add(uid); return; }

    const hasAnyRequestedCredential =
      (filters.icf_acc && data.icf_acc) ||
      (filters.icf_pcc && data.icf_pcc) ||
      (filters.icf_mcc && data.icf_mcc) ||
      (filters.icf_actc && data.icf_actc);

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
       if (profile.userRole === USER_ROLE.USER && isApproved(profile)) {
         coachProfiles.push(profile);
       }
    });
  });

  const result: Record<string, UserProfile[]> = {};

  slots.forEach((slot) => {
    const slotIso = slot.startTime.toISOString();
    const busySet = slotBusyUsers.get(slotIso) || new Set<string>();

    let availableCoaches = coachProfiles.filter((coach) => {
      const coachSlots = cacheMap.get(coach.userId) || [];
      if (!isCoachAvailableForSlot(coachSlots, slotIso)) return false;
      if (busySet.has(coach.userId)) return false;
      return true;
    });

    availableCoaches = seededShuffle(availableCoaches, sessionSeed + slotIso);
    result[slotIso] = availableCoaches.slice(0, COACH_DISCOVERY_LIMIT);
  });

  return result;
};
