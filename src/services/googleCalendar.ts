import type { UserProfile, AvailableDays } from './firebaseService';
import { db, auth, getSchedule, timestampToTimeString, formatDisplayName } from './firebaseService';
import { 
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  documentId,
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import type { DocumentData, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { getGoogleToken } from './googleToken';
import { BOOKING_HORIZON_DAYS, ENABLE_GOOGLE_INTEGRATION, LOG_SEVERITY, BOOKING_STATUS, EVENT_TYPE, BOOKING_ERROR, COLLECTIONS } from '../config';
import { logger } from '../utils/logger';
import { TelemetryErrors } from '../config/telemetryErrors';
import { resolveEventTemplate, DEFAULT_EVENT_TEMPLATES } from '../templates/eventTemplates';

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  meetLink?: string;
  type?: string;
  coachUid?: string;
  clientUid?: string;
  attendees?: { email: string; displayName?: string }[];
}

// Split an array into chunks of at most `size` (for Firestore `in` queries,
// which accept up to 30 values).
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};


interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  hangoutLink?: string;
  attendees?: {
    email: string;
    displayName?: string;
  }[];
}

export const getUpcomingEvents = async (): Promise<CalendarEvent[]> => {
  const token = getGoogleToken();
  const events: CalendarEvent[] = [];
  const seenIds = new Set<string>();

  // Try to load from Google Calendar if a valid token is present
  if (ENABLE_GOOGLE_INTEGRATION && token) {
    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + new Date().toISOString() + '&singleEvents=true&orderBy=startTime',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        (data.items || []).forEach((item: GoogleCalendarEvent) => {
          seenIds.add(item.id);
          events.push({
            id: item.id,
            summary: item.summary || 'Busy Slot',
            description: item.description,
            start: { dateTime: item.start?.dateTime || item.start?.date || '' },
            end: { dateTime: item.end?.dateTime || item.end?.date || '' },
            meetLink: item.hangoutLink || undefined,
            attendees: item.attendees?.map((a: { email: string; displayName?: string }) => ({ email: a.email, displayName: a.displayName }))
          });
        });
      }
    } catch (e) {
      logger.error('Error fetching real Google Calendar events:', e);
      await logger.telemetry(LOG_SEVERITY.ERROR, 'fetch_events_failure', {
        errorCode: TelemetryErrors.FETCH_EVENTS_FAILURE.code,
        errorMessage: TelemetryErrors.FETCH_EVENTS_FAILURE.message,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  // Always query Firestore bookings where the current user is host or client (by
  // stable userId, not email) and merge.
  const currentUser = auth?.currentUser;
  if (currentUser && db) {
    try {
      let qClient = query(collection(db, COLLECTIONS.BOOKINGS), where('clientUid', '==', currentUser.uid));
      let qHost = query(collection(db, COLLECTIONS.BOOKINGS), where('coachUid', '==', currentUser.uid));

      qClient = query(qClient, where('endTime', '>=', Timestamp.now()));
      qHost = query(qHost, where('endTime', '>=', Timestamp.now()));

      const snapClient = await getDocs(qClient);
      const snapHost = await getDocs(qHost);

      const profileCache = new Map<string, UserProfile>();
      const getProfile = async (uid: string): Promise<UserProfile | null> => {
        if (profileCache.has(uid)) return profileCache.get(uid)!;
        const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        if (userSnap.exists()) {
          const profile = userSnap.data() as UserProfile;
          profileCache.set(uid, profile);
          return profile;
        }
        return null;
      };

      const processSnap = async (snap: QuerySnapshot<DocumentData>) => {
        for (const d of snap.docs) {
          const data = d.data();
          if (data.status === BOOKING_STATUS.CANCELLED) continue; // skip cancelled bookings
          
          const existingEvent = events.find(e => e.id === data.bookingId);
          if (existingEvent) {
            existingEvent.type = EVENT_TYPE.PEER_COACHING;
            existingEvent.coachUid = data.coachUid;
            existingEvent.clientUid = data.clientUid;
            if (data.topic) {
              existingEvent.description = `Peer Coaching Network session on the topic: ${data.topic}. Created via PCN.`;
            }
          } else if (!seenIds.has(data.bookingId)) {
            seenIds.add(data.bookingId);
            const startStr: string = data.startTime && typeof data.startTime.toDate === 'function'
              ? data.startTime.toDate().toISOString()
              : (data.startTime?.dateTime || data.startTime || '');
            const endStr: string = data.endTime && typeof data.endTime.toDate === 'function'
              ? data.endTime.toDate().toISOString()
              : (data.endTime?.dateTime || data.endTime || '');

            const coachProfile = await getProfile(data.coachUid);
            const clientProfile = await getProfile(data.clientUid);

            const coachFirstName = coachProfile ? (coachProfile.firstName || (formatDisplayName(coachProfile) || 'Coach').split(' ')[0]) : 'Coach';
            const clientFirstName = clientProfile ? (clientProfile.firstName || (formatDisplayName(clientProfile) || 'Peer').split(' ')[0]) : 'Peer';

            events.push({
              id: data.bookingId,
              summary: `${coachFirstName} / ${clientFirstName} - Peer Coaching Session`,
              description: `Peer Coaching Network session on the topic: ${data.topic}. Created via PCN.`,
              start: { dateTime: startStr },
              end: { dateTime: endStr },
              meetLink: data.googleMeetLink,
              type: EVENT_TYPE.PEER_COACHING,
              coachUid: data.coachUid,
              clientUid: data.clientUid,
              attendees: [
                { email: coachProfile?.email || '', displayName: coachProfile ? formatDisplayName(coachProfile) : '' },
                { email: clientProfile?.email || '', displayName: clientProfile ? formatDisplayName(clientProfile) : '' }
              ]
            });
          }
        }
      };

      await processSnap(snapClient);
      await processSnap(snapHost);
    } catch (err) {
      logger.error('Error querying bookings from Firestore:', err);
    }
  }

  events.sort((a, b) => {
    const timeA = new Date(a.start.dateTime).getTime();
    const timeB = new Date(b.start.dateTime).getTime();
    return timeA - timeB;
  });

  return events;
};

export const scheduleMeeting = async (
  coachUid: string,
  coachEmail: string,
  coachName: string,
  clientUid: string,
  clientName: string,
  startIso: string,
  endIso: string,
  topic: string
): Promise<CalendarEvent> => {
  const token = getGoogleToken();
  const meetId = Math.random().toString(36).substring(2, 5) + '-' +
                 Math.random().toString(36).substring(2, 6) + '-' +
                 Math.random().toString(36).substring(2, 5);
  const meetLink = `https://meet.google.com/${meetId}`;

  const currentUser = auth?.currentUser;
  const clientEmail = currentUser?.email || '';
  const resolvedClientName = currentUser?.displayName || clientName;

  const resolvedSummary = resolveEventTemplate(DEFAULT_EVENT_TEMPLATES.summary, {
    coachName,
    coachEmail,
    clientName: resolvedClientName,
    clientEmail,
    topic,
  });

  const resolvedDescription = resolveEventTemplate(DEFAULT_EVENT_TEMPLATES.description, {
    coachName,
    coachEmail,
    clientName: resolvedClientName,
    clientEmail,
    topic,
  });

  const eventPayload = {
    summary: resolvedSummary,
    description: resolvedDescription,
    start: {
      dateTime: startIso,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endIso,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: [{ email: coachEmail }],
    conferenceData: {
      createRequest: {
        requestId: Math.random().toString(36).substring(2, 12),
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  };

  const bookingId = `${coachUid}_${startIso}`;
  logger.info(`Attempting to book session for client ${clientUid} with coach ${coachUid} at ${startIso}`);
  await logger.telemetry(LOG_SEVERITY.INFO, 'booking_attempt', {
    clientUid,
    coachUid,
    startIso,
    bookingId,
    clientBookingCacheId: `${clientUid}_${startIso}`
  });

  if (!db) {
    throw new Error('Database not initialized');
  }

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const isOneHour = (endMs - startMs) > 30 * 60 * 1000;

  const t0 = startIso;
  const tMinus30 = new Date(startMs - 30 * 60 * 1000).toISOString();
  const tPlus30 = new Date(startMs + 30 * 60 * 1000).toISOString();

  const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
  
  const coachAtT0Ref = doc(db, COLLECTIONS.BOOKINGS, `${coachUid}_${t0}`);
  const coachAtTMinus30Ref = doc(db, COLLECTIONS.BOOKINGS, `${coachUid}_${tMinus30}`);
  const coachAtTPlus30Ref = doc(db, COLLECTIONS.BOOKINGS, `${coachUid}_${tPlus30}`);

  const clientAsCoachAtT0Ref = doc(db, COLLECTIONS.BOOKINGS, `${clientUid}_${t0}`);
  const clientAsCoachAtTMinus30Ref = doc(db, COLLECTIONS.BOOKINGS, `${clientUid}_${tMinus30}`);
  const clientAsCoachAtTPlus30Ref = doc(db, COLLECTIONS.BOOKINGS, `${clientUid}_${tPlus30}`);

  const clientBookingCacheAtT0Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${t0}`);
  const clientBookingCacheAtTPlus30Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${tPlus30}`);
  
  const coachAsClientAtT0Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${coachUid}_${t0}`);
  const coachAsClientAtTPlus30Ref = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${coachUid}_${tPlus30}`);

  let realMeetLink = meetLink;
  let googleEventId = `mock-booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Step 1: Claim the slot in Firestore via Transaction
  let transactionSuccess = false;
  let attempts = 0;
  const maxAttempts = 3;
  let lastError: Error | null = null;

  const bookingData = {
    bookingId,
    googleEventId: '',
    googleMeetLink: '',
    status: BOOKING_STATUS.PENDING,
    startTime: Timestamp.fromDate(new Date(startIso)),
    endTime: Timestamp.fromDate(new Date(endIso)),
    topic,
    coachUid,
    clientUid,
    createdAt: Timestamp.now()
  };

  while (attempts < maxAttempts && !transactionSuccess) {
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
          coachAsClientAtTPlus30
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
          tx.get(coachAsClientAtTPlus30Ref)
        ]);

        const isOneHourBooking = (docSnap: DocumentSnapshot) => {
          if (!docSnap.exists()) return false;
          const data = docSnap.data();
          if (data.status === BOOKING_STATUS.CANCELLED) return false;
          const start = data.startTime.toDate().getTime();
          const end = data.endTime.toDate().getTime();
          return (end - start) > 30 * 60 * 1000;
        };

        // 1. Coach Availability checks
        if (coachAtT0.exists() && coachAtT0.data()?.status !== BOOKING_STATUS.CANCELLED) {
          throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        }
        if (isOneHourBooking(coachAtTMinus30)) {
          throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        }
        if (isOneHour && coachAtTPlus30.exists() && coachAtTPlus30.data()?.status !== BOOKING_STATUS.CANCELLED) {
          throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        }

        // 2. Coach as Client checks
        if (coachAsClientAtT0.exists()) {
          throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        }
        if (isOneHour && coachAsClientAtTPlus30.exists()) {
          throw new Error(BOOKING_ERROR.SLOT_TAKEN);
        }

        // 3. Client Availability as Client checks
        if (clientBookingCacheAtT0.exists()) {
          throw new Error(BOOKING_ERROR.BOOKED_AS_CLIENT);
        }
        if (isOneHour && clientBookingCacheAtTPlus30.exists()) {
          throw new Error(BOOKING_ERROR.BOOKED_AS_CLIENT);
        }

        // 4. Client Availability as Coach checks
        if (clientAsCoachAtT0.exists() && clientAsCoachAtT0.data()?.status !== BOOKING_STATUS.CANCELLED) {
          throw new Error(BOOKING_ERROR.BOOKED_AS_COACH);
        }
        if (isOneHourBooking(clientAsCoachAtTMinus30)) {
          throw new Error(BOOKING_ERROR.BOOKED_AS_COACH);
        }
        if (isOneHour && clientAsCoachAtTPlus30.exists() && clientAsCoachAtTPlus30.data()?.status !== BOOKING_STATUS.CANCELLED) {
          throw new Error(BOOKING_ERROR.BOOKED_AS_COACH);
        }

        tx.set(bookingRef, bookingData);
        
        const expireDate = new Date(startMs + 24 * 60 * 60 * 1000);
        tx.set(clientBookingCacheAtT0Ref, {
          clientUid,
          coachUid,
          bookingId,
          startIso: t0,
          createdAt: Timestamp.now(),
          expireAt: Timestamp.fromDate(expireDate)
        });
        if (isOneHour) {
          tx.set(clientBookingCacheAtTPlus30Ref, {
            clientUid,
            coachUid,
            bookingId,
            startIso: tPlus30,
            createdAt: Timestamp.now(),
            expireAt: Timestamp.fromDate(expireDate)
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
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
      }
    }
  }

  if (!transactionSuccess) {
    throw lastError || new Error('FAILED_TO_PERSIST');
  }

  const deleteLocks = async () => {
    try {
      await deleteDoc(clientBookingCacheAtT0Ref);
      if (isOneHour) {
        await deleteDoc(clientBookingCacheAtTPlus30Ref);
      }
    } catch (e) {
      logger.error('Error deleting client booking cache locks on rollback:', e);
    }
  };

  // Step 2: Attempt Google Calendar Event Creation if integration enabled
  if (ENABLE_GOOGLE_INTEGRATION) {
    if (!token) {
      // Rollback
      await updateDoc(bookingRef, { status: BOOKING_STATUS.CANCELLED });
      await deleteLocks();
      const err = new Error('Google Token Expired');
      (err as ApiError).code = 'GOOGLE_TOKEN_EXPIRED';
      throw err;
    }

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      );

      if (!response.ok) {
        // Rollback Firestore
        await updateDoc(bookingRef, { status: BOOKING_STATUS.CANCELLED });
        await deleteLocks();

        if (response.status === 401) {
          const err = new Error('Google Token Expired');
          (err as ApiError).code = 'GOOGLE_TOKEN_EXPIRED';
          throw err;
        }

        const errorText = await response.text();
        logger.error(`Google Calendar API Error: ${response.status} ${errorText}`);
        const apiError = new Error('Failed to create Google Calendar event.');
        (apiError as ApiError).code = 'GOOGLE_API_ERROR';
        (apiError as ApiError).status = response.status;
        throw apiError;
      }

      const data = await response.json();
      googleEventId = data.id;
      realMeetLink = data.hangoutLink || meetLink;
    } catch (e) {
      if ((e as ApiError).code === 'GOOGLE_TOKEN_EXPIRED' || (e as ApiError).code === 'GOOGLE_API_ERROR') {
        throw e;
      }
      
      // Rollback Firestore on unexpected fetch failure
      await updateDoc(bookingRef, { status: BOOKING_STATUS.CANCELLED });
      await deleteLocks();

      const genericError = new Error('Network error or Google Calendar API is currently unreachable. Please try again.');
      (genericError as ApiError).code = 'GOOGLE_API_ERROR';
      throw genericError;
    }
  }

  // Step 3: Update Firestore with Real IDs and set status to Confirmed
  await updateDoc(bookingRef, {
    googleEventId,
    googleMeetLink: realMeetLink,
    status: BOOKING_STATUS.CONFIRMED
  });

  logger.info(`Successfully booked session. Booking ID: ${bookingId}`);

  const newBooking: CalendarEvent = {
    id: bookingId,
    summary: eventPayload.summary,
    description: eventPayload.description,
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    meetLink: realMeetLink,
    type: EVENT_TYPE.PEER_COACHING,
    attendees: [
      { email: coachEmail, displayName: coachName },
      { email: clientEmail, displayName: resolvedClientName }
    ]
  };

  return newBooking;
};

export const cancelBooking = async (bookingId: string): Promise<void> => {
  if (!db) return;
  const ref = doc(db, COLLECTIONS.BOOKINGS, bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();

  const token = getGoogleToken();

  // Step 1: Cancel in Google Calendar FIRST
  if (ENABLE_GOOGLE_INTEGRATION && data.googleEventId) {
    if (!token) {
      const err = new Error('Google Token Expired');
      (err as ApiError).code = 'GOOGLE_TOKEN_EXPIRED';
      throw err;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${data.googleEventId}?sendUpdates=all`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok && response.status !== 404) {
        if (response.status === 401) {
          const err = new Error('Google Token Expired');
          (err as ApiError).code = 'GOOGLE_TOKEN_EXPIRED';
          throw err;
        }
        const apiError = new Error('Failed to delete Google Calendar event.');
        (apiError as ApiError).code = 'GOOGLE_API_ERROR';
        throw apiError;
      }
    } catch (e) {
      if ((e as ApiError).code === 'GOOGLE_TOKEN_EXPIRED' || (e as ApiError).code === 'GOOGLE_API_ERROR') {
        throw e;
      }
      const genericError = new Error('Network error or Google Calendar API is currently unreachable. Please try again.');
      (genericError as ApiError).code = 'GOOGLE_API_ERROR';
      throw genericError;
    }
  }

  // Step 2: Cancel in Firestore
  await updateDoc(ref, { status: BOOKING_STATUS.CANCELLED, cancelledAt: Timestamp.now() });

  const startIso = data.startTime && typeof data.startTime.toDate === 'function'
    ? data.startTime.toDate().toISOString()
    : (data.startTime?.dateTime || data.startTime);
  if (data.clientUid && startIso) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${data.clientUid}_${startIso}`));
      const durationMs = data.endTime.toDate().getTime() - data.startTime.toDate().getTime();
      if (durationMs > 30 * 60 * 1000) {
        const nextStartIso = new Date(data.startTime.toDate().getTime() + 30 * 60 * 1000).toISOString();
        await deleteDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${data.clientUid}_${nextStartIso}`));
      }
    } catch (e) {
      logger.error('Error releasing client booking cache:', e);
    }
  }

  logger.info(`Successfully cancelled booking. Booking ID: ${bookingId}`);
};

