import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const databaseId = env.VITE_FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID;

  if (mode !== 'test' && !databaseId) {
    throw new Error(
      'Missing required environment variable: VITE_FIRESTORE_DATABASE_ID. ' +
      'Please specify the Firestore database name in your environment configuration.'
    );
  }

  return {
    plugins: [react()],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
    },
  };
})
