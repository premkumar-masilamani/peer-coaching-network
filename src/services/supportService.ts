import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { type SupportCategory, type SupportStatus, USER_ROLE, COLLECTIONS, SUPPORT_STATUS } from '../config';
import { db } from './firebaseApp';
import type { SupportMessage, SupportRequest } from './types';

// ── Support and Feedback Ticket System ────────────────────────────────────────

const convertTimestampToString = (val: unknown): string => {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
};

const convertDocToSupportRequest = (d: { id: string; data: () => DocumentData }): SupportRequest => {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId,
    userDisplayName: data.userDisplayName,
    userEmail: data.userEmail,
    category: data.category,
    subject: data.subject,
    status: data.status,
    createdAt: convertTimestampToString(data.createdAt),
    updatedAt: convertTimestampToString(data.updatedAt)
  };
};

const convertDocToSupportMessage = (d: { id: string; data: () => DocumentData }): SupportMessage => {
  const data = d.data();
  return {
    id: d.id,
    senderId: data.senderId,
    senderName: data.senderName,
    senderRole: data.senderRole,
    content: data.content,
    createdAt: convertTimestampToString(data.createdAt)
  };
};

export const createSupportRequest = async (
  userId: string,
  userDisplayName: string,
  userEmail: string,
  category: SupportCategory,
  subject: string,
  messageText: string
): Promise<string> => {
  if (!db) throw new Error('Firestore not initialized');

  const supportRequestsRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS);
  const docRef = doc(supportRequestsRef); // Generate new ID
  
  const batch = writeBatch(db);

  // 1. Create parent support request
  const newRequest = {
    id: docRef.id,
    userId,
    userDisplayName,
    userEmail,
    category,
    subject,
    status: SUPPORT_STATUS.OPEN,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  batch.set(docRef, newRequest);

  // 2. Create the first message in subcollection
  const messagesRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS, docRef.id, COLLECTIONS.SUPPORT_MESSAGES);
  const msgDocRef = doc(messagesRef);
  const initialMessage = {
    id: msgDocRef.id,
    senderId: userId,
    senderName: userDisplayName,
    senderRole: USER_ROLE.USER,
    content: messageText,
    createdAt: serverTimestamp()
  };
  batch.set(msgDocRef, initialMessage);

  await batch.commit();
  return docRef.id;
};

export const getSupportRequestsForUser = async (userId: string): Promise<SupportRequest[]> => {
  if (!db) return [];
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), where('userId', '==', userId));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(convertDocToSupportRequest(d)));
  // Sort by updatedAt desc client-side
  return requests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const getAllSupportRequests = async (): Promise<SupportRequest[]> => {
  if (!db) return [];
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(convertDocToSupportRequest(d)));
  return requests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const getSupportMessages = async (requestId: string): Promise<SupportMessage[]> => {
  if (!db) return [];
  const messagesRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS, requestId, COLLECTIONS.SUPPORT_MESSAGES);
  const q = query(messagesRef, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  const messages: SupportMessage[] = [];
  snap.forEach(d => messages.push(convertDocToSupportMessage(d)));
  return messages;
};

export const addMessageToSupportRequest = async (
  requestId: string,
  senderId: string,
  senderName: string,
  isAdmin: boolean,
  content: string
): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  
  const parentDocRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  const messagesRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS, requestId, COLLECTIONS.SUPPORT_MESSAGES);
  const msgDocRef = doc(messagesRef);

  const newMessage = {
    id: msgDocRef.id,
    senderId,
    senderName,
    senderRole: isAdmin ? USER_ROLE.ADMIN : USER_ROLE.USER,
    content,
    createdAt: serverTimestamp()
  };

  const batch = writeBatch(db);
  batch.set(msgDocRef, newMessage);
  batch.update(parentDocRef, {
    updatedAt: serverTimestamp(),
    status: SUPPORT_STATUS.OPEN // Always set to open when a new message is sent
  });

  await batch.commit();
};

export const updateSupportRequestStatus = async (requestId: string, status: SupportStatus): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp()
  });
};

export const deleteSupportRequest = async (requestId: string): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  
  // Cascade delete subcollection messages
  const messagesRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS, requestId, COLLECTIONS.SUPPORT_MESSAGES);
  const snap = await getDocs(messagesRef);
  
  const batch = writeBatch(db);
  snap.forEach(d => {
    batch.delete(d.ref);
  });
  batch.delete(docRef);
  
  await batch.commit();
};
