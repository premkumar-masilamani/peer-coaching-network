// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SystemLogs } from '../SystemLogs';
import * as adminService from '../../services/adminService';
import { LOG_SEVERITY } from '../../config';

// Flag to tell React 19 that we are running in an act environment
// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/adminService', () => ({
  getLogsPage: vi.fn(),
  getSystemLogsByUser: vi.fn(),
}));

describe('SystemLogs component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  const mockLogs = [
    {
      id: 'log-1',
      type: LOG_SEVERITY.ERROR,
      event: 'LOGIN_FAILURE',
      userId: 'user-101',
      userEmail: 'user101@example.com',
      errorMessage: 'Invalid credentials',
      timestamp: 1700000000000,
      expireAt: 1700600000000,
    },
    {
      id: 'log-2',
      type: LOG_SEVERITY.WARN,
      event: 'HOUSEKEEPING_BATCH_FAILED',
      userId: null,
      userEmail: null,
      errorMessage: 'Timeout',
      timestamp: 1700000010000,
      expireAt: 1700600010000,
    },
  ];

  const mockUserTrace = [
    {
      id: 'log-1',
      type: LOG_SEVERITY.ERROR,
      event: 'LOGIN_FAILURE',
      userId: 'user-101',
      userEmail: 'user101@example.com',
      errorMessage: 'Invalid credentials',
      timestamp: 1700000000000,
      expireAt: 1700600000000,
    },
    {
      id: 'log-0',
      type: LOG_SEVERITY.WARN,
      event: 'PASSWORD_RESET_REQUESTED',
      userId: 'user-101',
      userEmail: 'user101@example.com',
      errorMessage: null,
      timestamp: 1699999000000,
      expireAt: 1700599000000,
    },
  ];

  it('renders log entries properly', async () => {
    vi.mocked(adminService.getLogsPage).mockResolvedValueOnce({
      logs: mockLogs,
      nextCursor: null,
      hasMore: false,
    });

    await act(async () => {
      root!.render(<SystemLogs />);
    });

    expect(container?.textContent).toContain('System Logs');
    expect(container?.textContent).toContain('LOGIN_FAILURE');
    expect(container?.textContent).toContain('HOUSEKEEPING_BATCH_FAILED');
    expect(container?.textContent).toContain('user101@example.com');
    expect(container?.textContent).toContain('System / Guest');
  });

  it('expands user log, fetches user activity trace, and caches result', async () => {
    vi.mocked(adminService.getLogsPage).mockResolvedValueOnce({
      logs: mockLogs,
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(adminService.getSystemLogsByUser).mockResolvedValueOnce(mockUserTrace);

    await act(async () => {
      root!.render(<SystemLogs />);
    });

    // Find the first row
    const firstRow = container?.querySelector('tbody tr.hover-row') as HTMLTableRowElement;
    expect(firstRow).not.toBeNull();

    // Click first row to expand
    await act(async () => {
      firstRow.click();
    });

    expect(adminService.getSystemLogsByUser).toHaveBeenCalledTimes(1);
    expect(adminService.getSystemLogsByUser).toHaveBeenCalledWith('user-101', 20);

    // Verify expanded content shows user activity trace
    expect(container?.textContent).toContain('Activity Trace for User:');
    expect(container?.textContent).toContain('user-101');
    expect(container?.textContent).toContain('PASSWORD_RESET_REQUESTED');

    // Click again to collapse
    await act(async () => {
      firstRow.click();
    });
    expect(container?.textContent).not.toContain('Activity Trace for User:');

    // Click once more to re-expand — should use cache, not call service again
    await act(async () => {
      firstRow.click();
    });
    expect(adminService.getSystemLogsByUser).toHaveBeenCalledTimes(1);
    expect(container?.textContent).toContain('Activity Trace for User:');
  });

  it('expands unassociated guest log without calling getSystemLogsByUser', async () => {
    vi.mocked(adminService.getLogsPage).mockResolvedValueOnce({
      logs: mockLogs,
      nextCursor: null,
      hasMore: false,
    });

    await act(async () => {
      root!.render(<SystemLogs />);
    });

    // Find all rows (2 rows)
    const rows = container?.querySelectorAll('tbody tr.hover-row');
    expect(rows?.length).toBe(2);

    const guestRow = rows![1] as HTMLTableRowElement;

    // Click guest row to expand
    await act(async () => {
      guestRow.click();
    });

    expect(adminService.getSystemLogsByUser).not.toHaveBeenCalled();
    expect(container?.textContent).toContain('System / Guest Event Details:');
    expect(container?.textContent).toContain('HOUSEKEEPING_BATCH_FAILED');
  });
});
