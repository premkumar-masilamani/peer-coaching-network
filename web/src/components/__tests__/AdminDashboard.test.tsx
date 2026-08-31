// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdminDashboard } from '../AdminDashboard';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../UserManagement', () => ({
  UserManagement: () => <div>Mock UserManagement View</div>,
}));

vi.mock('../SystemLogs', () => ({
  SystemLogs: () => <div>Mock SystemLogs View</div>,
}));

vi.mock('../SupportDesk', () => ({
  SupportDesk: () => <div>Mock SupportDesk View</div>,
}));

describe('AdminDashboard component', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockSetFilter = vi.fn();

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

  it('renders default users tab and toggles between sub-tabs', async () => {
    await act(async () => {
      root!.render(<AdminDashboard initialFilter="all" setInitialFilter={mockSetFilter} />);
    });

    expect(container?.textContent).toContain('Mock UserManagement View');

    const logsBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('System Logs')
    );

    await act(async () => {
      logsBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.textContent).toContain('Mock SystemLogs View');

    const supportBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Support Desk')
    );

    await act(async () => {
      supportBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.textContent).toContain('Mock SupportDesk View');
  });
});
