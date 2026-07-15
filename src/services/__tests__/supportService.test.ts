/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  createSupportRequest,
  getSupportRequestsForUser,
  getAllSupportRequests,
  getSupportRequestsPage,
  getSupportMessages,
  addMessageToSupportRequest,
  updateSupportRequestStatus,
  deleteSupportRequest,
} from '../supportService';

const H = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return {
    authState: { currentUser: null as null | { uid: string } },
    shared: {
      mockGetDoc: vi.fn(), mockSetDoc: vi.fn(), mockUpdateDoc: vi.fn(),
      mockGetDocs: vi.fn(), mockOnSnapshot: vi.fn(), mockDeleteDoc: vi.fn(),
      mockBatchSet: vi.fn(), mockBatchUpdate: vi.fn(), mockBatchDelete: vi.fn(), mockBatchCommit: vi.fn(() => Promise.resolve()),
    },
    dbContainer: { db: {} as any }
  };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock(H.authState));
vi.mock('firebase/firestore', async () => (await import('./helpers/firebaseMocks')).buildFirestoreMock(H.shared));
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());
vi.mock('../firebaseApp', () => ({
  get db() { return H.dbContainer.db; },
  auth: {} as any
}));

const { mockGetDocs, mockUpdateDoc, mockBatchSet, mockBatchUpdate, mockBatchDelete, mockBatchCommit } = H.shared;

