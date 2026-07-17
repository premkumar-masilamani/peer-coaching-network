import type { UserProfile, AvailableDays } from './types';
import { db, auth } from './firebaseApp';
import { getSchedule } from './scheduleService';
import { formatDisplayName, getProfiles } from './profileService';
import { chunkArray } from '../utils/chunkArray';
import { generateTemplateSlots } from '../utils/slotGeneration';
import type { DocumentData } from 'firebase/firestore';
import {
  getBooking,
  fetchUpcomingBookingsByClient,
  fetchUpcomingBookingsByCoach,
  fetchBookingsByClient,
  fetchBookingsByCoach,
  fetchPersonalAvailabilityCacheChunk,
  reserveBookingSlots,
  confirmBooking,
  rollbackBooking,
  cancelBookingDoc,
  deleteBusySlot,
  deleteClientBookingLock,
  setBookingGoogleMeetLink,
} from './firestoreRepository';
import { getGoogleToken, clearGoogleToken } from './googleToken';
import { BOOKING_HORIZON_DAYS, ENABLE_GOOGLE_INTEGRATION, LOG_SEVERITY, BOOKING_STATUS, EVENT_TYPE, GOOGLE_EVENTS_PAGE_SIZE } from '../config';
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

// True unless a booking is cancelled or an already-expired pending hold.
const isBookingLive = (data: DocumentData): boolean => {
  if (data.status === BOOKING_STATUS.CANCELLED) return false;
  if (data.status === BOOKING_STATUS.PENDING && data.expireAt) {
    const expireTime = data.expireAt.toDate().getTime();
    if (expireTime < Date.now()) return false;
  }
  return true;
};

const bookingStartIso = (data: DocumentData): string =>
  data.startTime && typeof data.startTime.toDate === 'function'
    ? data.startTime.toDate().toISOString()
    : (data.startTime?.dateTime || data.startTime || '');

const bookingEndIso = (data: DocumentData): string =>
  data.endTime && typeof data.endTime.toDate === 'function'
    ? data.endTime.toDate().toISOString()
    : (data.endTime?.dateTime || data.endTime || '');

