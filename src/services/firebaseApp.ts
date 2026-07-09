import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { logger } from '../utils/logger';

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

const requiredConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (useEmulator ? 'peer-coaching-network-dev' : undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingConfig = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

export const isFirebaseConfigured = useEmulator || missingConfig.length === 0;

if (!useEmulator && missingConfig.length > 0) {
  const message = `Missing required Firebase configuration: ${missingConfig.join(', ')}. ` +
    'Set these environment variables (see .env.prod / Firebase project settings).';
  if (import.meta.env.PROD) {
    throw new Error(message);
  } else {
    logger.error(message);
  }
}

const projectId = requiredConfig.projectId || 'peer-coaching-network-dev';

const firebaseConfig = {
  apiKey: requiredConfig.apiKey || (useEmulator ? 'mock-api-key' : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: requiredConfig.messagingSenderId || (useEmulator ? 'mock-sender-id' : undefined),
  appId: requiredConfig.appId || (useEmulator ? 'mock-app-id' : undefined),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID;
export const db = getFirestore(app, databaseId);

let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    logger.error('Failed to initialize Firebase Analytics:', err);
  }
}

export const logAnalyticsEvent = (eventName: string, params?: Record<string, unknown>) => {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
      logger.debug(`[Analytics] Event logged: ${eventName}`, params);
    } catch (err) {
      logger.error(`[Analytics] Failed to log event "${eventName}":`, err);
    }
  }
};

if (useEmulator) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && !window._firebase_emulators_connected) {
    window._firebase_emulators_connected = true;
    try {
      const host = window.location.hostname;
      connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, 8080);
      logger.info(`Connected to Auth and Firestore Emulators on ${host}`);
    } catch (e) {
      logger.error('Failed to connect to emulators:', e);
    }
  }
}
