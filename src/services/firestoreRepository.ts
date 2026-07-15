// ─────────────────────────────────────────────────────────────────────────────
// Firestore repository — the ONLY module that talks to the database.
//
// Architecture (strictly enforced):
//
//     application (components) → service modules → firestoreRepository → Firestore
//
// Components never import `firebase/firestore` or this module directly; they call
// a service function. Service modules never call `firebase/firestore` operation
// primitives (`getDoc`/`getDocs`/`setDoc`/`updateDoc`/`deleteDoc`/`addDoc`/
// `runTransaction`/`writeBatch`/`query`/`where`/…); they call the repository
// functions below. This keeps every database interaction — reads, writes,
// deletes, transactions, batches, and query/index shapes — in one auditable
// place.
//
// What stays OUT of this module (lives in the calling service): business
// orchestration such as Google Calendar API calls, telemetry, rollback
// sequencing, availability math, and gating rules. Inspecting `Timestamp` values
// on returned documents (`data.startTime.toDate()`) is allowed in services —
// that is reading a value type, not performing a database operation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  or,
  and,
  documentId,
  limit,
  startAfter,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type {
  Query,
  DocumentData,
  DocumentReference,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  BOOKING_STATUS,
  BOOKING_ERROR,
  SUPPORT_STATUS,
  USER_STATUS,
  type UserStatus,
  type LogSeverity,
} from '../config';
import { db, auth } from './firebaseApp';
import { chunkArray } from '../utils/chunkArray';
import { logger } from '../utils/logger';
import type { UserProfile, AvailableDays } from './types';

// The `in` operator (and documentId `in`) accepts at most 30 values per query.
const FIRESTORE_IN_LIMIT = 30;

/** A raw document read result: its id plus its data. Callers map to domain types. */
export interface RawDoc {
  id: string;
  data: DocumentData;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ SECTION 1 — Query builders (private).                                       ║
// ║                                                                             ║
// ║ Pure functions returning a `Query`, private to this module so the query     ║
// ║ surface can be audited against firestore.indexes.json in one place. Each    ║
// ║ notes whether it drives a composite index.                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// users — full collection (admin roster). No index.
const allUsersCollection = () => collection(db, COLLECTIONS.USERS);
// users — `userStatus == x`. Single equality; no composite index.
const usersByStatusQuery = (status: UserStatus): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.USERS), where('userStatus', '==', status));
// users — page window ordered by document id (always present, so no document is
// excluded; single-field index, no composite index required). The document id
// gives a stable total order for `startAfter` cursor pagination.
const usersPageQuery = (
  pageCursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number
): Query<DocumentData> => {
  const constraints: QueryConstraint[] = [orderBy(documentId())];
  if (pageCursor) constraints.push(startAfter(pageCursor));
  constraints.push(limit(pageSize));
  return query(collection(db, COLLECTIONS.USERS), ...constraints);
};
// users — `documentId() in [...]`. Single `in`; no composite index.
const usersByIdsQuery = (userIds: string[]): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.USERS), where(documentId(), 'in', userIds));
// users — `documentId() in [...] AND userStatus == active`. Equality-only; no
// composite index.
const activeUsersByIdsQuery = (userIds: string[]): Query<DocumentData> =>
  query(
    collection(db, COLLECTIONS.USERS),
    where(documentId(), 'in', userIds),
    where('userStatus', '==', USER_STATUS.ACTIVE)
  );

// bookings — `clientUid == x`. Single equality; no composite index.
const bookingsByClientQuery = (clientUid: string): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.BOOKINGS), where('clientUid', '==', clientUid));
// bookings — `coachUid == x`. Single equality; no composite index.
const bookingsByCoachQuery = (coachUid: string): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.BOOKINGS), where('coachUid', '==', coachUid));
// bookings — `clientUid == x AND endTime >= now`.
// Requires composite index bookings (clientUid ASC, endTime ASC).
const upcomingBookingsByClientQuery = (clientUid: string): Query<DocumentData> =>
  query(
    collection(db, COLLECTIONS.BOOKINGS),
    where('clientUid', '==', clientUid),
    where('endTime', '>=', Timestamp.now())
  );
// bookings — `coachUid == x AND endTime >= now`.
// Requires composite index bookings (coachUid ASC, endTime ASC).
const upcomingBookingsByCoachQuery = (coachUid: string): Query<DocumentData> =>
  query(
    collection(db, COLLECTIONS.BOOKINGS),
    where('coachUid', '==', coachUid),
    where('endTime', '>=', Timestamp.now())
  );
// bookings — `status == CONFIRMED AND (clientUid == x OR coachUid == x)`.
// Equality-only and/or; no composite index.
const confirmedBookingsByParticipantQuery = (uid: string): Query<DocumentData> =>
  query(
    collection(db, COLLECTIONS.BOOKINGS),
    and(
      where('status', '==', BOOKING_STATUS.CONFIRMED),
      or(where('clientUid', '==', uid), where('coachUid', '==', uid))
    )
  );

