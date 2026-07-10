/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  createSupportRequest,
  getSupportRequestsForUser,
  getAllSupportRequests,
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
      mockBatchSet: vi.fn(), mockBatchDelete: vi.fn(), mockBatchCommit: vi.fn(() => Promise.resolve()),
    },
  };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock(H.authState));
vi.mock('firebase/firestore', async () => (await import('./helpers/firebaseMocks')).buildFirestoreMock(H.shared));
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());

const { mockGetDoc, mockSetDoc, mockUpdateDoc, mockGetDocs, mockDeleteDoc } = H.shared;

describe('supportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  describe('createSupportRequest', () => {
    it('writes a new open request with the initial message and returns its id', async () => {
      const id = await createSupportRequest('user-1', 'Jane Doe', 'jane@example.com', 'bug' as any, 'Cannot log in', 'Details here');

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const [ref, request] = mockSetDoc.mock.calls[0];
      expect(typeof id).toBe('string');
      expect(id).toBe(ref.id);
      expect(request.userId).toBe('user-1');
      expect(request.status).toBe('open');
      expect(request.category).toBe('bug');
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].content).toBe('Details here');
      expect(request.messages[0].senderRole).toBe('user');
      expect(request.createdAt).toBe(request.updatedAt);
    });
  });

  describe('getSupportRequestsForUser', () => {
    it('returns the requesting user\'s tickets ordered by update time', async () => {
      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => { cb({ data: () => ({ id: 'r1', userId: 'user-1' }) }); } });
      const result = await getSupportRequestsForUser('user-1');

      const queryCall = mockGetDocs.mock.calls[0][0];
      expect(queryCall.path).toBe('supportRequests');
      expect(queryCall.queries).toEqual(expect.arrayContaining([
        { field: 'userId', op: '==', val: 'user-1' },
        { field: 'updatedAt', dir: 'desc' },
      ]));
      expect(result).toEqual([{ id: 'r1', userId: 'user-1' }]);
    });
  });

  describe('getAllSupportRequests', () => {
    it('returns every ticket ordered by update time', async () => {
      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => { cb({ data: () => ({ id: 'r1' }) }); cb({ data: () => ({ id: 'r2' }) }); } });
      const result = await getAllSupportRequests();
      expect(result).toEqual([{ id: 'r1' }, { id: 'r2' }]);
    });
  });

  describe('addMessageToSupportRequest', () => {
    it('appends the message, reopens the ticket, and stamps updatedAt', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'r1', status: 'closed', messages: [{ id: 'm0', content: 'first' }] }),
      });

      await addMessageToSupportRequest('r1', 'admin-1', 'Admin', true, 'A reply');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.status).toBe('open');
      expect(updates.messages).toHaveLength(2);
      expect(updates.messages[1].content).toBe('A reply');
      expect(updates.messages[1].senderRole).toBe('admin');
      expect(updates.updatedAt).toBeDefined();
    });

    it('throws when the ticket does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      await expect(addMessageToSupportRequest('missing', 's', 'S', false, 'x')).rejects.toThrow('Support request not found');
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('updateSupportRequestStatus', () => {
    it('writes the new status and updatedAt', async () => {
      await updateSupportRequestStatus('r1', 'closed' as any);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.status).toBe('closed');
      expect(updates.updatedAt).toBeDefined();
    });
  });

  describe('deleteSupportRequest', () => {
    it('deletes the ticket document', async () => {
      await deleteSupportRequest('r1');
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect(mockDeleteDoc.mock.calls[0][0].path).toBe('supportRequests/r1');
    });
  });
});
