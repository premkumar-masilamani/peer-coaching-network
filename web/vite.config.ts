import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(import.meta.dirname, '..');
  const env = loadEnv(mode, envDir, '');
  const databaseId = env.VITE_FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID;

  if (mode !== 'test' && !databaseId) {
    throw new Error(
      'Missing required environment variable: VITE_FIRESTORE_DATABASE_ID. ' +
      'Please specify the Firestore database name in your environment configuration.'
    );
  }

  return {
    envDir,
    plugins: [react(), basicSsl()],
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return;
          warn(warning);
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'firebase';
              }
              return 'vendor';
            }
          }
        }
      }
    },
    server: {
      host: 'local.peercoachingnetwork.com',
      https: {},
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
    },
  };
})
