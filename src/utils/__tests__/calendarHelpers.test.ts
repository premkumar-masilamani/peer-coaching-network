/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { getParticipantNames, getBookingTopic } from '../calendarHelpers';
import type { CalendarEvent } from '../../services/googleCalendar';

// calendarHelpers imports `formatDisplayName` from firebaseService which in turn
// bootstraps the entire Firebase SDK. Mock the module so tests stay lightweight.
vi.mock('../../services/firebaseService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/firebaseService')>();
  return {
    ...actual,
    // Real implementation — just `firstName lastName` concatenation
    formatDisplayName: (user: { firstName?: string; lastName?: string; displayName?: string | null } | null | undefined): string => {
      if (!user) return '';
      if (user.firstName || user.lastName) {
        return `${user.firstName || ''} ${user.lastName || ''}`.trim();
      }
      return (user.displayName || '').replace(/\s*\([^)]*\)/g, '').trim();
    },
  };
});

// Also mock Firebase app-level modules to prevent SDK init errors
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  connectAuthEmulator: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  Timestamp: { fromDate: vi.fn(), now: vi.fn() },
  deleteDoc: vi.fn(),
  orderBy: vi.fn(),
}));
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  logEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Minimal factory helpers
// ---------------------------------------------------------------------------

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({
    id: 'evt-1',
    summary: '',
    description: '',
    start: { dateTime: '2026-06-18T10:00:00Z' },
    end: { dateTime: '2026-06-18T11:00:00Z' },
    attendees: [],
    ...overrides,
  } as CalendarEvent);

type PartialProfile = { userId: string; firstName?: string; lastName?: string; displayName?: string };

const makeProfile = (overrides: PartialProfile): any => ({
  photoURL: null,
  gender: 'prefer_not_to_say',
  country: '',
  bio: '',
  timezone: 'UTC',
  userRole: 'coachee',
  userStatus: 'inactive',
  ...overrides,
});

// ---------------------------------------------------------------------------
// getParticipantNames
// ---------------------------------------------------------------------------

describe('calendarHelpers', () => {
  describe('getParticipantNames', () => {
    it('returns default names when no coachUid/clientUid and no attendees', () => {
      const { coachName, clientName } = getParticipantNames(makeEvent());
      expect(coachName).toBe('Coach');
      expect(clientName).toBe('Client');
    });

    it('resolves coachName from currentUserProfile when coachUid matches currentUserId', () => {
      const event = makeEvent({ coachUid: 'user-1' });
      const profile = makeProfile({ userId: 'user-1', firstName: 'Alice', lastName: 'Coach' });
      const { coachName } = getParticipantNames(event, 'user-1', profile);
      expect(coachName).toBe('Alice Coach');
    });

    it('resolves coachName from coaches list when coachUid differs from currentUserId', () => {
      const event = makeEvent({ coachUid: 'coach-99' });
      const coach = makeProfile({ userId: 'coach-99', firstName: 'Bob', lastName: 'Mentor' });
      const { coachName } = getParticipantNames(event, 'user-1', null, [coach]);
      expect(coachName).toBe('Bob Mentor');
    });

    it('resolves clientName from currentUserProfile when clientUid matches currentUserId', () => {
      const event = makeEvent({ clientUid: 'user-1' });
      const profile = makeProfile({ userId: 'user-1', firstName: 'Carol', lastName: 'Learner' });
      const { clientName } = getParticipantNames(event, 'user-1', profile);
      expect(clientName).toBe('Carol Learner');
    });

    it('resolves clientName from coaches list when clientUid differs from currentUserId', () => {
      const event = makeEvent({ clientUid: 'client-55' });
      const client = makeProfile({ userId: 'client-55', firstName: 'Dave', lastName: 'Student' });
      const { clientName } = getParticipantNames(event, 'user-1', null, [client]);
      expect(clientName).toBe('Dave Student');
    });

    it('falls back to attendees[0] displayName for coachName when uid not resolved', () => {
      const event = makeEvent({
        attendees: [
          { email: 'coach@example.com', displayName: 'Fallback Coach' },
          { email: 'client@example.com', displayName: 'Fallback Client' },
        ],
      });
      const { coachName, clientName } = getParticipantNames(event);
      expect(coachName).toBe('Fallback Coach');
      expect(clientName).toBe('Fallback Client');
    });

    it('falls back to attendees email when displayName is absent', () => {
      const event = makeEvent({
        attendees: [{ email: 'coach@example.com' }, { email: 'client@example.com' }],
      });
      const { coachName, clientName } = getParticipantNames(event);
      expect(coachName).toBe('coach@example.com');
      expect(clientName).toBe('client@example.com');
    });

    it('parses coachName/clientName from "A/B - Topic" summary as last resort', () => {
      const event = makeEvent({ summary: 'Alice/Bob - Leadership' });
      const { coachName, clientName } = getParticipantNames(event);
      expect(coachName).toBe('Alice');
      expect(clientName).toBe('Bob');
    });

    it('does not overwrite a resolved coachName with the summary fallback', () => {
      const event = makeEvent({ coachUid: 'user-1', summary: 'Should/NotAppear - Topic' });
      const profile = makeProfile({ userId: 'user-1', firstName: 'Real', lastName: 'Coach' });
      const { coachName } = getParticipantNames(event, 'user-1', profile);
      expect(coachName).toBe('Real Coach');
    });

    it('leaves names as defaults when summary has no slash-dash structure', () => {
      const event = makeEvent({ summary: 'NoSlashNoDash' });
      const { coachName, clientName } = getParticipantNames(event);
      expect(coachName).toBe('Coach');
      expect(clientName).toBe('Client');
    });
  });

  // ---------------------------------------------------------------------------
  // getBookingTopic
  // ---------------------------------------------------------------------------

  describe('getBookingTopic', () => {
    it('returns summary when there is no description and no dash in summary', () => {
      const event = makeEvent({ summary: 'Simple Summary', description: '' });
      expect(getBookingTopic(event)).toBe('Simple Summary');
    });

    it('extracts topic from "Names - Topic" summary when description is absent', () => {
      const event = makeEvent({ summary: 'Alice/Bob - Goal Setting', description: '' });
      expect(getBookingTopic(event)).toBe('Goal Setting');
    });

    it('extracts topic from structured PCN description format', () => {
      const event = makeEvent({
        description: 'Peer Coaching Network session on the topic: Leadership. Created via PCN.',
      });
      expect(getBookingTopic(event)).toBe('Leadership');
    });

    it('extracts topic using legacy regex "- Topic: <value>" pattern', () => {
      const event = makeEvent({ description: 'Some details\n- Topic: Career Coaching\nMore info' });
      expect(getBookingTopic(event)).toBe('Career Coaching');
    });

    it('falls back to summary extraction when description does not match known formats', () => {
      const event = makeEvent({
        summary: 'Alice/Bob - Resilience',
        description: 'Some random description with no topic marker',
      });
      expect(getBookingTopic(event)).toBe('Resilience');
    });

    it('returns summary as-is when description has no match and summary has no dash', () => {
      const event = makeEvent({
        summary: 'Just a title',
        description: 'Unrecognised description format',
      });
      expect(getBookingTopic(event)).toBe('Just a title');
    });

    it('handles hyphenated topics in summary correctly', () => {
      const event = makeEvent({ summary: 'Alice/Bob - Work-Life Balance', description: '' });
      expect(getBookingTopic(event)).toBe('Work-Life Balance');
    });
  });
});
