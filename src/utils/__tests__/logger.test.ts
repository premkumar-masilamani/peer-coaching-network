/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

const { mockAddDoc, mockGetApps } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetApps: vi.fn(() => [] as any[]),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: mockGetApps,
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'user-123', email: 'user@example.com' },
  })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db, col) => ({ id: col, path: col })),
  addDoc: mockAddDoc,
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  Timestamp: {
    fromDate: (date: Date) => ({ toDate: () => date, seconds: Math.floor(date.getTime() / 1000) }),
  },
}));

describe('logger utility', () => {
  let consoleDebugSpy: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
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

    it('defaults to info level if VITE_LOG_LEVEL is unset or invalid', () => {
      vi.stubEnv('VITE_LOG_LEVEL', '');
      logger.debug('test debug');
      logger.info('test info');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalledWith('test info');
    });
  });

  describe('telemetry', () => {
    it('ignores logging telemetry if no Firebase apps are initialized', async () => {
      mockGetApps.mockReturnValueOnce([]);
      await logger.telemetry('info', 'some_event');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('successfully logs telemetry when Firebase is initialized', async () => {
      mockGetApps.mockReturnValueOnce([{}]);
      mockAddDoc.mockResolvedValueOnce({ id: 'log-id' });

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await logger.telemetry('info', 'test_telemetry', { val: 42 });

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const [colRef, data] = mockAddDoc.mock.calls[0];
      expect(colRef.path).toBe('systemLogs');
      expect(data.type).toBe('info');
      expect(data.event).toBe('test_telemetry');
      expect(data.userId).toBe('user-123');
      expect(data.details).toEqual({ val: 42 });
      expect(data.timestamp).toBe('server-timestamp');

      const expectedExpire = new Date(now + 7 * 24 * 60 * 60 * 1000);
      expect(data.expireAt.toDate().getTime()).toBe(expectedExpire.getTime());
    });

    it('handles Firestore failure gracefully without throwing exceptions', async () => {
      mockGetApps.mockReturnValueOnce([{}]);
      mockAddDoc.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(logger.telemetry('error', 'bad_event')).resolves.not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