export const getUpcomingEvents = async (): Promise<CalendarEvent[]> => {
  const token = getGoogleToken();
  const events: CalendarEvent[] = [];
  const seenIds = new Set<string>();

  // Try to load from Google Calendar if a valid token is present
  if (ENABLE_GOOGLE_INTEGRATION && token) {
    try {
      // Window the query to the booking horizon and page through results.
      // Without timeMax/maxResults + nextPageToken, Google caps a list response
      // at 250 events and silently truncates busy calendars — making a busy user
      // look free. We bound the window to [now, now + horizon] and follow pages.
      const timeMin = new Date().toISOString();
      const timeMaxDate = new Date();
      timeMaxDate.setDate(timeMaxDate.getDate() + BOOKING_HORIZON_DAYS);
      const timeMax = timeMaxDate.toISOString();

      let pageToken: string | undefined;
      // Safety cap: bound the page count so a pathological API response that
      // keeps returning a nextPageToken can never loop forever. Within a 30-day
      // window at 250 events/page this ceiling is far beyond any real calendar.
      let pagesRemaining = 40;
      do {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: String(GOOGLE_EVENTS_PAGE_SIZE),
        });
        if (pageToken) params.set('pageToken', pageToken);

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) {
          // Previously swallowed with no else branch: the user saw an empty
          // calendar instead of a reason. A 401 means the token is no longer
          // valid — clear it and record the telemetry. A subsequent booking or
          // cancel then hits the null-token path and forces a fresh OAuth
          // redirect.
          if (response.status === 401) {
            clearGoogleToken();
            await logger.telemetry(LOG_SEVERITY.ERROR, 'fetch_events_failure', {
              errorCode: TelemetryErrors.GOOGLE_TOKEN_EXPIRED.code,
              errorMessage: TelemetryErrors.GOOGLE_TOKEN_EXPIRED.message,
              error: `Google Calendar events request returned 401`,
            });
          } else {
            await logger.telemetry(LOG_SEVERITY.ERROR, 'fetch_events_failure', {
              errorCode: TelemetryErrors.FETCH_EVENTS_FAILURE.code,
              errorMessage: TelemetryErrors.FETCH_EVENTS_FAILURE.message,
              error: `Google Calendar events request returned ${response.status}`,
            });
          }
          break;
        }

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
        pageToken = data.nextPageToken;
      } while (pageToken && --pagesRemaining > 0);
    } catch (e) {
      logger.error('Error fetching real Google Calendar events:', e);
      await logger.telemetry(LOG_SEVERITY.ERROR, 'fetch_events_failure', {
        errorCode: TelemetryErrors.FETCH_EVENTS_FAILURE.code,
        errorMessage: TelemetryErrors.FETCH_EVENTS_FAILURE.message,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  // Always read the current user's upcoming bookings (as host or client, by
  // stable userId) and merge them with the Google Calendar events.
  const currentUser = auth?.currentUser;
  if (currentUser && db) {
    try {
      const clientBookings = await fetchUpcomingBookingsByClient(currentUser.uid);
      const hostBookings = await fetchUpcomingBookingsByCoach(currentUser.uid);

      const uids = new Set<string>();
      const collectUids = (bookings: DocumentData[]) => {
        bookings.forEach((data) => {
          if (!isBookingLive(data)) return;
          if (data.coachUid) uids.add(data.coachUid);
          if (data.clientUid) uids.add(data.clientUid);
        });
      };
      collectUids(clientBookings);
      collectUids(hostBookings);

      // Batch-hydrate the participant profiles (avoids N+1 per-uid reads).
      const profilesList = await getProfiles(Array.from(uids));
      const profileMap = new Map<string, UserProfile>();
      profilesList.forEach((profile) => profileMap.set(profile.userId, profile));

      const processBookings = (bookings: DocumentData[]) => {
        for (const data of bookings) {
          if (!isBookingLive(data)) continue;

          const existingEvent = events.find(e => (data.googleEventId && e.id === data.googleEventId) || e.id === data.bookingId);
          if (existingEvent) {
            existingEvent.type = EVENT_TYPE.PEER_COACHING;
            existingEvent.coachUid = data.coachUid;
            existingEvent.clientUid = data.clientUid;
            if (data.topic) {
              existingEvent.description = `Peer Coaching Network session on the topic: ${data.topic}. Created via PCN.`;
            }
            if (existingEvent.meetLink && !data.googleMeetLink) {
              // Self-heal a booking that is missing its stored meet link.
              setBookingGoogleMeetLink(data.bookingId, existingEvent.meetLink).catch((err) => {
                logger.error(`Failed to self-heal googleMeetLink for booking ${data.bookingId}:`, err);
              });
            } else if (!existingEvent.meetLink && data.googleMeetLink) {
              existingEvent.meetLink = data.googleMeetLink;
            }
          } else if (!seenIds.has(data.bookingId)) {
            seenIds.add(data.bookingId);

            const coachProfile = profileMap.get(data.coachUid) || null;
            const clientProfile = profileMap.get(data.clientUid) || null;

            const coachFirstName = coachProfile ? (coachProfile.firstName || (formatDisplayName(coachProfile) || 'Coach').split(' ')[0]) : 'Coach';
            const clientFirstName = clientProfile ? (clientProfile.firstName || (formatDisplayName(clientProfile) || 'Peer').split(' ')[0]) : 'Peer';

            events.push({
              id: data.bookingId,
              summary: `${coachFirstName} / ${clientFirstName} - Peer Coaching Session`,
              description: `Peer Coaching Network session on the topic: ${data.topic}. Created via PCN.`,
              start: { dateTime: bookingStartIso(data) },
              end: { dateTime: bookingEndIso(data) },
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

      processBookings(clientBookings);
      processBookings(hostBookings);
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

// Upcoming peer-coaching sessions for a single coach (by stable userId, in either
// role), enriched with participant profiles. Used by the admin coach-profile
// view. Cancelled bookings are omitted and duplicates are collapsed by bookingId.
export const getCoachSessions = async (coachUid: string): Promise<CalendarEvent[]> => {
  if (!db) return [];

  const [asClient, asCoach] = await Promise.all([
    fetchBookingsByClient(coachUid),
    fetchBookingsByCoach(coachUid),
  ]);

  const uids = new Set<string>();
  const collectUids = (bookings: DocumentData[]) => {
    bookings.forEach((data) => {
      if (data.status === BOOKING_STATUS.CANCELLED) return;
      if (data.coachUid) uids.add(data.coachUid);
      if (data.clientUid) uids.add(data.clientUid);
    });
  };
  collectUids(asClient);
  collectUids(asCoach);

  const profilesList = await getProfiles(Array.from(uids));
  const profileMap = new Map<string, UserProfile>();
  profilesList.forEach((profile) => profileMap.set(profile.userId, profile));

  const meetings: CalendarEvent[] = [];
  const seenIds = new Set<string>();

  const processBookings = (bookings: DocumentData[]) => {
    for (const data of bookings) {
      if (data.status === BOOKING_STATUS.CANCELLED) continue;
      if (seenIds.has(data.bookingId)) continue;
      seenIds.add(data.bookingId);

      const coachProfile = profileMap.get(data.coachUid) || null;
      const clientProfile = profileMap.get(data.clientUid) || null;

      const coachFirstName = coachProfile ? (coachProfile.firstName || (formatDisplayName(coachProfile) || 'Coach').split(' ')[0]) : 'Coach';
      const clientFirstName = clientProfile ? (clientProfile.firstName || (formatDisplayName(clientProfile) || 'Peer').split(' ')[0]) : 'Peer';

      meetings.push({
        id: data.bookingId,
        summary: `${coachFirstName} / ${clientFirstName} - Peer Coaching Session`,
        description: `Topic: ${data.topic}`,
        start: { dateTime: bookingStartIso(data) },
        end: { dateTime: bookingEndIso(data) },
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
  };

  processBookings(asClient);
  processBookings(asCoach);

  meetings.sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
  return meetings;
};

const getDeterministicRequestId = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const chr = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'req-' + Math.abs(hash).toString(36) + id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
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
  let fallbackMeetLink = '';
  if (!ENABLE_GOOGLE_INTEGRATION) {
    const meetId = Math.random().toString(36).substring(2, 5) + '-' +
                   Math.random().toString(36).substring(2, 6) + '-' +
                   Math.random().toString(36).substring(2, 5);
    fallbackMeetLink = `https://meet.google.com/${meetId}`;
  }

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

  const bookingId = `${coachUid}_${startIso}`;

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
        requestId: getDeterministicRequestId(bookingId),
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  };
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

  let realMeetLink = fallbackMeetLink;
  let googleEventId = `mock-booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Step 1: Atomically claim the slot (booking + busy slot + client locks).
  await reserveBookingSlots({ bookingId, coachUid, clientUid, startIso, endIso, topic });

  // Rollback helper for the Google Calendar failure paths below.
  const rollback = () =>
    rollbackBooking({ bookingId, clientUid, startIso, endIso }).catch((e) =>
      logger.error('Error rolling back booking after Google Calendar failure:', e)
    );

  // Step 2: Attempt Google Calendar Event Creation if integration enabled
  if (ENABLE_GOOGLE_INTEGRATION) {
    if (!token) {
      await rollback();
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
        await rollback();

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
      realMeetLink = data.hangoutLink || '';

      if (!realMeetLink && ENABLE_GOOGLE_INTEGRATION) {
        let retryCount = 0;
        const maxRetries = 3;
        let delay = 1000;
        while (retryCount < maxRetries && !realMeetLink) {
          logger.info(`Google hangoutLink missing. Retrying event fetch (attempt ${retryCount + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          try {
            const getResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (getResponse.ok) {
              const getData = await getResponse.json();
              if (getData.hangoutLink) {
                realMeetLink = getData.hangoutLink;
                logger.info(`Google hangoutLink fetched successfully on retry ${retryCount + 1}: ${realMeetLink}`);
              }
            }
          } catch (err) {
            logger.warn(`Failed to fetch event on retry ${retryCount + 1}:`, err);
          }
          retryCount++;
          delay *= 2;
        }
      }
    } catch (e) {
      if ((e as ApiError).code === 'GOOGLE_TOKEN_EXPIRED' || (e as ApiError).code === 'GOOGLE_API_ERROR') {
        throw e;
      }

      await rollback();

      const genericError = new Error('Network error or Google Calendar API is currently unreachable. Please try again.');
      (genericError as ApiError).code = 'GOOGLE_API_ERROR';
      throw genericError;
    }
  }

  // Step 3: Confirm the booking with real IDs and extend the client-cache locks.
  await confirmBooking({ bookingId, clientUid, startIso, endIso, googleEventId, googleMeetLink: realMeetLink });

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
  const data = await getBooking(bookingId);
  if (!data) return;

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

  // Step 2: Cancel in Firestore (booking + public busy slot) and release locks.
  await cancelBookingDoc(bookingId);
  try {
    await deleteBusySlot(bookingId);
  } catch (e) {
    logger.error('Error deleting busy slot document:', e);
  }

  const startIso = data.startTime && typeof data.startTime.toDate === 'function'
    ? data.startTime.toDate().toISOString()
    : (data.startTime?.dateTime || data.startTime);
  if (data.clientUid && startIso) {
    try {
      await deleteClientBookingLock(data.clientUid, startIso);
      const durationMs = data.endTime.toDate().getTime() - data.startTime.toDate().getTime();
      if (durationMs > 30 * 60 * 1000) {
        const nextStartIso = new Date(data.startTime.toDate().getTime() + 30 * 60 * 1000).toISOString();
        await deleteClientBookingLock(data.clientUid, nextStartIso);
      }
    } catch (e) {
      logger.error('Error releasing client booking cache:', e);
    }
  }

  logger.info(`Successfully cancelled booking. Booking ID: ${bookingId}`);
};

// Template-only availability used when a coach has no precomputed cache document.
// Windowed to [timeMin, timeMax); delegates to the single shared slot generator
// so this path can never drift from the availability-cache recalculation.
export const generateFallbackAvailableSlots = (
  coach: UserProfile,
  schedule: { availableDays: AvailableDays; blockedDates: string[] },
  timeMinStr: string,
  timeMaxStr: string
): string[] => {
  const timeMin = new Date(timeMinStr);
  const timeMax = new Date(timeMaxStr);

  return generateTemplateSlots({
    availableDays: schedule.availableDays,
    blockedDates: schedule.blockedDates,
    timezone: coach.timezone || 'UTC',
    anchorDate: timeMin,
    horizonDays: BOOKING_HORIZON_DAYS,
    rangeStartMs: timeMin.getTime(),
    rangeEndMs: timeMax.getTime(),
  });
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
    const uids = coaches.map(c => c.userId);
    const uidChunks = chunkArray(uids, 30);

    const foundUids = new Set<string>();
    // Read the aggregate availability cache chunk-by-chunk (each chunk is a single
    // repository read) so a partial outage still yields the chunks that succeeded.
    const personalAvailabilityCacheResults = await Promise.allSettled(
      uidChunks.map(c => fetchPersonalAvailabilityCacheChunk(c))
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
      res.value.forEach((data, uid) => {
        if (!(uid in coachesAvailability)) return;
        foundUids.add(uid);
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
