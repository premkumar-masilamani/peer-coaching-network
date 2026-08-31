import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SUPPORT_CATEGORY, SUPPORT_STATUS, USER_ROLE } from '../../config';

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    createSupportRequestWithFirstMessage: vi.fn(),
    fetchSupportRequestDocsByUser: vi.fn(),
    fetchAllSupportRequestDocs: vi.fn(),
    fetchSupportRequestsPage: vi.fn(),
    fetchSupportMessageDocs: vi.fn(),
    addSupportMessage: vi.fn(),
    setSupportRequestStatus: vi.fn(),
    deleteSupportRequestCascade: vi.fn(),
  },
}));

vi.mock('../firebaseApp', () => ({
  db: { type: 'mock-db' },
}));

vi.mock('../firestoreRepository', () => mockRepo);

import {
  createSupportRequest,
  getSupportRequestsForUser,
  getSupportMessages,
  addMessageToSupportRequest,
  updateSupportRequestStatus,
  deleteSupportRequest,
} from '../supportService';

describe('supportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates support request with first message', async () => {
    mockRepo.createSupportRequestWithFirstMessage.mockResolvedValueOnce('ticket-123');

    const ticketId = await createSupportRequest(
      'u-1',
      'User One',
      SUPPORT_CATEGORY.INQUIRY,
      'Need Help',
      'Message content here'
    );

    expect(ticketId).toBe('ticket-123');
    expect(mockRepo.createSupportRequestWithFirstMessage).toHaveBeenCalledWith({
      userId: 'u-1',
      userDisplayName: 'User One',
      category: SUPPORT_CATEGORY.INQUIRY,
      subject: 'Need Help',
      senderRole: USER_ROLE.USER,
      content: 'Message content here',
    });
  });

  it('fetches support requests for user and sorts by createdAt desc', async () => {
    mockRepo.fetchSupportRequestDocsByUser.mockResolvedValueOnce([
      {
        id: 'req-1',
        data: {
          userId: 'u-1',
          userDisplayName: 'User One',
          category: SUPPORT_CATEGORY.INQUIRY,
          subject: 'Old Ticket',
          status: SUPPORT_STATUS.OPEN,
          createdAt: { toDate: () => new Date('2026-08-01T00:00:00Z') },
        },
      },
      {
        id: 'req-2',
        data: {
          userId: 'u-1',
          userDisplayName: 'User One',
          category: SUPPORT_CATEGORY.BUG,
          subject: 'New Ticket',
          status: SUPPORT_STATUS.CLOSED,
          createdAt: { toDate: () => new Date('2026-08-15T00:00:00Z') },
        },
      },
    ]);

    const result = await getSupportRequestsForUser('u-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('req-2'); // Newer ticket first
    expect(result[1].id).toBe('req-1');
  });

  it('fetches support messages and maps timestamps', async () => {
    mockRepo.fetchSupportMessageDocs.mockResolvedValueOnce([
      {
        id: 'msg-1',
        data: {
          senderId: 'u-1',
          senderName: 'User One',
          senderRole: USER_ROLE.USER,
          content: 'Hello Support',
          createdAt: { toDate: () => new Date('2026-08-01T10:00:00Z') },
        },
      },
    ]);

    const messages = await getSupportMessages('req-1');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello Support');
    expect(messages[0].senderRole).toBe(USER_ROLE.USER);
  });

  it('adds message to support request with proper role flag', async () => {
    await addMessageToSupportRequest('req-1', 'admin-uid', 'Admin Name', true, 'Resolution details');

    expect(mockRepo.addSupportMessage).toHaveBeenCalledWith('req-1', {
      senderId: 'admin-uid',
      senderName: 'Admin Name',
      senderRole: USER_ROLE.ADMIN,
      content: 'Resolution details',
    });
  });

  it('updates support request status and deletes cascade', async () => {
    await updateSupportRequestStatus('req-1', SUPPORT_STATUS.CLOSED);
    expect(mockRepo.setSupportRequestStatus).toHaveBeenCalledWith('req-1', SUPPORT_STATUS.CLOSED);

    await deleteSupportRequest('req-1');
    expect(mockRepo.deleteSupportRequestCascade).toHaveBeenCalledWith('req-1');
  });
});
