import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let databaseId = env.VITE_FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID;

  if (!databaseId && mode === 'production') {
    const devEnv = loadEnv('development', process.cwd(), '');
    databaseId = devEnv.VITE_FIRESTORE_DATABASE_ID;
  }

  if (mode !== 'test' && !databaseId) {
    throw new Error(
      'Missing required environment variable: VITE_FIRESTORE_DATABASE_ID. ' +
      'Please specify the Firestore database name (e.g. pcn-dev) in your environment configuration.'
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
    test: {
      environment: 'jsdom',
      globals: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/utils/**', 'src/services/**', 'src/context/**', 'src/hooks/**', 'src/templates/**'],
      },
    },
  };
})
