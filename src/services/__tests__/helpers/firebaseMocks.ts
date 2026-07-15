/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared Firebase SDK mock builders for the service-layer unit tests.
//
// Each service test mocks the Firebase SDK at the module level. These builders
// keep the (large) firestore/auth/analytics/logger mock shapes in one place so
// the per-service test files stay focused on behaviour. The mutable vi.fn
// handles are created per test file via vi.hoisted and passed in here, so every
// suite gets its own isolated call history.
import { vi } from 'vitest';

export interface FirestoreShared {
  mockGetDoc: any;
  mockSetDoc: any;
  mockUpdateDoc: any;
  mockGetDocs: any;
  mockOnSnapshot: any;
  mockDeleteDoc: any;
  mockBatchSet: any;
  mockBatchUpdate?: any;
  mockBatchDelete: any;
  mockBatchCommit: any;
}

// Minimal stand-in for firebase/firestore's Timestamp, anchored to epoch seconds.
export class MockTimestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() { return new Date(this.seconds * 1000); }
  toMillis() { return this.seconds * 1000; }
  static now = vi.fn(() => new MockTimestamp(1776518400, 0));
  static fromDate = vi.fn((date: Date) => new MockTimestamp(date.getTime() / 1000, 0));
}

// Creates the fresh vi.fn handles a firestore mock needs. Call inside vi.hoisted.
export const createFirestoreShared = (): FirestoreShared => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockBatchCommit: vi.fn(() => Promise.resolve()),
});

// Path-aware firestore mock. `doc`/`collection`/`query` return lightweight
// descriptors ({ id, path, queries }) so assertions can inspect which
// collection/constraints a call targeted without a real Firestore.
export const buildFirestoreMock = (s: FirestoreShared) => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  doc: vi.fn((dbOrColl: any, col?: string, ...paths: string[]) => {
    // doc(collectionRef) → a new document with an auto-generated id.
    if (col === undefined) {
      const id = `auto-${Math.random().toString(36).slice(2, 9)}`;
      return { id, path: `${dbOrColl?.path ?? ''}/${id}` };
    }
    return { id: paths[paths.length - 1] || col, path: `${col}/${paths.join('/')}` };
  }),
  collection: vi.fn((...args: any[]) => {
    if (args.length === 2) {
      const parent = args[0];
      const path = args[1];
      if (parent && typeof parent === 'object' && 'path' in parent) {
        return { id: path, path: `${parent.path}/${path}` };
      }
      return { id: path, path };
    }
    if (args.length > 2) {
      const colPath = args[1];
      const segments = args.slice(2);
      const fullPath = [colPath, ...segments].join('/');
      const id = segments[segments.length - 1] || colPath;
      return { id, path: fullPath };
    }
    return { id: args[0], path: args[0] };
  }),
  query: vi.fn((col: any, ...queries: any[]) => ({ id: col.id, path: col.path, queries })),
  where: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
  or: vi.fn((...conditions: any[]) => ({ type: 'or', conditions })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  orderBy: vi.fn((field: string, dir?: string) => ({ field, dir })),
  getDoc: s.mockGetDoc,
  setDoc: s.mockSetDoc,
  updateDoc: s.mockUpdateDoc,
  deleteDoc: s.mockDeleteDoc,
  getDocs: s.mockGetDocs,
  onSnapshot: s.mockOnSnapshot,
  documentId: vi.fn(() => 'documentId'),
  writeBatch: vi.fn(() => ({ set: s.mockBatchSet, update: s.mockBatchUpdate, delete: s.mockBatchDelete, commit: s.mockBatchCommit })),
  Timestamp: MockTimestamp,
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
});

// firebase/auth mock with a mutable currentUser so tests can simulate sessions.
export const buildAuthMock = (authState: { currentUser: { uid: string } | null }) => ({
  getAuth: vi.fn(() => authState),
  connectAuthEmulator: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  GoogleAuthProvider: class {
    addScope = vi.fn();
    setCustomParameters = vi.fn();
    static credentialFromResult = vi.fn();
  },
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
});

export const buildAnalyticsMock = () => ({ getAnalytics: vi.fn(() => ({})), logEvent: vi.fn() });

export const buildLoggerMock = () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    telemetry: vi.fn(() => Promise.resolve()),
  },
});

// Snapshot helper mirroring Firestore's forEach(doc => doc.data()) shape, with a
// synthetic ref id of "{coachUid}_{dateISO}" for shard-deletion assertions.
export const snap = (docs: any[]) => ({
  forEach: (cb: any) => docs.forEach((d) => cb({ data: () => d, ref: { id: `${d.coachUid}_${d.dateISO}` } })),
});
