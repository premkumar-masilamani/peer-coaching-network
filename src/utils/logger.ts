import { getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const getLogLevel = (): number => {
  const envLevel = (import.meta.env.VITE_LOG_LEVEL || 'error').toLowerCase();
  return LOG_LEVELS[envLevel as LogLevel] ?? LOG_LEVELS.error;
};

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= getLogLevel();
};

import { type LogSeverity } from '../config';

export const logger = {
  debug: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('debug')) {
      console.debug(message, ...optionalParams);
    }
  },

  info: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('info')) {
      console.info(message, ...optionalParams);
    }
  },

  warn: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(message, ...optionalParams);
    }
  },

  error: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(message, ...optionalParams);
    }
  },

  telemetry: async (
    type: LogSeverity,
    event: string,
    details: Record<string, unknown> = {}
  ): Promise<void> => {
    try {
      const apps = getApps();
      if (apps.length === 0) return;
      const app = getApp();
      const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID;
      if (!databaseId) {
        throw new Error(
          'Missing required environment variable: VITE_FIRESTORE_DATABASE_ID. ' +
          'Please specify the Firestore database name (e.g. pcn-dev) in your environment configuration.'
        );
      }
      const db = getFirestore(app, databaseId);
      const auth = getAuth(app);
      
      const userId = auth.currentUser?.uid || null;
      const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL

      await addDoc(collection(db, 'systemLogs'), {
        type,
        event,
        userId,
        details,
        timestamp: serverTimestamp(),
        expireAt: Timestamp.fromDate(expireAt)
      });
    } catch (err) {
      console.error(`Failed to log telemetry event "${event}" to Firestore:`, err);
    }
  }
};
