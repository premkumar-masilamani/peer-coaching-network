import type { UserProfile, AvailableDays } from './firebaseService';
import { db, auth, recalculateUserBusySlotsCache, getSchedule, timestampToTimeString, formatDisplayName } from './firebaseService';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, documentId, runTransaction, Timestamp } from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { getGoogleToken } from './googleToken';
import { BOOKING_HORIZON_DAYS, ENABLE_GOOGLE_INTEGRATION, LOG_SEVERITY, BOOKING_STATUS, EVENT_TYPE, BOOKING_ERROR, COLLECTIONS } from '../config';
import { logger } from '../utils/logger';
import { TelemetryErrors } from '../config/telemetryErrors';
import { resolveEventTemplate, DEFAULT_EVENT_TEMPLATES } from '../templates/eventTemplates';

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
// which accept up to 30 values). See BUG-005.
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
  // stable userId, not email) and merge. See BUG-019.
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
          if (data.status === BOOKING_STATUS.CANCELLED) continue; // skip cancelled bookings (BUG-016)
          
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

  // Deterministic per-slot document id so a coach can't be double-booked for the
  // same time. See BUG-004.
  const bookingId = `${coachUid}_${startIso}`;

  logger.info(`Attempting to book session for client ${clientUid} with coach ${coachUid} at ${startIso}`);
  await logger.telemetry(LOG_SEVERITY.INFO, 'booking_attempt', {
    clientUid,
    coachUid,
    startIso,
    bookingId,
    clientBookingCacheId: `${clientUid}_${startIso}`
  });

  let realMeetLink = meetLink;
  let googleEventId = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let googleEventCreated = false;

  if (ENABLE_GOOGLE_INTEGRATION && token) {
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
        const errorText = await response.text();
        logger.error(`Google Calendar API Error: ${response.status} ${errorText}`);

        let userMessage = 'Failed to create Google Calendar event.';
        if (response.status === 403 || response.status === 429) {
          userMessage = 'Google Calendar rate limit exceeded. Please try again in a moment.';
        }

        const apiError = new Error(userMessage);
        (apiError as { code?: string; status?: number }).code = 'GOOGLE_API_ERROR';
        (apiError as { code?: string; status?: number }).status = response.status;
        throw apiError;
      }

      const data = await response.json();
      googleEventId = data.id;
      realMeetLink = data.hangoutLink || meetLink;
      googleEventCreated = true;
    } catch (e) {
      logger.error('Error during Google Calendar event creation:', e);
      await logger.telemetry(LOG_SEVERITY.ERROR, 'google_api_create_failure', {
        clientUid,
        coachUid,
        startIso,
        bookingId,
        clientBookingCacheId: `${clientUid}_${startIso}`,
        errorCode: TelemetryErrors.GOOGLE_API_CREATE_FAILURE.code,
        errorMessage: TelemetryErrors.GOOGLE_API_CREATE_FAILURE.message,
        error: e instanceof Error ? e.message : String(e)
      });
      if (e instanceof Error && (e as { code?: string }).code === 'GOOGLE_API_ERROR') {
        throw e;
      }
      const genericError = new Error('Network error or Google Calendar API is currently unreachable. Please try again.');
      (genericError as { code?: string }).code = 'GOOGLE_API_ERROR';
      throw genericError;
    }
  }

  if (db) {
    const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
    const clientBookingCacheRef = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${clientUid}_${startIso}`);
    const coachAsClientRef = doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${coachUid}_${startIso}`);
    const clientAsCoachRef = doc(db, COLLECTIONS.BOOKINGS, `${clientUid}_${startIso}`);

    const bookingData = {
      bookingId,
      googleEventId,
      googleMeetLink: realMeetLink,
      status: BOOKING_STATUS.CONFIRMED,
      startTime: Timestamp.fromDate(new Date(startIso)),
      endTime: Timestamp.fromDate(new Date(endIso)),
      topic,
      coachUid,
      clientUid,
      createdAt: Timestamp.now()
    };

    let transactionSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: Error | null = null;

    while (attempts < maxAttempts && !transactionSuccess) {
      attempts++;
      try {
        await runTransaction(db, async (tx) => {
          const [
            coachAsCoachDoc,
            coachAsClientDoc,
            clientAsClientDoc,
            clientAsCoachDoc
          ] = await Promise.all([
            tx.get(bookingRef),
            tx.get(coachAsClientRef),
            tx.get(clientBookingCacheRef),
            tx.get(clientAsCoachRef)
          ]);

          if (coachAsCoachDoc.exists() && coachAsCoachDoc.data()?.status !== BOOKING_STATUS.CANCELLED) {
            throw new Error(BOOKING_ERROR.SLOT_TAKEN);
          }
          if (coachAsClientDoc.exists()) {
            throw new Error(BOOKING_ERROR.SLOT_TAKEN);
          }
          if (clientAsClientDoc.exists()) {
            throw new Error(BOOKING_ERROR.BOOKED_AS_CLIENT);
          }
          if (clientAsCoachDoc.exists() && clientAsCoachDoc.data()?.status !== BOOKING_STATUS.CANCELLED) {
            throw new Error(BOOKING_ERROR.BOOKED_AS_COACH);
          }

          tx.set(bookingRef, bookingData);
          
          const startTimestamp = new Date(startIso);
          const expireDate = new Date(startTimestamp.getTime() + 24 * 60 * 60 * 1000);
          tx.set(clientBookingCacheRef, {
            clientUid,
            coachUid,
            bookingId,
            startIso,
            createdAt: Timestamp.now(),
            expireAt: Timestamp.fromDate(expireDate)
          });
        });
        transactionSuccess = true;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // If it's a logical error, do not retry!
        if (
          err instanceof Error &&
          (err.message === BOOKING_ERROR.SLOT_TAKEN ||
            err.message === BOOKING_ERROR.BOOKED_AS_CLIENT ||
            err.message === BOOKING_ERROR.BOOKED_AS_COACH)
        ) {
          const telemetryErr =
            err.message === BOOKING_ERROR.SLOT_TAKEN
              ? TelemetryErrors.SLOT_TAKEN
              : err.message === BOOKING_ERROR.BOOKED_AS_CLIENT
              ? TelemetryErrors.BOOKED_AS_CLIENT
              : TelemetryErrors.BOOKED_AS_COACH;
          logger.warn(`Booking collision: ${telemetryErr.message}`);
          await logger.telemetry(LOG_SEVERITY.WARN, 'booking_collision', {
            clientUid,
            coachUid,
            startIso,
            bookingId,
            clientBookingCacheId: `${clientUid}_${startIso}`,
            errorCode: telemetryErr.code,
            errorMessage: telemetryErr.message,
            reason: err.message,
          });
          break;
        }
        logger.warn(`Firestore transaction attempt ${attempts} failed:`, err);
        // Wait a short duration before retrying (exponential backoff)
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
        }
      }
    }

    if (!transactionSuccess) {
      await logger.telemetry(LOG_SEVERITY.ERROR, 'transaction_failure', {
        clientUid,
        coachUid,
        startIso,
        bookingId,
        clientBookingCacheId: `${clientUid}_${startIso}`,
        errorCode: TelemetryErrors.TRANSACTION_FAILURE.code,
        errorMessage: TelemetryErrors.TRANSACTION_FAILURE.message,
        error: lastError instanceof Error ? lastError.message : String(lastError)
      });
      // Cleanup Google Calendar event since Firestore save failed after all retries
      if (googleEventCreated && ENABLE_GOOGLE_INTEGRATION && token) {
        try {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          logger.info(`Cleaned up Google Calendar event after Firestore transaction failure: ${googleEventId}`);
        } catch (cleanupErr) {
          logger.error('Failed to cleanup Google Calendar event:', cleanupErr);
          await logger.telemetry(LOG_SEVERITY.ERROR, 'google_api_delete_failure', {
            googleEventId,
            clientUid,
            coachUid,
            bookingId,
            clientBookingCacheId: `${clientUid}_${startIso}`,
            errorCode: TelemetryErrors.GOOGLE_API_DELETE_FAILURE.code,
            errorMessage: TelemetryErrors.GOOGLE_API_DELETE_FAILURE.message,
            error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
          });
        }
      }
      throw lastError || new Error('FAILED_TO_PERSIST');
    }

    logger.info(`Successfully booked session. Booking ID: ${bookingId}`);
    await logger.telemetry(LOG_SEVERITY.INFO, 'booking_success', {
      clientUid,
      coachUid,
      startIso,
      bookingId,
      clientBookingCacheId: `${clientUid}_${startIso}`,
      googleEventId,
      googleEventCreated,
    });

    // Recalculate ONLY the current user's own busy slots cache. The other
    // participant's cache is owner-only now; their booked time is surfaced live
    // from the bookings overlay in getCoachesBusySlots. See BUG-001.
    if (currentUser?.uid) {
      recalculateUserBusySlotsCache(currentUser.uid).catch(err => {
        logger.error('Error recalculating busy slots cache:', err);
      });
    }
  }

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

