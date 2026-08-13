const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'peer-coaching-network';
export const GOOGLE_API_BASE = isEmulator
  ? `http://localhost:5001/${projectId}/us-central1/mockGoogleCalendar`
  : 'https://www.googleapis.com';
