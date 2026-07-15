/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// This suite exercises getGoogleBusyIntervals, whose network path is only
// reachable when Google integration is ENABLED. The other slotsService tests run
// with the emulator flag on (integration disabled), so the fetch branch is
// covered here with the flag forced on before the module loads.
const { mockGetGoogleToken } = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'false';
  (import.meta.env as any).VITE_ENABLE_GOOGLE_INTEGRATION = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  (import.meta.env as any).VITE_FIREBASE_API_KEY = 'test-key';
  (import.meta.env as any).VITE_FIREBASE_PROJECT_ID = 'test-project';
  (import.meta.env as any).VITE_FIREBASE_APP_ID = 'test-app';
  (import.meta.env as any).VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
  (import.meta.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID = 'test-sender';
  (import.meta.env as any).VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
  return { mockGetGoogleToken: vi.fn() };
});

// Auth mock exposes a mutable currentUser so tests can simulate the coach's session.
const authState: { currentUser: { uid: string } | null } = { currentUser: null };

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})), logEvent: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => authState),
  connectAuthEmulator: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  GoogleAuthProvider: class { addScope = vi.fn(); setCustomParameters = vi.fn(); static credentialFromResult = vi.fn(); },
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn(), collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  or: vi.fn(), and: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), getDocs: vi.fn(), onSnapshot: vi.fn(), documentId: vi.fn(),
  writeBatch: vi.fn(), orderBy: vi.fn(),
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
}));
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), telemetry: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../googleToken', () => ({
  getGoogleToken: mockGetGoogleToken,
  setGoogleToken: vi.fn(),
  clearGoogleToken: vi.fn(),
}));

const timeMin = new Date('2026-07-01T00:00:00.000Z');
const timeMax = new Date('2026-08-01T00:00:00.000Z');

describe('slotsService.getGoogleBusyIntervals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.currentUser = { uid: 'coach1' };
    mockGetGoogleToken.mockReturnValue('valid-token');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps freeBusy busy periods to millisecond intervals', async () => {
    const { getGoogleBusyIntervals } = await import('../slotsService');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ calendars: { primary: { busy: [
        { start: '2026-07-01T10:00:00.000Z', end: '2026-07-01T11:00:00.000Z' },
      ] } } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getGoogleBusyIntervals('coach1', timeMin, timeMax);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as any;
    expect(url).toContain('/freeBusy');
    expect(opts.headers.Authorization).toBe('Bearer valid-token');
    expect(result).toEqual([
      { start: new Date('2026-07-01T10:00:00.000Z').getTime(), end: new Date('2026-07-01T11:00:00.000Z').getTime() },
    ]);
  });

  it('returns [] when the response is not ok', async () => {
    const { getGoogleBusyIntervals } = await import('../slotsService');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await getGoogleBusyIntervals('coach1', timeMin, timeMax)).toEqual([]);
  });

  it('returns [] and swallows network errors', async () => {
    const { getGoogleBusyIntervals } = await import('../slotsService');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await getGoogleBusyIntervals('coach1', timeMin, timeMax)).toEqual([]);
  });

  it('returns [] without fetching when no Google token is present', async () => {
    const { getGoogleBusyIntervals } = await import('../slotsService');
    mockGetGoogleToken.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await getGoogleBusyIntervals('coach1', timeMin, timeMax)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] when recalc is for a different user than the signed-in coach', async () => {
    const { getGoogleBusyIntervals } = await import('../slotsService');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await getGoogleBusyIntervals('someone-else', timeMin, timeMax)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults to [] when the payload has no busy array', async () => {
    const { getGoogleBusyIntervals } = await import('../slotsService');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    expect(await getGoogleBusyIntervals('coach1', timeMin, timeMax)).toEqual([]);
  });
});
