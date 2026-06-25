import type { CalendarEvent } from '../services/googleCalendar';
import { type UserProfile, formatDisplayName } from '../services/firebaseService';

export const getParticipantNames = (
  event: CalendarEvent, 
  currentUserId?: string, 
  currentUserProfile?: UserProfile | null, 
  coaches: UserProfile[] = []
) => {
  let coachName = 'Coach';
  if (event.coachUid) {
    if (event.coachUid === currentUserId && currentUserProfile) {
      coachName = formatDisplayName(currentUserProfile) || 'Coach';
    } else {
      const found = coaches.find(c => c.userId === event.coachUid);
      if (found) coachName = formatDisplayName(found) || 'Coach';
    }
  }
  if (coachName === 'Coach' && event.attendees?.[0]) {
    coachName = event.attendees[0].displayName || event.attendees[0].email;
  }

  let clientName = 'Client';
  if (event.clientUid) {
    if (event.clientUid === currentUserId && currentUserProfile) {
      clientName = formatDisplayName(currentUserProfile) || 'Client';
    } else {
      const found = coaches.find(c => c.userId === event.clientUid);
      if (found) clientName = formatDisplayName(found) || 'Client';
    }
  }
  if (clientName === 'Client' && event.attendees?.[1]) {
    clientName = event.attendees[1].displayName || event.attendees[1].email;
  }

  // Fallback to parsing summary if attendees failed
  if ((coachName === 'Coach' || clientName === 'Client') && event.summary) {
    const parts = event.summary.split('-');
    if (parts.length >= 2) {
      const namePart = parts[0].trim();
      const names = namePart.split('/');
      if (names.length === 2) {
        if (coachName === 'Coach') coachName = names[0].trim();
        if (clientName === 'Client') clientName = names[1].trim();
      }
    }
  }

  return { coachName, clientName };
};

export const getBookingTopic = (event: CalendarEvent) => {
  if (!event.description) {
    // try to parse from summary
    if (event.summary && event.summary.includes('-')) {
      const parts = event.summary.split('-');
      parts.shift(); // remove names
      return parts.join('-').trim();
    }
    return event.summary;
  }
  
  if (event.description.includes('Peer Coaching Network session on the topic: ')) {
    return event.description
      .replace('Peer Coaching Network session on the topic: ', '')
      .replace('. Created via PCN.', '')
      .trim();
  }
  const match = event.description.match(/-\s*Topic:\s*([^\n\r]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Try parsing from summary if description doesn't match format
  if (event.summary && event.summary.includes('-')) {
    const parts = event.summary.split('-');
    parts.shift();
    return parts.join('-').trim();
  }
  
  return event.summary;
};
