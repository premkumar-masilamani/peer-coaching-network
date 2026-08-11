import { type SupportCategory, type SupportStatus, USER_ROLE } from '../config';
import { db } from './firebaseApp';
import {
  createSupportRequestWithFirstMessage,
  fetchSupportRequestDocsByUser,
  fetchAllSupportRequestDocs,
  fetchSupportRequestsPage,
  fetchSupportMessageDocs,
  addSupportMessage,
  setSupportRequestStatus,
  deleteSupportRequestCascade,
  type RawDoc,
} from './firestoreRepository';
import type { SupportMessage, SupportRequest } from './types';

// ── Support and Feedback Ticket System ────────────────────────────────────────
// Tickets are stored as a parent `supportRequests` document plus a `messages`
// subcollection. The repository owns the Firestore access; this service maps the
// raw documents to domain objects and orders them.

const convertTimestampToString = (val: unknown): string => {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  // Firestore Timestamps (and our test doubles) expose toDate().
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
};

const toSupportRequest = ({ id, data }: RawDoc): SupportRequest => ({
  id,
  userId: data.userId,
  userDisplayName: data.userDisplayName,
  userEmail: data.userEmail,
  category: data.category,
  subject: data.subject,
  status: data.status,
  createdAt: convertTimestampToString(data.createdAt),
  updatedAt: convertTimestampToString(data.updatedAt),
});

const toSupportMessage = ({ id, data }: RawDoc): SupportMessage => ({
  id,
  senderId: data.senderId,
  senderName: data.senderName,
  senderRole: data.senderRole,
  content: data.content,
  createdAt: convertTimestampToString(data.createdAt),
});

const byUpdatedAtDesc = (a: SupportRequest, b: SupportRequest): number =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

export const createSupportRequest = async (
  userId: string,
  userDisplayName: string,
  userEmail: string,
  category: SupportCategory,
  subject: string,
  messageText: string
): Promise<string> => {
  if (!db) throw new Error('Firestore not initialized');
  return createSupportRequestWithFirstMessage({
    userId,
    userDisplayName,
    userEmail,
    category,
    subject,
    senderRole: USER_ROLE.USER,
    content: messageText,
  });
};

export const getSupportRequestsForUser = async (userId: string): Promise<SupportRequest[]> => {
  if (!db) return [];
  const docs = await fetchSupportRequestDocsByUser(userId);
  return docs.map(toSupportRequest).sort(byUpdatedAtDesc);
};

export const getAllSupportRequests = async (): Promise<SupportRequest[]> => {
  if (!db) return [];
  const docs = await fetchAllSupportRequestDocs();
  return docs.map(toSupportRequest).sort(byUpdatedAtDesc);
};

// One page of support tickets (newest-updated first) with an opaque cursor for
// the next page, bounding the admin desk's initial read. The query already
// returns tickets in updatedAt-desc order, so no additional client-side sort is
// needed within a page.
export const getSupportRequestsPage = async (
  pageSize: number,
  pageCursor?: unknown
): Promise<{ requests: SupportRequest[]; nextCursor: unknown | null; hasMore: boolean }> => {
  if (!db) return { requests: [], nextCursor: null, hasMore: false };
  const { docs, nextCursor, hasMore } = await fetchSupportRequestsPage({ pageSize, pageCursor });
  return { requests: docs.map(toSupportRequest), nextCursor, hasMore };
};

export const getSupportMessages = async (requestId: string): Promise<SupportMessage[]> => {
  if (!db) return [];
  const docs = await fetchSupportMessageDocs(requestId);
  return docs.map(toSupportMessage);
};

export const addMessageToSupportRequest = async (
  requestId: string,
  senderId: string,
  senderName: string,
  isAdmin: boolean,
  content: string
): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  await addSupportMessage(requestId, {
    senderId,
    senderName,
    senderRole: isAdmin ? USER_ROLE.ADMIN : USER_ROLE.USER,
    content,
  });
};

export const updateSupportRequestStatus = async (requestId: string, status: SupportStatus): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  await setSupportRequestStatus(requestId, status);
};

export const deleteSupportRequest = async (requestId: string): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  await deleteSupportRequestCascade(requestId);
};
