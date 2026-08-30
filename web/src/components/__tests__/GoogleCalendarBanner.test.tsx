// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Flag to tell React 19 that we are running in an act environment
// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockReconnectGoogle = vi.fn();
const mockShowToast = vi.fn();
let mockIsGoogleTokenExpired = false;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isGoogleTokenExpired: mockIsGoogleTokenExpired,
    reconnectGoogle: mockReconnectGoogle,
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

import { GoogleCalendarBanner } from '../GoogleCalendarBanner';
import { USER_MESSAGES } from '../../config';

describe('GoogleCalendarBanner component', () => {
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

  it('renders nothing when token is not expired', async () => {
    mockIsGoogleTokenExpired = false;

    await act(async () => {
      root!.render(<GoogleCalendarBanner />);
    });

    expect(container?.innerHTML).toBe('');
  });

  it('renders banner and triggers reconnect when token is expired', async () => {
    mockIsGoogleTokenExpired = true;
    mockReconnectGoogle.mockResolvedValueOnce('fresh-token');

    await act(async () => {
      root!.render(<GoogleCalendarBanner />);
    });

    expect(container?.textContent).toContain(USER_MESSAGES.CALENDAR.EXPIRED_BANNER_TITLE);
    expect(container?.textContent).toContain(USER_MESSAGES.CALENDAR.EXPIRED_BANNER_DESC);

    const button = container?.querySelector('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain(USER_MESSAGES.CALENDAR.RECONNECT_BTN);

    await act(async () => {
      button.click();
    });

    expect(mockReconnectGoogle).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(USER_MESSAGES.CALENDAR.RECONNECT_SUCCESS);
  });
});
