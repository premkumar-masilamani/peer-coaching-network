import { getApps } from 'firebase/app';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const getLogLevel = (): number => {
  const envLevel = (import.meta.env.VITE_LOG_LEVEL || 'error').toLowerCase();
  return LOG_LEVELS[envLevel as LogLevel] ?? LOG_LEVELS.error;
};

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= getLogLevel();
};

import { type LogSeverity } from '../config';

export const logger = {
  debug: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('debug')) {
      console.debug(message, ...optionalParams);
    }
  },

  info: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('info')) {
      console.info(message, ...optionalParams);
    }
  },

  warn: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(message, ...optionalParams);
    }
  },

  error: (message: string, ...optionalParams: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(message, ...optionalParams);
    }
  },

  // IMPORTANT: the `details` keys written here are constrained by an allowlist in
  // firestore.rules (`isValidSystemLogDetails`). Adding a NEW key to any
  // telemetry call requires adding it to that allowlist, otherwise the write is
  // rejected by security rules and silently swallowed by the catch below.
  telemetry: async (
    type: LogSeverity,
    event: string,
    details: Record<string, unknown> = {}
  ): Promise<void> => {
    try {
      // Nothing to write until Firebase is bootstrapped.
      if (getApps().length === 0) return;
      // The write itself lives in the Firestore repository. It is pulled in via a
      // dynamic import because the logger sits below firebaseApp in the module
      // graph (firebaseApp imports the logger); a static import of the repository
      // (which imports firebaseApp) would create an initialization cycle.
      const { writeSystemLog } = await import('../services/firestoreRepository');
      await writeSystemLog(type, event, details);
    } catch (err) {
      console.error(`Failed to log telemetry event "${event}" to Firestore:`, err);
    }
  }
};
