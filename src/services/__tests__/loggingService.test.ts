import { vi, describe, it, expect, beforeEach } from 'vitest';
import { logEvent } from '../loggingService';
import { auth } from '../firebaseService';

// vi.hoisted for variables accessed inside vi.mock
const { mockAddDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'user-123', email: 'user@example.com' },
  })),
  connectAuthEmulator: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class {},
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  collection: vi.fn((_db, col) => ({ id: col, path: col })),
  addDoc: mockAddDoc,
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  Timestamp: {
    fromDate: (date: Date) => ({ toDate: () => date, seconds: Math.floor(date.getTime() / 1000) }),
  },
  doc: vi.fn((_db, col, ...paths) => ({ id: paths[paths.length - 1] || col, path: `${col}/${paths.join('/')}` })),
  query: vi.fn((col, ...queries) => ({ id: col.id, path: col.path, queries })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  runTransaction: vi.fn(),
  getDocs: vi.fn(),
}));

describe('loggingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully logs an event with active user ID and 7 days TTL', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'log-doc-id' });

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await logEvent('info', 'test_event', { foo: 'bar' });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [collectionRef, logData] = mockAddDoc.mock.calls[0];
    
    expect(collectionRef.path).toBe('systemLogs');
    expect(logData.type).toBe('info');
    expect(logData.event).toBe('test_event');
    expect(logData.userId).toBe('user-123');
    expect(logData.details).toEqual({ foo: 'bar' });
    expect(logData.timestamp).toBe('server-timestamp');
    
    const expectedExpire = new Date(now + 7 * 24 * 60 * 60 * 1000);
    expect(logData.expireAt.toDate().getTime()).toBe(expectedExpire.getTime());
  });

  it('logs an event with userId null if no user is authenticated', async () => {
    const originalCurrentUser = auth.currentUser;
    Object.defineProperty(auth, 'currentUser', {
      get: () => null,
      configurable: true,
    });

    mockAddDoc.mockResolvedValueOnce({ id: 'log-doc-id' });

    await logEvent('warn', 'anonymous_event');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const logData = mockAddDoc.mock.calls[0][1];
    expect(logData.userId).toBeNull();

    Object.defineProperty(auth, 'currentUser', {
      get: () => originalCurrentUser,
      configurable: true,
    });
  });

  it('catches and logs errors to console if addDoc fails without crashing the app', async () => {
    mockAddDoc.mockRejectedValueOnce(new Error('Firestore write failure'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(logEvent('error', 'failed_log')).resolves.not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Failed to log event "failed_log" to Firestore:');
    
    consoleErrorSpy.mockRestore();
  });
});
