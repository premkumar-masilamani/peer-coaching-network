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
    test: {
      globals: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/utils/**', 'src/services/**', 'src/context/**', 'src/hooks/**', 'src/templates/**'],
      },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            // Match both .test.ts and .test.tsx — component/context suites that
            // render JSX must live in .tsx files, and were otherwise silently
            // skipped by a .ts-only glob.
            include: ['src/**/*.test.{ts,tsx}'],
            environment: 'jsdom',
          },
        },
        {
          test: {
            name: 'integration',
            include: ['tests/integration/**/*.test.ts'],
            globalSetup: ['tests/integration/globalSetup.ts'],
            environment: 'node',
            testTimeout: 30000,
            pool: 'forks',
            env: {
              VITE_USE_FIREBASE_EMULATOR: 'true',
              VITE_FIRESTORE_DATABASE_ID: '(default)',
              VITE_FIREBASE_PROJECT_ID: 'peer-coaching-network-dev',
              VITE_ENABLE_GOOGLE_INTEGRATION: 'false',
            },
          },
        },
      ],
    },
  };
})
