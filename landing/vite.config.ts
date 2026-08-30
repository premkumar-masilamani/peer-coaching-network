import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(import.meta.dirname, '..');
  loadEnv(mode, envDir, '');

  return {
    envDir,
    plugins: [react()],
    server: {
      port: 5174,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
    }
  };
})