// busySlots — `startTime >= a AND startTime <= b` (single-field range; no
// composite index). Public busy intervals used by coach discovery.
const busySlotsInStartTimeRangeQuery = (dayStart: Date, dayEnd: Date): Query<DocumentData> =>
  query(
    collection(db, COLLECTIONS.BUSY_SLOTS),
    where('startTime', '>=', Timestamp.fromDate(dayStart)),
    where('startTime', '<=', Timestamp.fromDate(dayEnd))
  );

// coachAvailabilityByDate — `coachUid == x`. Single equality; no composite index.
const coachAvailabilityByCoachQuery = (coachUid: string): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE), where('coachUid', '==', coachUid));
// coachAvailabilityByDate — `dateISO in [...]`. Single `in`; no composite index.
const coachAvailabilityByDatesQuery = (dateISOs: string[]): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE), where('dateISO', 'in', dateISOs));

// personalAvailabilityCache — `documentId() in [...]`. Single `in`; no composite index.
const personalAvailabilityCacheByIdsQuery = (coachIds: string[]): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE), where(documentId(), 'in', coachIds));

// supportRequests — `userId == x`. Single equality; no composite index. (Callers
// sort by updatedAt in memory.)
const supportRequestsByUserQuery = (userId: string): Query<DocumentData> =>
  query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), where('userId', '==', userId));
// supportRequests/{id}/messages — `orderBy(createdAt asc)`. Single-field orderBy; no composite index.
const supportMessagesQuery = (requestId: string): Query<DocumentData> =>
  query(
    collection(db, COLLECTIONS.SUPPORT_REQUESTS, requestId, COLLECTIONS.SUPPORT_MESSAGES),
    orderBy('createdAt', 'asc')
  );

// systemLogs — `orderBy(timestamp desc)` [+ `type ==` / `type in`] + page window.
// When a `type` filter is present this requires composite index
// systemLogs (type ASC, timestamp DESC).
const systemLogsQuery = (
  severities: LogSeverity[],
  pageCursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number
): Query<DocumentData> => {
  const constraints: QueryConstraint[] = [orderBy('timestamp', 'desc')];
  if (severities.length === 1) {
    constraints.push(where('type', '==', severities[0])); // exact match for a single value
  } else if (severities.length === 2) {
    constraints.push(where('type', 'in', severities)); // `in` supports up to 30 values
  }
  // 0 or 3 selected → show all (no `type` filter).
  if (pageCursor) constraints.push(startAfter(pageCursor));
  constraints.push(limit(pageSize));
  return query(collection(db, COLLECTIONS.SYSTEM_LOGS), ...constraints);
};

// Materialize a QuerySnapshot into a plain array of document data. Real Firestore
// snapshots expose `.docs`; we fall back to `.forEach` for leaner test doubles.
const collectDocs = (snap: {
  docs?: { data: () => DocumentData }[];
  forEach?: (cb: (d: { data: () => DocumentData }) => void) => void;
}): DocumentData[] => {
  if (Array.isArray(snap.docs)) return snap.docs.map((d) => d.data());
  const list: DocumentData[] = [];
  snap.forEach?.((d) => list.push(d.data()));
  return list;
};

// Materialize a QuerySnapshot into { id, data } pairs.
const collectRawDocs = (snap: {
  docs?: { id: string; data: () => DocumentData }[];
  forEach?: (cb: (d: { id: string; data: () => DocumentData }) => void) => void;
}): RawDoc[] => {
  if (Array.isArray(snap.docs)) return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const list: RawDoc[] = [];
  snap.forEach?.((d) => list.push({ id: d.id, data: d.data() }));
  return list;
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ SECTION 2 — Executors (public API), grouped by collection.                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ── users ─────────────────────────────────────────────────────────────────────

/** Read a single user profile document, or null if it does not exist. */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

/** Create a new user profile, stamping the server-side creation time. */
export const createUserProfile = async (
  uid: string,
  profile: Omit<UserProfile, 'createdAt'>
): Promise<void> => {
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    ...profile,
    createdAt: serverTimestamp(),
  } as DocumentData);
};

/** Patch fields on an existing user profile. */
export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile> | DocumentData
): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), updates as DocumentData);
};

/** Read every user document (admin roster). */
export const fetchAllUsers = async (): Promise<UserProfile[]> => {
  const snap = await getDocs(allUsersCollection());
  const users: UserProfile[] = [];
  snap.forEach((d) => users.push(d.data() as UserProfile));
  return users;
};

/**
 * Read one page of user documents (admin roster), ordered by document id.
 * Requests one extra row internally to report whether a further page exists and
 * returns an opaque `nextCursor` to pass back for the following page. Bounds the
 * first-paint read instead of downloading the entire users collection.
 */
