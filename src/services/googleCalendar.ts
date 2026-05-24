import type { UserProfile } from './firebaseService';
import { db, auth, recalculateUserAvailability, DEFAULT_TEMPLATE } from './firebaseService';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import { getLocalDateInTimezone, getUtcForLocalDateTime, parseLocalTime } from '../utils/timezoneHelpers';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  meetLink?: string;
  attendees?: { email: string; displayName?: string }[];
}

export const isCalendarSynced = (): boolean => {
  return sessionStorage.getItem('google_access_token') !== null;
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

export const getUpcomingEvents = async (isRealFirebase: boolean): Promise<CalendarEvent[]> => {
  const token = sessionStorage.getItem('google_access_token');
  const events: CalendarEvent[] = [];
  const seenIds = new Set<string>();
  
  // Try to load from Google Calendar if a valid token is present
  if (isRealFirebase && token && token !== 'mock_google_access_token') {
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

  // Always query Firestore bookings where the current user is host or client and merge
  const currentUser = auth?.currentUser;
  if (currentUser && db) {
    try {
      const qClient = query(collection(db, 'bookings'), where('clientEmail', '==', currentUser.email));
      const snapClient = await getDocs(qClient);

      const qHost = query(collection(db, 'bookings'), where('hostEmail', '==', currentUser.email));
      const snapHost = await getDocs(qHost);

      const processSnap = (snap: QuerySnapshot<DocumentData>) => {
        snap.forEach((d) => {
          const data = d.data();
          if (!seenIds.has(data.id)) {
            // Check if there is already an event starting at the same time to avoid overlaps
            const startStr: string = typeof data.start === 'string' ? data.start : (data.start?.dateTime || '');
            const hasDuplicateTime = events.some(
              e => new Date(e.start.dateTime).getTime() === new Date(startStr).getTime()
            );
            if (!hasDuplicateTime) {
              seenIds.add(data.id);
              events.push({
                id: data.id,
                summary: data.summary,
                description: data.description,
                start: { dateTime: startStr },
                end: { dateTime: typeof data.end === 'string' ? data.end : (data.end?.dateTime || '') },
                meetLink: data.meetLink,
                attendees: [
                  { email: data.hostEmail, displayName: data.hostName },
                  { email: data.clientEmail, displayName: data.clientName }
                ]
              });
            }
          }
        });
      };

      processSnap(snapClient);
      processSnap(snapHost);
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
  isRealFirebase: boolean,
  coachUid: string,
  coachEmail: string,
  coachName: string,
  menteeUid: string,
  clientName: string,
  startIso: string,
  endIso: string,
  topic: string
): Promise<CalendarEvent> => {
  const token = sessionStorage.getItem('google_access_token');
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

  let realMeetLink = meetLink;
  let googleEventId = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  if (isRealFirebase && token && token !== 'mock_google_access_token') {
    try {
      // POST event to Google Calendar, with conferenceDataVersion=1 to generate Meet link
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

      if (response.ok) {
        const data = await response.json();
        googleEventId = data.id;
        realMeetLink = data.hangoutLink || meetLink;
      }
    } catch (e) {
      console.error('Error creating real Google Calendar event:', e);
    }
  }

  // Always save booking to Firestore bookings collection
  const currentUser = auth?.currentUser;
  const clientEmail = currentUser?.email || '';
  const clientUid = currentUser?.uid || '';
  const resolvedClientName = currentUser?.displayName || clientName;

  const newBooking: CalendarEvent = {
    id: googleEventId,
    summary: eventPayload.summary,
    description: eventPayload.description,
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    meetLink: realMeetLink,
    attendees: [
      { email: coachEmail, displayName: coachName },
      { email: clientEmail, displayName: resolvedClientName }
    ]
  };

  if (db) {
    try {
      const docRef = doc(db, 'bookings', googleEventId);
      await setDoc(docRef, {
        id: googleEventId,
        summary: eventPayload.summary,
        description: eventPayload.description,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
        meetLink: realMeetLink,
        topic,
        hostEmail: coachEmail,
        hostName: coachName,
        clientEmail,
        clientName: resolvedClientName,
        clientUid,
        coachUid,
        menteeUid,
        createdAt: new Date().toISOString()
      });

      // Trigger background recalculations
      recalculateUserAvailability(coachUid).catch(err => {
        console.error(`Error recalculating availability for coach ${coachUid}:`, err);
      });
      recalculateUserAvailability(menteeUid).catch(err => {
        console.error(`Error recalculating availability for mentee ${menteeUid}:`, err);
      });

    } catch (err) {
      console.error('Error saving booking to Firestore:', err);
    }
  }

  return newBooking;
};

export const generateFallbackBusySlots = (
  coach: UserProfile,
  timeMinStr: string,
  timeMaxStr: string
): CalendarEvent[] => {
  const timezone = coach.timezone || 'UTC';
  const template = coach.availabilityTemplate || DEFAULT_TEMPLATE;
  const weekly = template.weekly || DEFAULT_TEMPLATE.weekly;
  const blockedDates = template.blockedDates || [];
  
  const timeMin = new Date(timeMinStr);
  const timeMax = new Date(timeMaxStr);
  
  const localToday = getLocalDateInTimezone(timeMin, timezone);
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  const busyEvents: CalendarEvent[] = [];
  
  for (let i = 0; i < 56; i++) {
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
        id: `fallback-block-${coach.uid}-${dateStr}`,
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
        id: `fallback-sched-${coach.uid}-${dateStr}`,
        summary: 'Busy',
        start: { dateTime: dayStart.toISOString() },
        end: { dateTime: dayEnd.toISOString() }
      });
    } else {
      const sortedSlots = [...daySched.slots].map(s => {
        const parsedStart = parseLocalTime(s.start);
        const parsedEnd = parseLocalTime(s.end);
        return {
          startMin: parsedStart.hour * 60 + parsedStart.minute,
          endMin: parsedEnd.hour * 60 + parsedEnd.minute,
          startStr: s.start,
          endStr: s.end
        };
      }).sort((a, b) => a.startMin - b.startMin);
      
      if (sortedSlots[0].startMin > 0) {
        const startUtc = getUtcForLocalDateTime(year, month, day, 0, 0, timezone);
        const parsedS = parseLocalTime(sortedSlots[0].startStr);
        const endUtc = getUtcForLocalDateTime(year, month, day, parsedS.hour, parsedS.minute, timezone);
        busyEvents.push({
          id: `fallback-gap1-${coach.uid}-${dateStr}`,
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
            id: `fallback-gap2-${coach.uid}-${dateStr}-${j}`,
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
          id: `fallback-gap3-${coach.uid}-${dateStr}`,
          summary: 'Busy',
          start: { dateTime: startUtc.toISOString() },
          end: { dateTime: endUtc.toISOString() }
        });
      }
    }
  }
  
  return busyEvents;
};

export const getCoachesAvailability = async (
  isRealFirebase: boolean,
  coaches: UserProfile[],
  timeMin: string,
  timeMax: string
): Promise<Record<string, CalendarEvent[]>> => {
  const token = sessionStorage.getItem('google_access_token');
  const availability: Record<string, CalendarEvent[]> = {};

  coaches.forEach((coach) => {
    availability[coach.uid] = [];
  });

  // Try to load FreeBusy information from Google Calendar if a valid token is present
  if (isRealFirebase && token && token !== 'mock_google_access_token') {
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
          
          availability[coach.uid] = busyIntervals.map((interval: { start: string; end: string }, idx: number) => ({
            id: `busy-${coach.uid}-${idx}`,
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

  // Load computed availability busy slots from Firestore
  if (db) {
    try {
      const availabilityCol = collection(db, 'availability');
      const querySnap = await getDocs(availabilityCol);
      const foundUids = new Set<string>();

      querySnap.forEach((d) => {
        const data = d.data();
        const matchingCoach = coaches.find(c => c.uid === data.uid);
        if (matchingCoach) {
          foundUids.add(matchingCoach.uid);
          const busySlots = data.busySlots || [];
          busySlots.forEach((slot: { start: string; end: string; id?: string }, idx: number) => {
            const startStr = slot.start;
            const endStr = slot.end;
            // Avoid duplicate events if already loaded from Google Calendar FreeBusy
            const isAlreadyAdded = availability[matchingCoach.uid].some((event) => {
              return event.id === slot.id || 
                (new Date(event.start.dateTime).getTime() === new Date(startStr).getTime());
            });

            if (!isAlreadyAdded) {
              availability[matchingCoach.uid].push({
                id: slot.id || `busy-${matchingCoach.uid}-${idx}`,
                summary: 'Busy',
                start: { dateTime: startStr },
                end: { dateTime: endStr }
              });
            }
          });
        }
      });

      // Self-healing fallback for missing availability documents
      for (const coach of coaches) {
        if (!foundUids.has(coach.uid)) {
          console.log(`Availability document missing for coach ${coach.uid}, generating fallback and triggering recalculation...`);
          const fallbackSlots = generateFallbackBusySlots(coach, timeMin, timeMax);
          availability[coach.uid] = [...availability[coach.uid], ...fallbackSlots];
          
          // Trigger background recalculation
          recalculateUserAvailability(coach.uid).catch(err => {
            console.error(`Background recalculation error for coach ${coach.uid}:`, err);
          });
        }
      }

    } catch (err) {
      console.error('Error fetching availability from Firestore:', err);
    }
  }

  return availability;
};
