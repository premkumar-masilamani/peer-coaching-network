import { describe, it, expect, vi } from 'vitest';
import type { CalendarEvent } from '../../services/googleCalendar';

vi.mock('../../services/firebaseService', () => ({
  formatDisplayName: (u: { displayName?: string } | null | undefined) => u?.displayName || 'Coach',
}));

import { getParticipantNames, getBookingTopic } from '../calendarHelpers';

describe('calendarHelpers', () => {
  it('extracts participant names from summary', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'Alice / Bob - Peer Coaching',
      start: { dateTime: '2026-09-01T10:00:00Z' },
      end: { dateTime: '2026-09-01T10:30:00Z' },
    };
    const names = getParticipantNames(event);
    expect(names.coachName).toBe('Alice');
    expect(names.clientName).toBe('Bob');
  });

  it('extracts topic from event description or summary', () => {
    const event: CalendarEvent = {
      id: 'event-1',
      summary: 'Alice / Bob - Career Growth',
      description: '- Topic: Career Growth\nCoach: Alice (alice@test.com)',
      start: { dateTime: '2026-09-01T10:00:00Z' },
      end: { dateTime: '2026-09-01T10:30:00Z' },
    };
    expect(getBookingTopic(event)).toBe('Career Growth');
  });
});
