/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

const { mockWriteSystemLog, mockGetApps } = vi.hoisted(() => ({
  mockWriteSystemLog: vi.fn(),
  mockGetApps: vi.fn(() => [] as any[]),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: mockGetApps,
  getApp: vi.fn(() => ({})),
}));

// The logger delegates the actual Firestore write to the repository (via a
// dynamic import). Mock that boundary rather than the raw Firestore SDK.
vi.mock('../../services/firestoreRepository', () => ({
  writeSystemLog: mockWriteSystemLog,
}));

describe('logger utility', () => {
  let consoleDebugSpy: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', 'pcn-dev');
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe('console logging level filtering', () => {
    it('debug level prints all logs', () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'debug');
      logger.debug('test debug');
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');

      expect(consoleDebugSpy).toHaveBeenCalledWith('test debug');
      expect(consoleInfoSpy).toHaveBeenCalledWith('test info');
      expect(consoleWarnSpy).toHaveBeenCalledWith('test warn');
      expect(consoleErrorSpy).toHaveBeenCalledWith('test error');
    });

    it('info level prints info, warn, and error logs, but ignores debug logs', () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'info');
      logger.debug('test debug');
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith('test info');
      expect(consoleWarnSpy).toHaveBeenCalledWith('test warn');
      expect(consoleErrorSpy).toHaveBeenCalledWith('test error');
    });

    it('warn level prints warn and error logs, but ignores debug and info logs', () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'warn');
      logger.debug('test debug');
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('test warn');
      expect(consoleErrorSpy).toHaveBeenCalledWith('test error');
    });

    it('error level prints only error logs', () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'error');
      logger.debug('test debug');
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('test error');
    });

    it('defaults to error level if VITE_LOG_LEVEL is unset or invalid', () => {
      vi.stubEnv('VITE_LOG_LEVEL', '');
      logger.debug('test debug');
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('test error');
    });
  });

  describe('telemetry', () => {
    it('ignores logging telemetry if no Firebase apps are initialized', async () => {
      mockGetApps.mockReturnValueOnce([]);
      await logger.telemetry('info', 'some_event');
      expect(mockWriteSystemLog).not.toHaveBeenCalled();
    });

    it('delegates the write to the repository when Firebase is initialized', async () => {
      mockGetApps.mockReturnValueOnce([{}]);
      mockWriteSystemLog.mockResolvedValueOnce(undefined);

      await logger.telemetry('info', 'test_telemetry', { val: 42 });

      expect(mockWriteSystemLog).toHaveBeenCalledTimes(1);
      expect(mockWriteSystemLog).toHaveBeenCalledWith('info', 'test_telemetry', { val: 42 });
    });

    it('handles a repository write failure gracefully without throwing exceptions', async () => {
      mockGetApps.mockReturnValueOnce([{}]);
      mockWriteSystemLog.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(logger.telemetry('error', 'bad_event')).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