export const fetchUsersPage = async (options: {
  pageCursor?: unknown;
  pageSize: number;
}): Promise<{ users: UserProfile[]; nextCursor: unknown | null; hasMore: boolean }> => {
  const { pageCursor, pageSize } = options;
  const snapshot = await getDocs(
    usersPageQuery((pageCursor as QueryDocumentSnapshot<DocumentData>) ?? null, pageSize + 1)
  );
  const rows: { user: UserProfile; snap: QueryDocumentSnapshot<DocumentData> }[] = [];
  snapshot.forEach((docSnap) => {
    rows.push({ user: docSnap.data() as UserProfile, snap: docSnap });
  });
  const hasMore = rows.length > pageSize;
  if (hasMore) rows.pop(); // drop the extra look-ahead row
  const nextCursor = hasMore ? rows[rows.length - 1].snap : null;
  return { users: rows.map((r) => r.user), nextCursor, hasMore };
};

/** Read all users with the given status (e.g. ACTIVE coaches). */
export const fetchUsersByStatus = async (status: UserStatus): Promise<UserProfile[]> => {
  const snap = await getDocs(usersByStatusQuery(status));
  const users: UserProfile[] = [];
  snap.forEach((d) => users.push(d.data() as UserProfile));
  return users;
};

/** Count users with the given status without transferring the whole collection. */
export const countUsersByStatus = async (status: UserStatus): Promise<number> => {
  const snap = await getDocs(usersByStatusQuery(status));
  return snap.size;
};

/**
 * Read user profiles for a batch of UIDs. Chunks internally to respect the
 * Firestore 30-value `in` limit and runs the chunks in parallel.
 */
export const fetchUsersByIds = async (uids: string[]): Promise<UserProfile[]> => {
  if (uids.length === 0) return [];
  const chunks = chunkArray(uids, FIRESTORE_IN_LIMIT);
  const profiles: UserProfile[] = [];
  const snaps = await Promise.all(chunks.map((c) => getDocs(usersByIdsQuery(c))));
  snaps.forEach((snap) => snap.forEach((d) => profiles.push(d.data() as UserProfile)));
  return profiles;
};

/**
 * Read ACTIVE user profiles for a batch of UIDs (`documentId in […] AND
 * userStatus == active`). Chunks internally to respect the 30-value `in` limit.
 */
export const fetchActiveUsersByIds = async (uids: string[]): Promise<UserProfile[]> => {
  if (uids.length === 0) return [];
  const chunks = chunkArray(uids, FIRESTORE_IN_LIMIT);
  const profiles: UserProfile[] = [];
  const snaps = await Promise.all(chunks.map((c) => getDocs(activeUsersByIdsQuery(c))));
  snaps.forEach((snap) => snap.forEach((d) => profiles.push(d.data() as UserProfile)));
  return profiles;
};

// ── schedule (users/{uid}/schedule/{availableDays|blockedDates}) ──────────────

/**
 * Read a coach's raw availability template and blocked dates. Returns null for
 * missing documents; the caller applies domain defaults.
 */
export const fetchScheduleRaw = async (
  uid: string
): Promise<{ availableDays: AvailableDays | null; blockedDates: string[] | null }> => {
  const availableDaysRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
  const blockedDatesRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
  const [daysSnap, datesSnap] = await Promise.all([getDoc(availableDaysRef), getDoc(blockedDatesRef)]);
  return {
    availableDays: daysSnap.exists() ? (daysSnap.data() as AvailableDays) : null,
    blockedDates: datesSnap.exists() ? (datesSnap.data().blockedDates as string[]) : null,
  };
};

/** Persist a coach's availability template and blocked dates. */
export const writeSchedule = async (
  uid: string,
  availableDays: AvailableDays,
  blockedDates: string[]
): Promise<void> => {
  const availableDaysRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.SCHEDULE, COLLECTIONS.AVAILABLE_DAYS);
  const blockedDatesRef = doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.SCHEDULE, COLLECTIONS.BLOCKED_DATES);
  await Promise.all([
    setDoc(availableDaysRef, availableDays),
    setDoc(blockedDatesRef, { blockedDates }),
  ]);
};

// ── bookings + busySlots ──────────────────────────────────────────────────────

/** Read a single booking document, or null if it does not exist. */
export const getBooking = async (bookingId: string): Promise<DocumentData | null> => {
  const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId));
  return snap.exists() ? snap.data() : null;
};

/** All bookings where the user is the client (no time bound). */
export const fetchBookingsByClient = async (clientUid: string): Promise<DocumentData[]> =>
  collectDocs(await getDocs(bookingsByClientQuery(clientUid)));

/** All bookings where the user is the coach (no time bound). */
export const fetchBookingsByCoach = async (coachUid: string): Promise<DocumentData[]> =>
  collectDocs(await getDocs(bookingsByCoachQuery(coachUid)));

/** Upcoming (endTime >= now) bookings where the user is the client. */
export const fetchUpcomingBookingsByClient = async (clientUid: string): Promise<DocumentData[]> =>
  collectDocs(await getDocs(upcomingBookingsByClientQuery(clientUid)));

