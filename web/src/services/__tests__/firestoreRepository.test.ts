import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSystemLogsByUser, fetchSystemLogsPage } from '../firestoreRepository';
import { getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { LOG_SEVERITY } from '../../config';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    collection: vi.fn(() => ({ type: 'collection' })),
    doc: vi.fn(() => ({ type: 'doc' })),
    query: vi.fn((...args: unknown[]) => ({ type: 'query', args })),
    where: vi.fn((field, op, val) => ({ field, op, val })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    limit: vi.fn((count) => ({ count })),
    startAfter: vi.fn((cursor) => ({ cursor })),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
    Timestamp: {
      fromDate: vi.fn((d) => d),
    },
  };
});

vi.mock('../firebaseApp', () => ({
  db: { type: 'mock-db' },
  auth: { currentUser: { uid: 'auth-user-id', email: 'auth@example.com' } },
}));

describe('firestoreRepository systemLogs operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchSystemLogsByUser', () => {
    it('should build query with userId equality filter and timestamp desc order', async () => {
      const mockDocs = [
        {
          id: 'log-1',
          data: () => ({
            type: LOG_SEVERITY.ERROR,
            event: 'ERROR_EVENT',
            userId: 'target-user',
            userEmail: 'target@example.com',
            errorMessage: 'Something broke',
            timestamp: 100,
            expireAt: 200,
          }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        forEach: (callback: (doc: typeof mockDocs[0]) => void) => mockDocs.forEach(callback),
      } as unknown as import('firebase/firestore').QuerySnapshot);

      const logs = await fetchSystemLogsByUser('target-user', 15);

      expect(where).toHaveBeenCalledWith('userId', '==', 'target-user');
      expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(limit).toHaveBeenCalledWith(15);
      expect(query).toHaveBeenCalled();
      expect(getDocs).toHaveBeenCalled();

      expect(logs).toEqual([
        {
          id: 'log-1',
          type: LOG_SEVERITY.ERROR,
          event: 'ERROR_EVENT',
          userId: 'target-user',
          userEmail: 'target@example.com',
          errorMessage: 'Something broke',
          timestamp: 100,
          expireAt: 200,
        },
      ]);
    });
  });

  describe('fetchSystemLogsPage', () => {
    it('should query system logs page and map records', async () => {
      const mockDocs = [
        {
          id: 'log-1',
          data: () => ({
            type: LOG_SEVERITY.WARN,
            event: 'WARN_EVENT',
            userId: null,
            userEmail: null,
            errorMessage: null,
            timestamp: 300,
            expireAt: 400,
          }),
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        forEach: (callback: (doc: typeof mockDocs[0]) => void) => mockDocs.forEach(callback),
      } as unknown as import('firebase/firestore').QuerySnapshot);

      const result = await fetchSystemLogsPage({
        severities: [LOG_SEVERITY.WARN],
        pageSize: 10,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].id).toBe('log-1');
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });
});
