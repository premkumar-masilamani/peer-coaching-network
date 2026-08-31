import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../logger';
import { LOG_SEVERITY } from '../../config';

const { mockWriteSystemLog } = vi.hoisted(() => ({
  mockWriteSystemLog: vi.fn(),
}));

vi.mock('../../services/firestoreRepository', () => ({
  writeSystemLog: mockWriteSystemLog,
}));

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => [{ name: '[DEFAULT]' }]),
}));

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides logging methods debug, info, warn, error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Test error message');
    expect(errorSpy).toHaveBeenCalledWith('Test error message');
    errorSpy.mockRestore();
  });

  it('dispatches telemetry to writeSystemLog in firestoreRepository', async () => {
    await logger.telemetry(LOG_SEVERITY.ERROR, 'TEST_ERROR', { key: 'value' });
    expect(mockWriteSystemLog).toHaveBeenCalledWith(LOG_SEVERITY.ERROR, 'TEST_ERROR', { key: 'value' });
  });
});
