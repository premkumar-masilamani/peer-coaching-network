const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
export const ENABLE_GOOGLE_INTEGRATION = !isEmulator && import.meta.env.VITE_ENABLE_GOOGLE_INTEGRATION !== 'false';