export const generateFallbackAvailableSlots = (
  coach: UserProfile,
  schedule: { availableDays: AvailableDays; blockedDates: string[] },
  timeMinStr: string,
  timeMaxStr: string
): string[] => {
  const timezone = coach.timezone || 'UTC';
  const { availableDays, blockedDates } = schedule;

  const timeMin = new Date(timeMinStr);
  const timeMax = new Date(timeMaxStr);

  const localToday = getLocalDateInTimezone(timeMin, timezone);
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const availableSlots: string[] = [];

  for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
    const currentDate = new Date(localToday);
    currentDate.setDate(localToday.getDate() + i);
    if (currentDate.getTime() > timeMax.getTime()) break;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (blockedDates.includes(dateStr)) continue;

    const dayName = daysOfWeek[currentDate.getDay()];
    const daySched = availableDays[dayName as keyof AvailableDays] || { enabled: false, slots: [] };

    if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) continue;

    for (const slot of daySched.slots) {
      const startTimeString = timestampToTimeString(slot.startTime);
      const endTimeString = timestampToTimeString(slot.endTime);
      
      const parsedStart = parseLocalTime(startTimeString);
      const parsedEnd = parseLocalTime(endTimeString);
      
      const startMinutes = parsedStart.hour * 60 + parsedStart.minute;
      const endMinutes = parsedEnd.hour * 60 + parsedEnd.minute;
      
      for (let min = startMinutes; min < endMinutes; min += 30) {
        const slotHour = Math.floor(min / 60);
        const slotMin = min % 60;
        const slotStartUtc = getUtcForLocalDateTime(year, month, day, slotHour, slotMin, timezone);
        if (slotStartUtc.getTime() >= timeMin.getTime() && slotStartUtc.getTime() < timeMax.getTime()) {
          availableSlots.push(slotStartUtc.toISOString());
        }
      }
    }
  }

  return availableSlots;
};