/** Upcoming (endTime >= now) bookings where the user is the coach. */
export const fetchUpcomingBookingsByCoach = async (coachUid: string): Promise<DocumentData[]> =>
  collectDocs(await getDocs(upcomingBookingsByCoachQuery(coachUid)));

/** The user's CONFIRMED bookings in either role (client or coach). */
export const fetchConfirmedBookingsByParticipant = async (uid: string): Promise<DocumentData[]> =>
  collectDocs(await getDocs(confirmedBookingsByParticipantQuery(uid)));

/** Public busy-slot documents whose start time falls in the given day window. */
export const fetchBusySlotsInDayRange = async (
  dayStart: Date,
  dayEnd: Date
): Promise<DocumentData[]> => collectDocs(await getDocs(busySlotsInStartTimeRangeQuery(dayStart, dayEnd)));

/** Persist a self-healed Google Meet link onto a booking. */
export const setBookingGoogleMeetLink = async (bookingId: string, googleMeetLink: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), { googleMeetLink });
};

// Booking lifecycle (transaction + confirm/rollback/cancel). These own all
// Firestore reference and Timestamp construction; the calling service passes
// only primitives (ids and ISO strings). Coach/client-as-coach conflicts are
// tracked in the public `busySlots` collection; client/coach-as-client locks in
// `clientBookingCache`.

const SLOT_HALF_MS = 30 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const CONFIRMED_TTL_MS = 24 * 60 * 60 * 1000;
const RESERVE_MAX_ATTEMPTS = 3;

interface BookingSlotParams {
  bookingId: string;
  coachUid: string;
  clientUid: string;
  startIso: string;
  endIso: string;
  topic: string;
}

/**
 * Atomically claim a booking slot (and its adjacent-30-minute guards) for both
 * the coach and the client via a Firestore transaction, writing the PENDING
 * booking, its public busy-slot doc, and the client-side booking-cache locks.
 * Throws a BOOKING_ERROR.* message when the slot conflicts; retries transient
 * failures.
 */
