import type { UserProfile } from './firebaseService';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  meetLink?: string;
  attendees?: { email: string; displayName?: string }[];
}

const SCHEDULED_MEETINGS_KEY = 'pcn_scheduled_meetings';

// Seed default calendar events if empty (mock user's private calendar events)
const getMockCalendarEvents = (): CalendarEvent[] => {
  const localScheduled = JSON.parse(localStorage.getItem(SCHEDULED_MEETINGS_KEY) || '[]');
  
  // Seed some default blocks to show busy states
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const seedEvents: CalendarEvent[] = [
    {
      id: 'busy-1',
      summary: 'Focused Coaching Prep (Busy)',
      start: { dateTime: new Date(today.setHours(9, 0, 0, 0)).toISOString() },
      end: { dateTime: new Date(today.setHours(10, 0, 0, 0)).toISOString() },
    },
    {
      id: 'busy-2',
      summary: 'Client Session (Busy)',
      start: { dateTime: new Date(today.setHours(14, 0, 0, 0)).toISOString() },
      end: { dateTime: new Date(today.setHours(15, 30, 0, 0)).toISOString() },
    },
    {
      id: 'busy-3',
      summary: 'Team Alignment (Busy)',
      start: { dateTime: new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString() },
      end: { dateTime: new Date(tomorrow.setHours(12, 0, 0, 0)).toISOString() },
    }
  ];

  return [...seedEvents, ...localScheduled];
};

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
      if (!response.ok) {
        throw new Error('Failed to fetch events from Google Calendar');
      }
      const data = await response.json();
      
      // Map Google items to our simpler interface
      return (data.items || []).map((item: GoogleCalendarEvent) => ({
        id: item.id,
        summary: item.summary || 'Busy Slot',
        description: item.description,
        start: { dateTime: item.start?.dateTime || item.start?.date || '' },
        end: { dateTime: item.end?.dateTime || item.end?.date || '' },
        meetLink: item.hangoutLink || undefined,
        attendees: item.attendees?.map((a: { email: string; displayName?: string }) => ({ email: a.email, displayName: a.displayName }))
      }));
    } catch (e) {
      console.error('Error fetching real Google Calendar events:', e);
      return getMockCalendarEvents(); // Fallback to mock if API fails
    }
  } else {
    // Mock Mode
    return getMockCalendarEvents();
  }
};

export const scheduleMeeting = async (
  isRealFirebase: boolean,
  coachEmail: string,
  coachName: string,
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

      if (!response.ok) {
        throw new Error('Failed to create calendar event');
      }

      const data = await response.json();
      return {
        id: data.id,
        summary: data.summary,
        description: data.description,
        start: { dateTime: data.start.dateTime },
        end: { dateTime: data.end.dateTime },
        meetLink: data.hangoutLink || meetLink, // Fallback if Meet link generation pending
        attendees: data.attendees
      };
    } catch (e) {
      console.error('Error creating real Google Calendar event:', e);
      // Fall back to Mock save
    }
  }

  // Mock Calendar Save
  const newMockEvent: CalendarEvent = {
    id: `mock-event-${Date.now()}`,
    summary: eventPayload.summary,
    description: eventPayload.description,
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    meetLink: meetLink,
    attendees: [{ email: coachEmail, displayName: coachName }]
  };

  const currentScheduled = JSON.parse(localStorage.getItem(SCHEDULED_MEETINGS_KEY) || '[]');
  currentScheduled.push(newMockEvent);
  localStorage.setItem(SCHEDULED_MEETINGS_KEY, JSON.stringify(currentScheduled));

  return newMockEvent;
};

export const getCoachesAvailability = async (
  isRealFirebase: boolean,
  coaches: UserProfile[],
  timeMin: string,
  timeMax: string
): Promise<Record<string, CalendarEvent[]>> => {
  const token = sessionStorage.getItem('google_access_token');
  const availability: Record<string, CalendarEvent[]> = {};

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

      if (!response.ok) {
        throw new Error('Failed to query FreeBusy status from Google Calendar API');
      }

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

      return availability;
    } catch (e) {
      console.error('Error fetching real Google Calendar FreeBusy info:', e);
    }
  }

  // Mock Fallback
  const allScheduled = JSON.parse(localStorage.getItem(SCHEDULED_MEETINGS_KEY) || '[]');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  coaches.forEach((coach) => {
    const mockEvents: CalendarEvent[] = [];
    
    if (coach.uid === 'coach-1') {
      const d1Start = new Date(today);
      d1Start.setUTCHours(14, 0, 0, 0);
      const d1End = new Date(today);
      d1End.setUTCHours(15, 0, 0, 0);

      mockEvents.push({
        id: `mock-busy-${coach.uid}-1`,
        summary: 'Focused Prep (Busy)',
        start: { dateTime: d1Start.toISOString() },
        end: { dateTime: d1End.toISOString() },
      });
    } else if (coach.uid === 'coach-2') {
      const d2Start = new Date(tomorrow);
      d2Start.setUTCHours(17, 0, 0, 0);
      const d2End = new Date(tomorrow);
      d2End.setUTCHours(18, 30, 0, 0);

      mockEvents.push({
        id: `mock-busy-${coach.uid}-1`,
        summary: 'Executive Coaching (Busy)',
        start: { dateTime: d2Start.toISOString() },
        end: { dateTime: d2End.toISOString() },
      });
    }

    const relevantSessions = allScheduled.filter((session: CalendarEvent) => {
      const isAttendee = session.attendees?.some((att: { email: string; displayName?: string }) => att.email === coach.email);
      const isSummaryMatch = session.summary.includes(coach.displayName || '');
      return isAttendee || isSummaryMatch;
    });

    availability[coach.uid] = [...mockEvents, ...relevantSessions];
  });

  return availability;
};
