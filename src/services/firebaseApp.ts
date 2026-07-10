import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { logger } from '../utils/logger';

declare global {
  interface Window {
    _firebase_emulators_connected?: boolean;
  }
}

/**
 * Flag to connect to local Firebase emulators (Auth, Firestore) instead of Cloud.
 * Defaults to false. Set VITE_USE_FIREBASE_EMULATOR=true to enable.
 */
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

// Required config that has no safe default. Against the emulator these are not
// needed, but a real (cloud) build must supply them — we never silently fall
// back to dummy credentials.
const requiredConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (useEmulator ? 'peer-coaching-network-dev' : undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingConfig = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

if (!useEmulator && missingConfig.length > 0) {
  const message = `Missing required Firebase configuration: ${missingConfig.join(', ')}. ` +
    'Set these environment variables (see .env.prod / Firebase project settings).';
  // Fail fast in production rather than booting with broken credentials.
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID;
export const db = getFirestore(app, databaseId);

// Safe-initialize Google Analytics
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
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const alreadyConnected = typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>)._firebase_emulators_connected
    : (globalThis as unknown as Record<string, unknown>)._firebase_emulators_connected;
  if (isLocal && !alreadyConnected) {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>)._firebase_emulators_connected = true;
    } else {
      (globalThis as unknown as Record<string, unknown>)._firebase_emulators_connected = true;
    }
    try {
      connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, 8080);
      logger.info(`Connected to Auth and Firestore Emulators on ${host}`);
    } catch (e) {
      logger.error('Failed to connect to emulators:', e);
    }
  }
}

// Reflects whether real config was supplied (or we're running against the
// emulator), instead of being hardcoded true.
export const isFirebaseConfigured = useEmulator || missingConfig.length === 0;

export { auth };
