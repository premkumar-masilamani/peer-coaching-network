import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  createSupportRequest, 
  getSupportRequestsForUser, 
  getAllSupportRequests, 
  addMessageToSupportRequest, 
  updateSupportRequestStatus, 
  deleteSupportRequest 
} from '../supportService';
import { COLLECTIONS } from '../../config';

const { mockGetDoc, mockSetDoc, mockUpdateDoc, mockGetDocs, mockDeleteDoc } = vi.hoisted(() => {
  return {
    mockGetDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockDeleteDoc: vi.fn()
  };
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    connectFirestoreEmulator: vi.fn(),
    doc: vi.fn((_db, col, id) => ({ id, path: `${col}/${id}` })),
    collection: vi.fn((_db, col) => ({ id: col, path: col })),
    query: vi.fn((col, ...queries) => ({ id: col.id, path: col.path, queries })),
    where: vi.fn((field, op, val) => ({ field, op, val })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    getDoc: mockGetDoc,
    setDoc: mockSetDoc,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    getDocs: mockGetDocs,
  };
});

vi.mock('../firebaseApp', () => ({
  db: {},
  auth: { currentUser: { uid: 'user-123' } }
}));

describe('supportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSupportRequest', () => {
    it('creates a new support request ticket in Firestore', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const requestId = await createSupportRequest(
        'user-123',
        'John Doe',
        'john@example.com',
        'technical',
        'Bug in dashboard',
        'The dashboard is flickering.'
      );

      expect(requestId).toBeDefined();
      expect(mockSetDoc).toHaveBeenCalledOnce();
      const savedData = mockSetDoc.mock.calls[0][1];
      expect(savedData.userId).toBe('user-123');
      expect(savedData.userDisplayName).toBe('John Doe');
      expect(savedData.category).toBe('technical');
      expect(savedData.subject).toBe('Bug in dashboard');
      expect(savedData.status).toBe('open');
      expect(savedData.messages.length).toBe(1);
      expect(savedData.messages[0].content).toBe('The dashboard is flickering.');
    });
  });

  describe('getSupportRequestsForUser', () => {
    it('queries and returns requests for a specific user ID', async () => {
      const mockDocs = [
        {
          data: () => ({
            id: 'req-1',
            userId: 'user-123',
            subject: 'Issue 1',
            status: 'open'
          })
        }
      ];
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: any) => mockDocs.forEach(callback)
      });

      const result = await getSupportRequestsForUser('user-123');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('req-1');
      expect(result[0].subject).toBe('Issue 1');
    });
  });

  describe('getAllSupportRequests', () => {
    it('queries and returns all support request tickets', async () => {
      const mockDocs = [
        {
          data: () => ({ id: 'req-1', subject: 'Issue 1' })
        },
        {
          data: () => ({ id: 'req-2', subject: 'Issue 2' })
        }
      ];
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: any) => mockDocs.forEach(callback)
      });

      const result = await getAllSupportRequests();
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('req-1');
      expect(result[1].id).toBe('req-2');
    });
  });

  describe('addMessageToSupportRequest', () => {
    it('appends a message to the ticket messages list and updates updatedAt', async () => {
      const existingTicket = {
        id: 'req-1',
        userId: 'user-123',
        messages: [
          { id: 'msg-1', content: 'Initial message' }
        ]
      };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingTicket
      });
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await addMessageToSupportRequest(
        'req-1',
        'admin-456',
        'Admin Staff',
        true,
        'We are looking into it.'
      );

      expect(mockUpdateDoc).toHaveBeenCalledOnce();
      const updateData = mockUpdateDoc.mock.calls[0][1];
      expect(updateData.status).toBe('open');
      expect(updateData.messages.length).toBe(2);
      expect(updateData.messages[1].content).toBe('We are looking into it.');
      expect(updateData.messages[1].senderRole).toBe('admin');
    });

    it('throws an error if the support request is not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false
      });

      await expect(
        addMessageToSupportRequest('invalid-req', 'user-123', 'John', false, 'Hello?')
      ).rejects.toThrow('Support request not found');
    });
  });

  describe('updateSupportRequestStatus', () => {
    it('updates status and updatedAt timestamp of the ticket', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await updateSupportRequestStatus('req-1', 'resolved');

      expect(mockUpdateDoc).toHaveBeenCalledOnce();
      const updateData = mockUpdateDoc.mock.calls[0][1];
      expect(updateData.status).toBe('resolved');
      expect(updateData.updatedAt).toBeDefined();
    });
  });

  describe('deleteSupportRequest', () => {
    it('deletes the support request document from firestore', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await deleteSupportRequest('req-1');

      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });
  });
});
