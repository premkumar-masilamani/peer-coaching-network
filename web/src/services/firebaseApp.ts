import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { logger } from '../utils/logger';
import { USER_MESSAGES } from '../config';

// Required config that has no safe default. A real (cloud) build must supply them
// — we never silently fall back to dummy credentials.
const requiredConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  region: import.meta.env.VITE_FIREBASE_REGION,
};

const missingConfig = Object.entries(requiredConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);

/**
 * Set when required Firebase config is missing.
 * Instead of throwing at module-import time — which white-screens the whole app
 * before React can mount — we surface the problem here so the UI can render a
 * user-facing "configuration error" screen. `null` means config is valid.
 */
export let firebaseConfigError: string | null = null;

if (missingConfig.length > 0) {
  const message = `Missing required Firebase configuration: ${missingConfig.join(', ')}. ` +
    'Set these environment variables (see .env.development / Firebase project settings).';
  firebaseConfigError = message;
  logger.error(message);
} else {
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocalhost) {
    firebaseConfigError = USER_MESSAGES.SYSTEM.LOCAL_HOST_BLOCKED;
  }
}

const projectId = requiredConfig.projectId || '';

const firebaseConfig = {
  apiKey: requiredConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: requiredConfig.messagingSenderId,
  appId: requiredConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID;
export const db = getFirestore(app, databaseId);
export const functions = getFunctions(app, requiredConfig.region);

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

export const isFirebaseConfigured = missingConfig.length === 0;

export { auth };