export const reserveBookingSlots = async (params: BookingSlotParams): Promise<void> => {
  const { bookingId, coachUid, clientUid, startIso, endIso, topic } = params;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const isOneHour = endMs - startMs > SLOT_HALF_MS;

  const t0 = startIso;
  const tMinus30 = new Date(startMs - SLOT_HALF_MS).toISOString();
  const tPlus30 = new Date(startMs + SLOT_HALF_MS).toISOString();

  const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
  const busySlotRef = doc(db, COLLECTIONS.BUSY_SLOTS, bookingId);
  const coachAtT0Ref = doc(db, COLLECTIONS.BUSY_SLOTS, `${coachUid}_${t0}`);
  const coachAtTMinus30Ref = doc(db, COLLECTIONS.BUSY_SLOTS, `${coachUid}_${tMinus30}`);
  const coachAtTPlus30Ref = doc(db, COLLECTIONS.BUSY_SLOTS, `${coachUid}_${tPlus30}`);
  const clientAsCoachAtT0Ref = doc(db, COLLECTIONS.BUSY_SLOTS, `${clientUid}_${t0}`);
  const clientAsCoachAtTMinus30Ref = doc(db, COLLECTIONS.BUSY_SLOTS, `${clientUid}_${tMinus30}`);
  const clientAsCoachAtTPlus30Ref = doc(db, COLLECTIONS.BUSY_SLOTS, `${clientUid}_${tPlus30}`);
  const clientBookingCacheAtT0Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${t0}`);
  const clientBookingCacheAtTPlus30Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${tPlus30}`);
  const coachAsClientAtT0Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${coachUid}_${t0}`);
  const coachAsClientAtTPlus30Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${coachUid}_${tPlus30}`);

  const pendingExpireDate = new Date(Date.now() + PENDING_TTL_MS);
  const bookingData = {
    bookingId,
    googleEventId: '',
    googleMeetLink: '',
    status: BOOKING_STATUS.PENDING,
    startTime: Timestamp.fromDate(new Date(startIso)),
    endTime: Timestamp.fromDate(new Date(endIso)),
    // startIso mirrors the slot's ISO instant as a plain string. Security rules
    // (PCN-038) use it to pin the booking to bookingId and to the coach's
    // published availability shard; see coachPublishedSlot() in firestore.rules.
    startIso,
    topic,
    coachUid,
    clientUid,
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromDate(pendingExpireDate),
  };

  const isBookingActive = (docSnap: DocumentSnapshot) => {
    if (!docSnap.exists()) return false;
    const data = typeof docSnap.data === 'function' ? docSnap.data() : undefined;
    if (!data) return true;
    if (data.status === BOOKING_STATUS.CANCELLED) return false;
    if (data.status === BOOKING_STATUS.PENDING && data.expireAt) {
      const expireAt = data.expireAt?.toDate ? data.expireAt.toDate() : new Date(data.expireAt);
      if (expireAt < new Date()) return false;
    }
    return true;
  };

  const isCacheActive = (docSnap: DocumentSnapshot) => {
    if (!docSnap.exists()) return false;
    const data = typeof docSnap.data === 'function' ? docSnap.data() : undefined;
    if (!data) return true;
    if (data.expireAt) {
      const expireAt = data.expireAt?.toDate ? data.expireAt.toDate() : new Date(data.expireAt);
      if (expireAt < new Date()) return false;
    }
    return true;
  };

  const isOneHourBooking = (docSnap: DocumentSnapshot) => {
    if (!isBookingActive(docSnap)) return false;
    const data = docSnap.data();
    if (!data) return false;
    const start = data.startTime.toDate().getTime();
    const end = data.endTime.toDate().getTime();
    return end - start > SLOT_HALF_MS;
  };

  let transactionSuccess = false;
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < RESERVE_MAX_ATTEMPTS && !transactionSuccess) {
    attempts++;
    try {
      await runTransaction(db, async (tx) => {
        const [
          coachAtT0,
          coachAtTMinus30,
          coachAtTPlus30,
          clientAsCoachAtT0,
          clientAsCoachAtTMinus30,
          clientAsCoachAtTPlus30,
          clientBookingCacheAtT0,
          clientBookingCacheAtTPlus30,
          coachAsClientAtT0,
          coachAsClientAtTPlus30,
        ] = await Promise.all([
          tx.get(coachAtT0Ref),
          tx.get(coachAtTMinus30Ref),
          tx.get(coachAtTPlus30Ref),
          tx.get(clientAsCoachAtT0Ref),
          tx.get(clientAsCoachAtTMinus30Ref),
          tx.get(clientAsCoachAtTPlus30Ref),
          tx.get(clientBookingCacheAtT0Ref),
          tx.get(clientBookingCacheAtTPlus30Ref),
          tx.get(coachAsClientAtT0Ref),
          tx.get(coachAsClientAtTPlus30Ref),
        ]);

        // 1. Coach availability checks
        if (isBookingActive(coachAtT0)) throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        if (isOneHourBooking(coachAtTMinus30)) throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        if (isOneHour && isBookingActive(coachAtTPlus30)) throw new Error(BOOKING_ERROR.SLOT_TAKEN);

        // 2. Coach-as-client checks
        if (isCacheActive(coachAsClientAtT0)) throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        if (isOneHour && isCacheActive(coachAsClientAtTPlus30)) throw new Error(BOOKING_ERROR.SLOT_TAKEN);

        // 3. Client-as-client checks
        if (isCacheActive(clientBookingCacheAtT0)) throw new Error(BOOKING_ERROR.BOOKED_AS_CLIENT);
        if (isOneHour && isCacheActive(clientBookingCacheAtTPlus30)) throw new Error(BOOKING_ERROR.BOOKED_AS_CLIENT);

        // 4. Client-as-coach checks
        if (isBookingActive(clientAsCoachAtT0)) throw new Error(BOOKING_ERROR.BOOKED_AS_COACH);
        if (isOneHourBooking(clientAsCoachAtTMinus30)) throw new Error(BOOKING_ERROR.BOOKED_AS_COACH);
        if (isOneHour && isBookingActive(clientAsCoachAtTPlus30)) throw new Error(BOOKING_ERROR.BOOKED_AS_COACH);

        tx.set(bookingRef, bookingData);
        tx.set(busySlotRef, {
          startTime: Timestamp.fromDate(new Date(startIso)),
          endTime: Timestamp.fromDate(new Date(endIso)),
          coachUid,
          status: BOOKING_STATUS.PENDING,
          expireAt: Timestamp.fromDate(pendingExpireDate),
        });
        tx.set(clientBookingCacheAtT0Ref, {
          clientUid,
          coachUid,
          bookingId,
          startIso: t0,
          createdAt: serverTimestamp(),
          expireAt: Timestamp.fromDate(pendingExpireDate),
        });
        if (isOneHour) {
          tx.set(clientBookingCacheAtTPlus30Ref, {
            clientUid,
            coachUid,
            bookingId,
            startIso: tPlus30,
            createdAt: serverTimestamp(),
            expireAt: Timestamp.fromDate(pendingExpireDate),
          });
        }
      });
      transactionSuccess = true;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (
        err instanceof Error &&
        (err.message === BOOKING_ERROR.SLOT_TAKEN ||
          err.message === BOOKING_ERROR.BOOKED_AS_CLIENT ||
          err.message === BOOKING_ERROR.BOOKED_AS_COACH)
      ) {
        break;
      }
      logger.warn(`Firestore transaction attempt ${attempts} failed:`, err);
      if (attempts < RESERVE_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
      }
    }
  }

  if (!transactionSuccess) {
    throw lastError || new Error('FAILED_TO_PERSIST');
  }
};

interface BookingConfirmParams {
  bookingId: string;
  clientUid: string;
  startIso: string;
  endIso: string;
  googleEventId: string;
  googleMeetLink: string;
}

/**
 * Mark a reserved booking CONFIRMED, confirm its busy-slot doc, and extend the
 * client-cache lock TTLs.
 */