describe('supportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.dbContainer.db = {} as any;
    mockBatchCommit.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('createSupportRequest', () => {
    it('throws when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      await expect(
        createSupportRequest('user-1', 'Jane Doe', 'jane@example.com', 'bug' as any, 'Cannot log in', 'Details here')
      ).rejects.toThrow('Firestore not initialized');
    });

    it('writes parent request and initial message in a batch and returns docId', async () => {
      const id = await createSupportRequest('user-1', 'Jane Doe', 'jane@example.com', 'bug' as any, 'Cannot log in', 'Details here');

      expect(typeof id).toBe('string');
      expect(mockBatchSet).toHaveBeenCalledTimes(2);

      // Verify parent request write
      const parentCall = mockBatchSet.mock.calls[0];
      expect(parentCall[0].path).toBe(`supportRequests/${id}`);
      expect(parentCall[1].userId).toBe('user-1');
      expect(parentCall[1].status).toBe('open');
      expect(parentCall[1].subject).toBe('Cannot log in');
      expect(parentCall[1].messages).toBeUndefined(); // Should not have messages array

      // Verify message subcollection write
      const messageCall = mockBatchSet.mock.calls[1];
      expect(messageCall[0].path).toContain(`supportRequests/${id}/messages/`);
      expect(messageCall[1].content).toBe('Details here');
      expect(messageCall[1].senderRole).toBe('user');
    });
  });

  describe('getSupportRequestsForUser', () => {
    it('returns empty array when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      const result = await getSupportRequestsForUser('user-1');
      expect(result).toEqual([]);
    });

    it('returns the user\'s tickets sorted by updatedAt desc', async () => {
      const mockDocs = [
        {
          id: 'r1',
          data: () => ({
            userId: 'user-1',
            userDisplayName: 'Jane Doe',
            userEmail: 'jane@example.com',
            category: 'bug',
            subject: 'Sub 1',
            status: 'open',
            createdAt: '2026-07-01T12:00:00Z',
            updatedAt: '2026-07-01T13:00:00Z',
          }),
        },
        {
          id: 'r2',
          data: () => ({
            userId: 'user-1',
            userDisplayName: 'Jane Doe',
            userEmail: 'jane@example.com',
            category: 'bug',
            subject: 'Sub 2',
            status: 'open',
            createdAt: '2026-07-01T12:00:00Z',
            updatedAt: '2026-07-01T14:00:00Z',
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => mockDocs.forEach(cb) });
      const result = await getSupportRequestsForUser('user-1');

      const queryCall = mockGetDocs.mock.calls[0][0];
      expect(queryCall.path).toBe('supportRequests');
      expect(queryCall.queries).toEqual(expect.arrayContaining([
        { field: 'userId', op: '==', val: 'user-1' }
      ]));
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('r2'); // Most recently updated first
      expect(result[1].id).toBe('r1');
    });
  });

  describe('getAllSupportRequests', () => {
    it('returns empty array when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      const result = await getAllSupportRequests();
      expect(result).toEqual([]);
    });

    it('returns every ticket sorted by updatedAt desc', async () => {
      const mockDocs = [
        {
          id: 'r1',
          data: () => ({
            userId: 'user-1',
            userDisplayName: 'Jane Doe',
            userEmail: 'jane@example.com',
            category: 'bug',
            subject: 'Sub 1',
            status: 'open',
            createdAt: '2026-07-01T12:00:00Z',
            updatedAt: '2026-07-01T12:00:00Z',
          }),
        },
        {
          id: 'r2',
          data: () => ({
            userId: 'user-2',
            userDisplayName: 'John Doe',
            userEmail: 'john@example.com',
            category: 'bug',
            subject: 'Sub 2',
            status: 'open',
            createdAt: '2026-07-01T12:00:00Z',
            updatedAt: '2026-07-01T14:00:00Z',
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => mockDocs.forEach(cb) });
      const result = await getAllSupportRequests();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('r2');
      expect(result[1].id).toBe('r1');
    });
  });

  describe('getSupportRequestsPage', () => {
    it('returns empty page when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      const result = await getSupportRequestsPage(10);
      expect(result).toEqual({ requests: [], nextCursor: null, hasMore: false });
    });

    it('returns one page and reports hasMore + cursor via look-ahead', async () => {
      const makeDoc = (id: string, updatedAt: string) => ({
        id,
        data: () => ({
          userId: 'user-1',
          userDisplayName: 'Jane Doe',
          userEmail: 'jane@example.com',
          category: 'bug',
          subject: `Sub ${id}`,
          status: 'open',
          createdAt: '2026-07-01T12:00:00Z',
          updatedAt,
        }),
      });
      // Requesting pageSize 1 fetches 2 (look-ahead) so the extra row signals
      // that a further page exists; the returned page trims back to 1.
      const mockDocs = [makeDoc('r1', '2026-07-02T00:00:00Z'), makeDoc('r2', '2026-07-01T00:00:00Z')];
      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => mockDocs.forEach(cb) });

      const result = await getSupportRequestsPage(1);

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].id).toBe('r1');
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe('getSupportMessages', () => {
    it('returns empty array when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      const result = await getSupportMessages('r1');
      expect(result).toEqual([]);
    });

    it('queries the subcollection ordered by createdAt asc', async () => {
      const mockDocs = [
        {
          id: 'm1',
          data: () => ({
            senderId: 'user-1',
            senderName: 'Jane',
            senderRole: 'user',
            content: 'hello',
            createdAt: '2026-07-01T12:00:00Z',
          })
        }
      ];

      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => mockDocs.forEach(cb) });
      const result = await getSupportMessages('r1');

      const queryCall = mockGetDocs.mock.calls[0][0];
      expect(queryCall.path).toBe('supportRequests/r1/messages');
      expect(queryCall.queries).toEqual(expect.arrayContaining([
        { field: 'createdAt', dir: 'asc' }
      ]));
      expect(result).toEqual([
        {
          id: 'm1',
          senderId: 'user-1',
          senderName: 'Jane',
          senderRole: 'user',
          content: 'hello',
          createdAt: '2026-07-01T12:00:00Z',
        }
      ]);
    });
  });

  describe('addMessageToSupportRequest', () => {
    it('throws when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      await expect(
        addMessageToSupportRequest('r1', 'admin-1', 'Admin', true, 'A reply')
      ).rejects.toThrow('Firestore not initialized');
    });

    it('writes message in subcollection and updates parent status/updatedAt in batch', async () => {
      await addMessageToSupportRequest('r1', 'admin-1', 'Admin', true, 'A reply');

      expect(mockBatchSet).toHaveBeenCalledTimes(1);
      const setCall = mockBatchSet.mock.calls[0];
      expect(setCall[0].path).toContain('supportRequests/r1/messages/');
      expect(setCall[1].content).toBe('A reply');
      expect(setCall[1].senderRole).toBe('admin');

      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
      const updateCall = mockBatchUpdate.mock.calls[0];
      expect(updateCall[0].path).toBe('supportRequests/r1');
      expect(updateCall[1].status).toBe('open');
      expect(updateCall[1].updatedAt).toBeDefined();
    });
  });

  describe('updateSupportRequestStatus', () => {
    it('throws when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      await expect(updateSupportRequestStatus('r1', 'closed' as any)).rejects.toThrow('Firestore not initialized');
    });

    it('writes the new status and updatedAt', async () => {
      await updateSupportRequestStatus('r1', 'closed' as any);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.status).toBe('closed');
      expect(updates.updatedAt).toBeDefined();
    });
  });

  describe('deleteSupportRequest', () => {
    it('throws when firestore is not initialized', async () => {
      H.dbContainer.db = null as any;
      await expect(deleteSupportRequest('r1')).rejects.toThrow('Firestore not initialized');
    });

    it('queries subcollection and deletes parent along with all messages in batch', async () => {
      const mockDocs = [
        {
          id: 'm1',
          ref: { id: 'm1', path: 'supportRequests/r1/messages/m1' }
        },
        {
          id: 'm2',
          ref: { id: 'm2', path: 'supportRequests/r1/messages/m2' }
        }
      ];

      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => mockDocs.forEach(cb) });
      await deleteSupportRequest('r1');

      expect(mockGetDocs).toHaveBeenCalled();
      expect(mockBatchDelete).toHaveBeenCalledTimes(3); // 2 messages + 1 parent request
      expect(mockBatchDelete.mock.calls[0][0].path).toBe('supportRequests/r1/messages/m1');
      expect(mockBatchDelete.mock.calls[1][0].path).toBe('supportRequests/r1/messages/m2');
      expect(mockBatchDelete.mock.calls[2][0].path).toBe('supportRequests/r1');
    });
  });
});
