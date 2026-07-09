import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs 
} from 'firebase/firestore';
import { db } from './firebaseApp';
import { 
  COLLECTIONS, 
  USER_ROLE, 
  type SupportCategory, 
  type SupportStatus 
} from '../config';
import { type SupportMessage, type SupportRequest } from './types';

export const createSupportRequest = async (
  userId: string,
  userDisplayName: string,
  userEmail: string,
  category: SupportCategory,
  subject: string,
  messageText: string
): Promise<string> => {
  if (!db) throw new Error('Firestore not initialized');
  const now = new Date().toISOString();
  
  const initialMessage: SupportMessage = {
    id: Date.now().toString(),
    senderId: userId,
    senderName: userDisplayName,
    senderRole: USER_ROLE.USER,
    content: messageText,
    createdAt: now,
  };

  const supportRequestsRef = collection(db, COLLECTIONS.SUPPORT_REQUESTS);
  const docRef = doc(supportRequestsRef);
  
  const newRequest: SupportRequest = {
    id: docRef.id,
    userId,
    userDisplayName,
    userEmail,
    category,
    subject,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    messages: [initialMessage]
  };

  await setDoc(docRef, newRequest);
  return docRef.id;
};

export const getSupportRequestsForUser = async (userId: string): Promise<SupportRequest[]> => {
  if (!db) return [];
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(d.data() as SupportRequest));
  return requests;
};

export const getAllSupportRequests = async (): Promise<SupportRequest[]> => {
  if (!db) return [];
  const q = query(collection(db, COLLECTIONS.SUPPORT_REQUESTS), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  const requests: SupportRequest[] = [];
  snap.forEach(d => requests.push(d.data() as SupportRequest));
  return requests;
};

export const addMessageToSupportRequest = async (
  requestId: string,
  senderId: string,
  senderName: string,
  isAdmin: boolean,
  content: string
): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Support request not found');
  }
  
  const request = docSnap.data() as SupportRequest;
  const now = new Date().toISOString();
  
  const newMessage: SupportMessage = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    senderId,
    senderName,
    senderRole: isAdmin ? USER_ROLE.ADMIN : USER_ROLE.USER,
    content,
    createdAt: now,
  };

  const updatedMessages = [...(request.messages || []), newMessage];
  
  await updateDoc(docRef, {
    messages: updatedMessages,
    updatedAt: now,
    status: 'open'
  });
};

export const updateSupportRequestStatus = async (requestId: string, status: SupportStatus): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  await updateDoc(docRef, {
    status,
    updatedAt: new Date().toISOString()
  });
};

export const deleteSupportRequest = async (requestId: string): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, COLLECTIONS.SUPPORT_REQUESTS, requestId);
  await deleteDoc(docRef);
};