export const confirmBooking = async (params: BookingConfirmParams): Promise<void> => {
  const { bookingId, clientUid, startIso, endIso, googleEventId, googleMeetLink } = params;
  const startMs = new Date(startIso).getTime();
  const isOneHour = new Date(endIso).getTime() - startMs > SLOT_HALF_MS;
  const finalExpireDate = new Date(startMs + CONFIRMED_TTL_MS);
  const tPlus30 = new Date(startMs + SLOT_HALF_MS).toISOString();

  await Promise.all([
    updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), {
      googleEventId,
      googleMeetLink,
      status: BOOKING_STATUS.CONFIRMED,
      expireAt: null,
    }),
    updateDoc(doc(db, COLLECTIONS.BUSY_SLOTS, bookingId), {
      status: BOOKING_STATUS.CONFIRMED,
      expireAt: null,
    }),
    updateDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${startIso}`), {
      expireAt: Timestamp.fromDate(finalExpireDate),
    }),
    ...(isOneHour
      ? [
          updateDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${tPlus30}`), {
            expireAt: Timestamp.fromDate(finalExpireDate),
          }),
        ]
      : []),
  ]);
};

interface BookingRollbackParams {
  bookingId: string;
  clientUid: string;
  startIso: string;
  endIso: string;
}

/**
 * Cancel a reserved booking, release its client-cache locks, and delete its
 * busy-slot doc (rollback path). Best-effort cleanup — lock/busy-slot deletion
 * errors are swallowed and logged.
 */
export const rollbackBooking = async (params: BookingRollbackParams): Promise<void> => {
  const { bookingId, clientUid, startIso, endIso } = params;
  const isOneHour = new Date(endIso).getTime() - new Date(startIso).getTime() > SLOT_HALF_MS;
  await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), { status: BOOKING_STATUS.CANCELLED });
  try {
    const tPlus30 = new Date(new Date(startIso).getTime() + SLOT_HALF_MS).toISOString();
    await Promise.all([
      deleteDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${startIso}`)),
      ...(isOneHour ? [deleteDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${tPlus30}`))] : []),
      deleteDoc(doc(db, COLLECTIONS.BUSY_SLOTS, bookingId)),
    ]);
  } catch (e) {
    logger.error('Error deleting locks or busy slot on rollback:', e);
  }
};

/** Mark a booking CANCELLED (user-initiated cancellation). */
export const cancelBookingDoc = async (bookingId: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), {
    status: BOOKING_STATUS.CANCELLED,
    cancelledAt: serverTimestamp(),
  });
};

/** Delete a booking's public busy-slot document. */
export const deleteBusySlot = async (bookingId: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.BUSY_SLOTS, bookingId));
};

