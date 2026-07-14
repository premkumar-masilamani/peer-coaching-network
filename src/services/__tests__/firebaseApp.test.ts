/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect } from 'vitest';
import { logEvent } from 'firebase/analytics';
import { logger } from '../../utils/logger';

const H = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return { authState: { currentUser: null as null | { uid: string } } };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock(H.authState));
vi.mock('firebase/firestore', async () => {
  const { createFirestoreShared, buildFirestoreMock } = await import('./helpers/firebaseMocks');
  return buildFirestoreMock(createFirestoreShared());
});
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());

describe('firebaseApp', () => {
  describe('isFirebaseConfigured', () => {
    it('is true when running against the emulator', async () => {
      const { isFirebaseConfigured } = await import('../firebaseApp');
      expect(isFirebaseConfigured).toBe(true);
    });
  });

  describe('logAnalyticsEvent', () => {
    it('is a safe no-op when VITE_FIREBASE_MEASUREMENT_ID is missing', async () => {
      vi.resetModules();
      vi.mocked(logEvent).mockClear();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', '');

      const { logAnalyticsEvent } = await import('../firebaseApp');
      logAnalyticsEvent('test_event', { foo: 'bar' });

      expect(logEvent).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it('logs via firebase analytics when a measurement id is present', async () => {
      vi.resetModules();
      vi.mocked(logEvent).mockClear();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TESTID123');

      const { logAnalyticsEvent } = await import('../firebaseApp');
      logAnalyticsEvent('test_event', { foo: 'bar' });

      expect(logEvent).toHaveBeenCalledWith(expect.any(Object), 'test_event', { foo: 'bar' });
      vi.unstubAllEnvs();
    });

    it('logs an error when logEvent throws', async () => {
      vi.resetModules();
      vi.mocked(logEvent).mockClear();
      vi.mocked(logger.error).mockClear();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TESTID123');
      vi.mocked(logEvent).mockImplementationOnce(() => { throw new Error('Analytics failed'); });

      const { logAnalyticsEvent } = await import('../firebaseApp');
      logAnalyticsEvent('test_event', { foo: 'bar' });

      expect(logger.error).toHaveBeenCalledWith('[Analytics] Failed to log event "test_event":', expect.any(Error));
      vi.unstubAllEnvs();
    });
  });

  describe('emulator connection', () => {
    it('logs an error if connectAuthEmulator throws', async () => {
      vi.resetModules();
      vi.mocked(logger.error).mockClear();
      const { connectAuthEmulator } = await import('firebase/auth');
      vi.mocked(connectAuthEmulator).mockImplementationOnce(() => { throw new Error('Emulator connection failed'); });

      if (typeof window !== 'undefined') {
        window._firebase_emulators_connected = false;
      }

      await import('../firebaseApp');

      expect(logger.error).toHaveBeenCalledWith('Failed to connect to emulators:', expect.any(Error));
    });
  });

  describe('configuration validation', () => {
    it('logs an error in dev mode when config is missing and the emulator is disabled', async () => {
      vi.resetModules();
      vi.mocked(logger.error).mockClear();
      vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', 'false');
      vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', 'pcn-dev');
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
      vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
      vi.stubEnv('VITE_FIREBASE_APP_ID', '');

      await import('../firebaseApp');

      expect(logger.error).toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it('throws an error in prod mode when config is missing and emulator is disabled', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_USE_FIREBASE_EMULATOR', 'false');
      vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', 'pcn-dev');
      vi.stubEnv('VITE_FIREBASE_API_KEY', '');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
      vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
      vi.stubEnv('VITE_FIREBASE_APP_ID', '');
      vi.stubEnv('PROD', true as any);

      try {
        await expect(import('../firebaseApp')).rejects.toThrow('Missing required Firebase configuration');
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('analytics initialization error', () => {
    it('logs an error when getAnalytics throws during setup', async () => {
      vi.resetModules();
      vi.mocked(logger.error).mockClear();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TESTID123');
      const { getAnalytics } = await import('firebase/analytics');
      vi.mocked(getAnalytics).mockImplementationOnce(() => { throw new Error('Init error'); });

      await import('../firebaseApp');

      expect(logger.error).toHaveBeenCalledWith('Failed to initialize Firebase Analytics:', expect.any(Error));
      vi.unstubAllEnvs();
    });
  });

  describe('node-only emulator connection', () => {
    it('sets _firebase_emulators_connected on globalThis when window is undefined', async () => {
      vi.resetModules();
      const originalWindow = globalThis.window;
      delete (globalThis as unknown as { window: unknown }).window;
      
      try {
        const globalRecord = globalThis as unknown as Record<string, unknown>;
        globalRecord._firebase_emulators_connected = false;

        await import('../firebaseApp');

        expect(globalRecord._firebase_emulators_connected).toBe(true);
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