export const getCoachesAvailability = async (
  coaches: UserProfile[],
  timeMin: string,
  timeMax: string
): Promise<Record<string, string[]>> => {
  const coachesAvailability: Record<string, string[]> = {};

  coaches.forEach((coach) => {
    coachesAvailability[coach.userId] = [];
  });

  if (db) {
    const activeDb = db;
    const uids = coaches.map(c => c.userId);
    const uidChunks = chunkArray(uids, 30);

    const foundUids = new Set<string>();
    const personalAvailabilityCacheResults = await Promise.allSettled(
      uidChunks.map(c =>
        getDocs(query(collection(activeDb, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE), where(documentId(), 'in', c)))
      )
    );
    
    personalAvailabilityCacheResults.forEach((res, index) => {
      if (res.status !== 'fulfilled') {
        logger.error('Error fetching available slots cache chunk:', res.reason);
        logger.telemetry(LOG_SEVERITY.ERROR, 'cache_query_failure', {
          uids: uidChunks[index],
          errorCode: TelemetryErrors.CACHE_QUERY_FAILURE.code,
          errorMessage: TelemetryErrors.CACHE_QUERY_FAILURE.message,
          error: res.reason instanceof Error ? res.reason.message : String(res.reason)
        }).catch(err => logger.error('Failed to log cache query failure:', err));
        return;
      }
      res.value.forEach((d) => {
        const uid = d.id;
        if (!(uid in coachesAvailability)) return;
        foundUids.add(uid);
        const data = d.data();
        coachesAvailability[uid] = data.availableSlots || [];
      });
    });

    for (const coach of coaches) {
      if (!foundUids.has(coach.userId)) {
        try {
          const schedule = await getSchedule(coach.userId);
          const fallbackSlots = generateFallbackAvailableSlots(coach, schedule, timeMin, timeMax);
          coachesAvailability[coach.userId] = fallbackSlots;
        } catch (e) {
          logger.error(`Error generating fallback slots for ${coach.userId}:`, e);
        }
      }
    }
  }

  return coachesAvailability;
};