// Cancel a booking: mark it cancelled, release the mentee slot hold, best-effort
// remove the Google event, and recompute the canceller's own availability. The
// other participant's freed slot is reflected live from the bookings overlay in
// getCoachesAvailability. See BUG-001/003/016.
export const cancelBooking = async (bookingId: string): Promise<void> => {
  if (!db) return;
  const ref = doc(db, COLLECTIONS.BOOKINGS, bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();

  await updateDoc(ref, { status: BOOKING_STATUS.CANCELLED, cancelledAt: Timestamp.now() });

  // Release the mentee's per-slot hold so that time can be rebooked. See BUG-003.
  const startIso = data.startTime && typeof data.startTime.toDate === 'function'
    ? data.startTime.toDate().toISOString()
    : (data.startTime?.dateTime || data.startTime);
  if (data.clientUid && startIso) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CLIENT_BOOKING_CACHE, `${data.clientUid}_${startIso}`));
    } catch (e) {
      logger.error('Error releasing client booking cache:', e);
    }
  }

  const token = getGoogleToken();
  if (ENABLE_GOOGLE_INTEGRATION && token && data.googleEventId) {
    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${data.googleEventId}?sendUpdates=all`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (e) {
      logger.error('Error deleting Google Calendar event:', e);
      await logger.telemetry(LOG_SEVERITY.ERROR, 'google_api_delete_failure', {
        googleEventId: data.googleEventId,
        clientUid: data.clientUid,
        coachUid: data.coachUid,
        bookingId,
        clientBookingCacheId: `${data.clientUid}_${startIso}`,
        errorCode: TelemetryErrors.GOOGLE_API_DELETE_FAILURE.code,
        errorMessage: TelemetryErrors.GOOGLE_API_DELETE_FAILURE.message,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  logger.info(`Successfully cancelled booking. Booking ID: ${bookingId}`);
  await logger.telemetry(LOG_SEVERITY.INFO, 'booking_cancellation', {
    bookingId,
    clientUid: data.clientUid,
    coachUid: data.coachUid,
    startIso,
    clientBookingCacheId: `${data.clientUid}_${startIso}`
  });

  const currentUid = auth?.currentUser?.uid;
  if (currentUid) {
    recalculateUserBusySlotsCache(currentUid).catch(err => logger.error('Recalc error:', err));
  }
};

export const generateFallbackBusySlots = (
  coach: UserProfile,
  schedule: { availableDays: AvailableDays; blockedDates: string[] },
  timeMinStr: string,
  timeMaxStr: string
): CalendarEvent[] => {
  const timezone = coach.timezone || 'UTC';
  const { availableDays, blockedDates } = schedule;
  const weekly = availableDays;

  const timeMin = new Date(timeMinStr);
  const timeMax = new Date(timeMaxStr);

  const localToday = getLocalDateInTimezone(timeMin, timezone);
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const busyEvents: CalendarEvent[] = [];

  for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
    const currentDate = new Date(localToday);
    currentDate.setDate(localToday.getDate() + i);
    if (currentDate.getTime() > timeMax.getTime()) break;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (blockedDates.includes(dateStr)) {
      const dayStart = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
      const dayEnd = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
      busyEvents.push({
        id: `fallback-block-${coach.userId}-${dateStr}`,
        summary: 'Busy',
        start: { dateTime: dayStart.toISOString() },
        end: { dateTime: dayEnd.toISOString() }
      });
      continue;
    }

    const dayName = daysOfWeek[currentDate.getDay()];
    const daySched = weekly[dayName as keyof typeof weekly] || { enabled: false, slots: [] };

    if (!daySched.enabled || !daySched.slots || daySched.slots.length === 0) {
      const dayStart = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
      const dayEnd = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
      busyEvents.push({
        id: `fallback-sched-${coach.userId}-${dateStr}`,
        summary: 'Busy',
        start: { dateTime: dayStart.toISOString() },
        end: { dateTime: dayEnd.toISOString() }
      });
    } else {
      const sortedSlots = [...daySched.slots].map(s => {
        const startTimeString = timestampToTimeString(s.startTime);
        const endTimeString = timestampToTimeString(s.endTime);
        const parsedStart = parseLocalTime(startTimeString);
        const parsedEnd = parseLocalTime(endTimeString);
        return {
          startMin: parsedStart.hour * 60 + parsedStart.minute,
          endMin: parsedEnd.hour * 60 + parsedEnd.minute,
          startStr: startTimeString,
          endStr: endTimeString
        };
      }).sort((a, b) => a.startMin - b.startMin);

      if (sortedSlots[0].startMin > 0) {
        const startUtc = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
        const parsedS = parseLocalTime(sortedSlots[0].startStr);
        const endUtc = getUtcForLocalDateTime(year, month, day, parsedS.hour, parsedS.minute, timezone);
        busyEvents.push({
          id: `fallback-gap1-${coach.userId}-${dateStr}`,
          summary: 'Busy',
          start: { dateTime: startUtc.toISOString() },
          end: { dateTime: endUtc.toISOString() }
        });
      }

      for (let j = 0; j < sortedSlots.length - 1; j++) {
        const currentSlot = sortedSlots[j];
        const nextSlot = sortedSlots[j + 1];
        if (nextSlot.startMin > currentSlot.endMin) {
          const parsedC = parseLocalTime(currentSlot.endStr);
          const parsedN = parseLocalTime(nextSlot.startStr);
          const startUtc = getUtcForLocalDateTime(year, month, day, parsedC.hour, parsedC.minute, timezone);
          const endUtc = getUtcForLocalDateTime(year, month, day, parsedN.hour, parsedN.minute, timezone);
          busyEvents.push({
            id: `fallback-gap2-${coach.userId}-${dateStr}-${j}`,
            summary: 'Busy',
            start: { dateTime: startUtc.toISOString() },
            end: { dateTime: endUtc.toISOString() }
          });
        }
      }

      const lastSlot = sortedSlots[sortedSlots.length - 1];
      if (lastSlot.endMin < 24 * 60) {
        const parsedL = parseLocalTime(lastSlot.endStr);
        const startUtc = getUtcForLocalDateTime(year, month, day, parsedL.hour, parsedL.minute, timezone);
        const endUtc = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
        busyEvents.push({
          id: `fallback-gap3-${coach.userId}-${dateStr}`,
          summary: 'Busy',
          start: { dateTime: startUtc.toISOString() },
          end: { dateTime: endUtc.toISOString() }
        });
      }
    }
  }

  return busyEvents;
};

export const getCoachesBusySlots = async (
  coaches: UserProfile[],
  timeMin: string,
  timeMax: string
): Promise<Record<string, CalendarEvent[]>> => {
  const token = getGoogleToken();
  const coachesBusySlots: Record<string, CalendarEvent[]> = {};

  coaches.forEach((coach) => {
    coachesBusySlots[coach.userId] = [];
  });

  const validCoaches = coaches.filter((c) => c.email && c.email.includes('@'));

  // Try to load FreeBusy information from Google Calendar if a valid token is present and we have valid emails to query
  if (ENABLE_GOOGLE_INTEGRATION && token && validCoaches.length > 0) {
    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: validCoaches.map((c) => ({ id: c.email })),
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        coaches.forEach((coach) => {
          if (!coach.email) return;
          const calendarData = data.calendars?.[coach.email];
          const busyIntervals = calendarData?.busy || [];

          coachesBusySlots[coach.userId] = busyIntervals.map((interval: { start: string; end: string }, idx: number) => ({
            id: `busy-${coach.userId}-${idx}`,
            summary: 'Busy',
            start: { dateTime: interval.start },
            end: { dateTime: interval.end },
          }));
        });
      }
    } catch (e) {
      logger.error('Error fetching real Google Calendar FreeBusy info:', e);
      await logger.telemetry(LOG_SEVERITY.ERROR, 'freebusy_api_failure', {
        coachUids: coaches.map(c => c.userId),
        errorCode: TelemetryErrors.FREEBUSY_API_FAILURE.code,
        errorMessage: TelemetryErrors.FREEBUSY_API_FAILURE.message,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  if (db) {
    const activeDb = db;
    const uids = coaches.map(c => c.userId);
    const uidChunks = chunkArray(uids, 30);

    // 1. Load each coach's template-derived busy-slot cache, reading only the
    //    needed docs via batched `in` queries (not a whole-collection scan) and
    //    tolerating partial failures. See BUG-005.
    const foundUids = new Set<string>();
    const busySlotsCacheResults = await Promise.allSettled(
      uidChunks.map(c =>
        getDocs(query(collection(activeDb, 'busySlotsCache'), where(documentId(), 'in', c)))
      )
    );
    busySlotsCacheResults.forEach((res, index) => {
      if (res.status !== 'fulfilled') {
        logger.error('Error fetching busy slots cache chunk:', res.reason);
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
        if (!(uid in coachesBusySlots)) return;
        foundUids.add(uid);
        const data = d.data();
        const busySlots = data.busySlots || [];
        busySlots.forEach((slot: { start: string; end: string; id?: string }, idx: number) => {
          const isAlreadyAdded = coachesBusySlots[uid].some((event) =>
            event.id === slot.id ||
            new Date(event.start.dateTime).getTime() === new Date(slot.start).getTime()
          );
          if (!isAlreadyAdded) {
            coachesBusySlots[uid].push({
              id: slot.id || `busy-${uid}-${idx}`,
              summary: 'Busy',
              start: { dateTime: slot.start },
              end: { dateTime: slot.end }
            });
          }
        });
      });
    });

    // 2. In-memory fallback for coaches without a cache doc. We do NOT cross-write
    //    their busySlotsCache doc (owner-only writes now). See BUG-001/005.
    for (const coach of coaches) {
      if (!foundUids.has(coach.userId)) {
        const schedule = await getSchedule(coach.userId);
        const fallbackSlots = generateFallbackBusySlots(coach, schedule, timeMin, timeMax);
        coachesBusySlots[coach.userId] = [...coachesBusySlots[coach.userId], ...fallbackSlots];
      } else {
        // Fix the "Infinite Availability" Bug:
        // Ensure there is at least one busy slot for each day in the 56-day rolling window.
        // If a day has no busy slots at all, mark the entire day as unavailable.
        const timezone = coach.timezone || 'UTC';
        const startSearch = new Date(timeMin);
        const timeMaxObj = new Date(timeMax);
        const localToday = getLocalDateInTimezone(startSearch, timezone);
        
        const coachBusyEvents = coachesBusySlots[coach.userId];
        
        for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
          const currentDate = new Date(localToday);
          currentDate.setDate(localToday.getDate() + i);
          if (currentDate.getTime() > timeMaxObj.getTime()) break;
          
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          const day = currentDate.getDate();
          
          const dayStart = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
          const dayEnd = getUtcForLocalDateTime(year, month, day, 24, 0, timezone);
          
          const dayStartMs = dayStart.getTime();
          const dayEndMs = dayEnd.getTime();
          
          // Check if there is at least one busy slot overlapping with this day.
          const hasBusySlot = coachBusyEvents.some(event => {
            const evStartMs = new Date(event.start.dateTime).getTime();
            const evEndMs = new Date(event.end.dateTime).getTime();
            return evStartMs < dayEndMs && evEndMs > dayStartMs;
          });
          
          if (!hasBusySlot) {
            coachBusyEvents.push({
              id: `stale-block-${coach.userId}-${year}-${month}-${day}`,
              summary: 'Busy',
              start: { dateTime: dayStart.toISOString() },
              end: { dateTime: dayEnd.toISOString() }
            });
          }
        }
      }
    }

  }

  return coachesBusySlots;
};
