import type { UserProfile, AvailableDays } from './firebaseService';
import { db, auth, recalculateUserBusySlotsCache, getSchedule, timestampToTimeString } from './firebaseService';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, documentId, runTransaction, Timestamp } from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';
import { getGoogleToken } from './googleToken';
import { BOOKING_HORIZON_DAYS, ENABLE_GOOGLE_INTEGRATION } from '../config';

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
      console.error('Error fetching real Google Calendar events:', e);
    }
  }

  // Always query Firestore bookings where the current user is host or client (by
  // stable userId, not email) and merge. See BUG-019.
  const currentUser = auth?.currentUser;
  if (currentUser && db) {
    try {
      const qClient = query(collection(db, 'bookings'), where('clientUid', '==', currentUser.uid));
      const snapClient = await getDocs(qClient);

      const qHost = query(collection(db, 'bookings'), where('coachUid', '==', currentUser.uid));
      const snapHost = await getDocs(qHost);

      const profileCache = new Map<string, UserProfile>();
      const getProfile = async (uid: string): Promise<UserProfile | null> => {
        if (profileCache.has(uid)) return profileCache.get(uid)!;
        const userSnap = await getDoc(doc(db, 'users', uid));
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
          if (data.status === 'cancelled') continue; // skip cancelled bookings (BUG-016)
          // De-duplicate strictly by stable id, never by coincidental start time. See BUG-010.
          if (!seenIds.has(data.bookingId)) {
            seenIds.add(data.bookingId);
            const startStr: string = data.startTime && typeof data.startTime.toDate === 'function'
              ? data.startTime.toDate().toISOString()
              : (data.startTime?.dateTime || data.startTime || '');
            const endStr: string = data.endTime && typeof data.endTime.toDate === 'function'
              ? data.endTime.toDate().toISOString()
              : (data.endTime?.dateTime || data.endTime || '');

            const coachProfile = await getProfile(data.coachUid);
            const clientProfile = await getProfile(data.clientUid);

            const coachFirstName = coachProfile ? coachProfile.displayName.split(' ')[0] : 'Coach';
            const clientFirstName = clientProfile ? clientProfile.displayName.split(' ')[0] : 'Peer';

            events.push({
              id: data.bookingId,
              summary: `${coachFirstName} / ${clientFirstName} - Peer Coaching Session`,
              description: `Peer Coaching Network session on the topic: ${data.topic}. Created via PCN.`,
              start: { dateTime: startStr },
              end: { dateTime: endStr },
              meetLink: data.googleMeetLink,
              type: 'peer-coaching',
              coachUid: data.coachUid,
              clientUid: data.clientUid,
              attendees: [
                { email: coachProfile?.email || '', displayName: coachProfile?.displayName || '' },
                { email: clientProfile?.email || '', displayName: clientProfile?.displayName || '' }
              ]
            });
          }
        }
      };

      await processSnap(snapClient);
      await processSnap(snapHost);
    } catch (err) {
      console.error('Error querying bookings from Firestore:', err);
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

  const coachFirstName = coachName.replace(/\s*\([^)]*\)/g, '').trim().split(' ')[0] || 'Coach';
  const clientFirstName = clientName.replace(/\s*\([^)]*\)/g, '').trim().split(' ')[0] || 'Peer';

  const eventPayload = {
    summary: `${coachFirstName} / ${clientFirstName} - Peer Coaching Session`,
    description: `Peer Coaching Network session on the topic: ${topic}. Created via PCN.`,
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
          type: 'hangoutMeet',
        },
      },
    },
  };

  // Deterministic per-slot document id so a coach can't be double-booked for the
  // same time. See BUG-004.
  const bookingId = `${coachUid}_${startIso}`;

  const currentUser = auth?.currentUser;
  const clientEmail = currentUser?.email || '';
  const resolvedClientName = currentUser?.displayName || clientName;

  let realMeetLink = meetLink;
  let googleEventId = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let googleEventCreated = false;

  if (ENABLE_GOOGLE_INTEGRATION && token) {
    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
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
        console.error('Google Calendar API Error:', response.status, errorText);

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
      console.error('Error during Google Calendar event creation:', e);
      if (e instanceof Error && (e as { code?: string }).code === 'GOOGLE_API_ERROR') {
        throw e;
      }
      const genericError = new Error('Network error or Google Calendar API is currently unreachable. Please try again.');
      (genericError as { code?: string }).code = 'GOOGLE_API_ERROR';
      throw genericError;
    }
  }

  if (db) {
    const bookingRef = doc(db, 'bookings', bookingId);
    const clientBookingCacheRef = doc(db, 'clientBookingCache', `${clientUid}_${startIso}`);

    const bookingData = {
      bookingId,
      googleEventId,
      googleMeetLink: realMeetLink,
      status: 'confirmed',
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
          const existing = await tx.get(bookingRef);
          if (existing.exists() && existing.data()?.status !== 'cancelled') {
            throw new Error('SLOT_TAKEN');
          }
          const clientBookingCacheDoc = await tx.get(clientBookingCacheRef);
          if (clientBookingCacheDoc.exists()) {
            throw new Error('SELF_CONFLICT');
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
        if (err instanceof Error && (err.message === 'SLOT_TAKEN' || err.message === 'SELF_CONFLICT')) {
          break;
        }
        console.warn(`Firestore transaction attempt ${attempts} failed:`, err);
        // Wait a short duration before retrying (exponential backoff)
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
        }
      }
    }

    if (!transactionSuccess) {
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
          console.log('Cleaned up Google Calendar event after Firestore transaction failure:', googleEventId);
        } catch (cleanupErr) {
          console.error('Failed to cleanup Google Calendar event:', cleanupErr);
        }
      }
      throw lastError || new Error('FAILED_TO_PERSIST');
    }

    // Recalculate ONLY the current user's own busy slots cache. The other
    // participant's cache is owner-only now; their booked time is surfaced live
    // from the bookings overlay in getCoachesBusySlots. See BUG-001.
    if (currentUser?.uid) {
      recalculateUserBusySlotsCache(currentUser.uid).catch(err => {
        console.error('Error recalculating busy slots cache:', err);
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
    type: 'peer-coaching',
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
  const ref = doc(db, 'bookings', bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();

  await updateDoc(ref, { status: 'cancelled', cancelledAt: Timestamp.now() });

  // Release the mentee's per-slot hold so that time can be rebooked. See BUG-003.
  const startIso = data.startTime && typeof data.startTime.toDate === 'function'
    ? data.startTime.toDate().toISOString()
    : (data.startTime?.dateTime || data.startTime);
  if (data.clientUid && startIso) {
    try {
      await deleteDoc(doc(db, 'clientBookingCache', `${data.clientUid}_${startIso}`));
    } catch (e) {
      console.error('Error releasing client booking cache:', e);
    }
  }

  const token = getGoogleToken();
  if (ENABLE_GOOGLE_INTEGRATION && token && data.googleEventId) {
    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${data.googleEventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (e) {
      console.error('Error deleting Google Calendar event:', e);
    }
  }

  const currentUid = auth?.currentUser?.uid;
  if (currentUid) {
    recalculateUserBusySlotsCache(currentUid).catch(err => console.error('Recalc error:', err));
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

  // Try to load FreeBusy information from Google Calendar if a valid token is present
  if (ENABLE_GOOGLE_INTEGRATION && token) {
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
            items: coaches.map(c => ({ id: c.email })),
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
      console.error('Error fetching real Google Calendar FreeBusy info:', e);
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
    busySlotsCacheResults.forEach((res) => {
      if (res.status !== 'fulfilled') {
        console.error('Error fetching busy slots cache chunk:', res.reason);
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