/** Delete a single client-booking-cache lock document. */
export const deleteClientBookingLock = async (clientUid: string, startIso: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${startIso}`));
};

// ── coachAvailabilityByDate (per-coach, per-day discovery shards) ─────────────

/**
 * Availability shards for a set of UTC dates (coach discovery).
 *
 * Uses a single `dateISO in [...]` query, so the caller must pass at most
 * FIRESTORE_IN_LIMIT (30) dates. Today's per-day discovery caller passes ≤ 2
 * (a local day spans at most two UTC dates), so this is comfortably within
 * bounds — but the coupling was previously undocumented and a future multi-day
 * caller would otherwise hit the `in` limit at runtime. We guard explicitly
 * rather than silently truncate; a caller needing more dates should chunk via
 * chunkArray(dateISOs, FIRESTORE_IN_LIMIT) and merge, as the uid queries do.
 */
export const fetchCoachAvailabilityByDates = async (dateISOs: string[]): Promise<DocumentData[]> => {
  if (dateISOs.length > FIRESTORE_IN_LIMIT) {
    throw new Error(
      `fetchCoachAvailabilityByDates received ${dateISOs.length} dates, exceeding the Firestore ` +
      `'in' limit of ${FIRESTORE_IN_LIMIT}. Chunk the dates and merge the results.`
    );
  }
  return collectDocs(await getDocs(coachAvailabilityByDatesQuery(dateISOs)));
};

interface ShardSyncParams {
  slotsByDate: Map<string, string[]>;
  existingSlotsByDate: Map<string, string[]>;
  filterFields: DocumentData;
  areFilterFieldsEqual: boolean;
  lastUpdated: string;
}

/**
 * Reconcile a coach's per-day availability shards in one batch: write a shard for
 * each date whose slots (or denormalized filter fields) changed, and delete
 * shards for dates that lost all availability. The existing-shards read is only
 * performed when there are stale dates to delete, and the batch is committed only
 * when it has operations.
 */
export const syncCoachAvailabilityShards = async (
  coachUid: string,
  params: ShardSyncParams
): Promise<void> => {
  const { slotsByDate, existingSlotsByDate, filterFields, areFilterFieldsEqual, lastUpdated } = params;

  const oldDates = Array.from(existingSlotsByDate.keys());
  const hasStaleDates = oldDates.some((d) => !slotsByDate.has(d));

  const existingShards: { dateISO: string; ref: DocumentReference }[] = [];
  if (hasStaleDates) {
    const existingShardsSnap = await getDocs(coachAvailabilityByCoachQuery(coachUid));
    existingShardsSnap.forEach((shardDoc) => {
      existingShards.push({ dateISO: shardDoc.data().dateISO, ref: shardDoc.ref });
    });
  }

  const batch = writeBatch(db);
  let batchOpsCount = 0;

  for (const [dateISO, slots] of slotsByDate) {
    const existingSlots = existingSlotsByDate.get(dateISO);
    const slotsEqual =
      existingSlots &&
      existingSlots.length === slots.length &&
      existingSlots.every((val, index) => val === slots[index]);

    if (!slotsEqual || !areFilterFieldsEqual) {
      const shardRef = doc(db, COLLECTIONS.COACH_AVAILABILITY_BY_DATE, `${coachUid}_${dateISO}`);
      batch.set(shardRef, { coachUid, dateISO, freeSlots: slots, lastUpdated, ...filterFields });
      batchOpsCount++;
    }
  }

  if (hasStaleDates) {
    existingShards.forEach((shard) => {
      if (!slotsByDate.has(shard.dateISO)) {
        batch.delete(shard.ref);
        batchOpsCount++;
      }
    });
  }

  if (batchOpsCount > 0) {
    await batch.commit();
  }
};

// ── personalAvailabilityCache (per-coach aggregate availability) ──────────────

/** Read a coach's aggregate availability-cache document, or null if absent. */
export const getPersonalAvailabilityCache = async (uid: string): Promise<DocumentData | null> => {
  const snap = await getDoc(doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid));
  return snap.exists() ? snap.data() : null;
};

/** Write a coach's aggregate availability-cache document. */
export const writePersonalAvailabilityCache = async (uid: string, data: DocumentData): Promise<void> => {
  await setDoc(doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, uid), data);
};

/**
 * Read aggregate availability-cache documents for a single chunk of coach UIDs
 * (<= 30). Returns a map of uid → cache data. Callers chunk and handle per-chunk
 * failures (so a partial outage still yields the chunks that succeeded).
 */
export const fetchPersonalAvailabilityCacheChunk = async (
  coachIds: string[]
): Promise<Map<string, DocumentData>> => {
  const result = new Map<string, DocumentData>();
  const snap = await getDocs(personalAvailabilityCacheByIdsQuery(coachIds));
  snap.forEach((d) => result.set(d.id, d.data()));
  return result;
};

// ── supportRequests (+ messages subcollection) ────────────────────────────────

/**
 * Create a support request and its first message atomically. `createdAt`/
 * `updatedAt` use server timestamps. Returns the new request id.
 */
export const createSupportRequestWithFirstMessage = async (request: {
  userId: string;
  userDisplayName: string;
  userEmail: string;
  category: string;
  subject: string;
  senderRole: string;
  content: string;
}): Promise<string> => {
  const requestRef = doc(collection(db, COLLECTIONS.SUPPORT_REQUESTS));
  const messagesRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS, requestRef.id, COLLECTIONS.SUPPORT_MESSAGES);
  const messageRef = doc(messagesRef);

  const batch = writeBatch(db);
  batch.set(requestRef, {
    id: requestRef.id,
    userId: request.userId,
    userDisplayName: request.userDisplayName,
    userEmail: request.userEmail,
    category: request.category,
    subject: request.subject,
    status: SUPPORT_STATUS.OPEN,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(messageRef, {
    id: messageRef.id,
    senderId: request.userId,
    senderName: request.userDisplayName,
    senderRole: request.senderRole,
    content: request.content,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return requestRef.id;
};

/** Raw support-request docs owned by a user (caller converts + sorts). */
export const fetchSupportRequestDocsByUser = async (userId: string): Promise<RawDoc[]> =>
  collectRawDocs(await getDocs(supportRequestsByUserQuery(userId)));

/** Raw support-request docs for every ticket (caller converts + sorts). */
export const fetchAllSupportRequestDocs = async (): Promise<RawDoc[]> =>
  collectRawDocs(await getDocs(collection(db, COLLECTIONS.SUPPORT_REQUESTS)));

// supportRequests — page window newest-first by `updatedAt` (set on create and
// on every message append, so always present). Single-field orderBy; no
// composite index required.
const supportRequestsPageQuery = (
  pageCursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number
): Query<DocumentData> => {
  const constraints: QueryConstraint[] = [orderBy('updatedAt', 'desc')];
  if (pageCursor) constraints.push(startAfter(pageCursor));
  constraints.push(limit(pageSize));
  return query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), ...constraints);
};

/**
 * Read one page of support-request docs, newest-updated first. Requests one
 * extra row internally to report whether a further page exists and returns an
 * opaque `nextCursor` for the following page. Bounds the admin desk's initial
 * read instead of downloading every ticket.
 */
export const fetchSupportRequestsPage = async (options: {
  pageCursor?: unknown;
  pageSize: number;
}): Promise<{ docs: RawDoc[]; nextCursor: unknown | null; hasMore: boolean }> => {
  const { pageCursor, pageSize } = options;
  const snapshot = await getDocs(
    supportRequestsPageQuery((pageCursor as QueryDocumentSnapshot<DocumentData>) ?? null, pageSize + 1)
  );
  const rows: { doc: RawDoc; snap: QueryDocumentSnapshot<DocumentData> }[] = [];
  snapshot.forEach((docSnap) => {
    rows.push({ doc: { id: docSnap.id, data: docSnap.data() }, snap: docSnap });
  });
  const hasMore = rows.length > pageSize;
  if (hasMore) rows.pop();
  const nextCursor = hasMore ? rows[rows.length - 1].snap : null;
  return { docs: rows.map((r) => r.doc), nextCursor, hasMore };
};

/** Raw message docs for a request, ordered oldest-first (caller converts). */
export const fetchSupportMessageDocs = async (requestId: string): Promise<RawDoc[]> =>
  collectRawDocs(await getDocs(supportMessagesQuery(requestId)));

/**
 * Append a message to a support request and re-open the ticket, stamping
 * server timestamps, in one batch.
 */
export const addSupportMessage = async (
  requestId: string,
  message: { senderId: string; senderName: string; senderRole: string; content: string }
): Promise<void> => {
  const parentRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  const messagesRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS, requestId, COLLECTIONS.SUPPORT_MESSAGES);
  const messageRef = doc(messagesRef);

  const batch = writeBatch(db);
  batch.set(messageRef, {
    id: messageRef.id,
    senderId: message.senderId,
    senderName: message.senderName,
    senderRole: message.senderRole,
    content: message.content,
    createdAt: serverTimestamp(),
  });
  batch.update(parentRef, {
    updatedAt: serverTimestamp(),
    status: SUPPORT_STATUS.OPEN, // Always re-open when a new message is sent
  });
  await batch.commit();
};

/** Update a support request's status, stamping a server `updatedAt`. */
export const setSupportRequestStatus = async (requestId: string, status: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId), {
    status,
    updatedAt: serverTimestamp(),
  });
};

/** Delete a support request and cascade-delete its message subcollection. */
export const deleteSupportRequestCascade = async (requestId: string): Promise<void> => {
  const parentRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  const messagesRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS, requestId, COLLECTIONS.SUPPORT_MESSAGES);
  const snap = await getDocs(messagesRef);

  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  batch.delete(parentRef);
  await batch.commit();
};

// ── systemLogs ────────────────────────────────────────────────────────────────

/**
 * Append a telemetry log entry. Resolves the acting user id from auth, stamps a
 * server timestamp, and sets a 7-day TTL. Called by the logger via a dynamic
 * import (the logger sits below firebaseApp in the dependency graph).
 */
export const writeSystemLog = async (
  type: LogSeverity,
  event: string,
  details: Record<string, unknown>
): Promise<void> => {
  const userId = auth?.currentUser?.uid || null;
  const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await addDoc(collection(db, COLLECTIONS.SYSTEM_LOGS), {
    type,
    event,
    userId,
    details,
    timestamp: serverTimestamp(),
    expireAt: Timestamp.fromDate(expireAt),
  });
};

export interface SystemLogRecord {
  id: string;
  type: LogSeverity;
  event: string;
  userId: string | null;
  details: Record<string, unknown>;
  timestamp: unknown;
  expireAt: unknown;
}

/**
 * Read one page of system logs, newest first, optionally filtered by severity.
 * Requests one extra row internally to report whether a further page exists and
 * returns an opaque `nextCursor` to pass back for the next page.
 */
export const fetchSystemLogsPage = async (options: {
  severities: LogSeverity[];
  pageCursor?: unknown;
  pageSize: number;
}): Promise<{ logs: SystemLogRecord[]; nextCursor: unknown | null; hasMore: boolean }> => {
  const { severities, pageCursor, pageSize } = options;
  const snapshot = await getDocs(
    systemLogsQuery(severities, (pageCursor as QueryDocumentSnapshot<DocumentData>) ?? null, pageSize + 1)
  );

  const rows: { record: SystemLogRecord; snap: QueryDocumentSnapshot<DocumentData> }[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    rows.push({
      record: {
        id: docSnap.id,
        type: data.type,
        event: data.event,
        userId: data.userId,
        details: data.details || {},
        timestamp: data.timestamp,
        expireAt: data.expireAt,
      },
      snap: docSnap,
    });
  });

  const hasMore = rows.length > pageSize;
  if (hasMore) rows.pop(); // drop the extra look-ahead row
  const nextCursor = hasMore ? rows[rows.length - 1].snap : null;
  return { logs: rows.map((r) => r.record), nextCursor, hasMore };
};
