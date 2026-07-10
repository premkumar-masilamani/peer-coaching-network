import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Set emulator environment variables before initializing admin SDK
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'peer-coaching-network-dev';

const app = getApps().length === 0 
  ? initializeApp({ projectId }) 
  : getApps()[0];

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app, process.env.VITE_FIRESTORE_DATABASE_ID || '(default)');
