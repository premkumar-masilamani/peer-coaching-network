import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { AdminDashboard } from '../AdminDashboard';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../UserManagement', () => ({
  UserManagement: () => <div data-testid="user-management-view">User Management Mock</div>,
}));

vi.mock('../SystemLogs', () => ({
  SystemLogs: () => <div data-testid="system-logs-view">System Logs Mock</div>,
}));

vi.mock('../SupportDesk', () => ({
  SupportDesk: () => <div data-testid="support-desk-view">Support Desk Mock</div>,
}));

describe('AdminDashboard component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  it('renders standard sub-tabs ("Users & Roles", "System Logs", "Support Desk") and defaults to Users & Roles', async () => {
    const setInitialFilter = vi.fn();
    await act(async () => {
      root!.render(<AdminDashboard initialFilter="all" setInitialFilter={setInitialFilter} />);
    });

    expect(container!.textContent).toContain('Users & Roles');
    expect(container!.textContent).toContain('System Logs');
    expect(container!.textContent).toContain('Support Desk');
    expect(container!.textContent).not.toContain('Find a Coach');

    expect(container!.querySelector('[data-testid="user-management-view"]')).not.toBeNull();
  });

  it('switches tabs between Users & Roles, System Logs, and Support Desk when clicked', async () => {
    const setInitialFilter = vi.fn();
    await act(async () => {
      root!.render(<AdminDashboard initialFilter="all" setInitialFilter={setInitialFilter} />);
    });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const logsBtn = buttons.find(b => b.textContent?.trim() === 'System Logs');
    const supportBtn = buttons.find(b => b.textContent?.trim() === 'Support Desk');
    const usersBtn = buttons.find(b => b.textContent?.trim() === 'Users & Roles');

    expect(logsBtn).toBeDefined();
    expect(supportBtn).toBeDefined();

    // Click System Logs
    await act(async () => {
      logsBtn!.click();
    });
    expect(container!.querySelector('[data-testid="system-logs-view"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="user-management-view"]')).toBeNull();

    // Click Support Desk
    await act(async () => {
      supportBtn!.click();
    });
    expect(container!.querySelector('[data-testid="support-desk-view"]')).not.toBeNull();
    expect(container!.querySelector('[data-testid="system-logs-view"]')).toBeNull();

    // Click Users & Roles
    await act(async () => {
      usersBtn!.click();
    });
    expect(container!.querySelector('[data-testid="user-management-view"]')).not.toBeNull();
  });
});
