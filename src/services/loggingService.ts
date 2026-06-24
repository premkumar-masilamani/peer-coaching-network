import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

let db: Firestore | null = null;
let auth: Auth | null = null;

export const initializeLogger = (firestoreInstance: Firestore, authInstance: Auth): void => {
  db = firestoreInstance;
  auth = authInstance;
};

import { type LogSeverity, COLLECTIONS } from '../config';

export type LogType = LogSeverity;

export const logEvent = async (
  type: LogType,
  event: string,
  details: Record<string, unknown> = {}
): Promise<void> => {
  try {
    if (!db) return;
    const userId = auth?.currentUser?.uid || null;
    const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL

    await addDoc(collection(db, COLLECTIONS.SYSTEM_LOGS), {
      type,
      event,
      userId,
      details,
      timestamp: serverTimestamp(),
      expireAt: Timestamp.fromDate(expireAt),
    });
  } catch (err) {
    console.error(`Failed to log event "${event}" to Firestore:`, err);
  }
};
