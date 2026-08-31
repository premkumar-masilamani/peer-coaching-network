// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Login } from '../Login';
import { USER_MESSAGES } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockLogin = vi.fn().mockResolvedValue(undefined);

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

vi.mock('../../services/firebaseService', () => ({
  logAnalyticsEvent: vi.fn(),
}));

describe('Login component', () => {
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

  it('renders brand title and sign in button', async () => {
    await act(async () => {
      root!.render(<Login />);
    });

    expect(container?.textContent).toContain(USER_MESSAGES.AUTH.LOGIN_TITLE);
    expect(container?.textContent).toContain(USER_MESSAGES.AUTH.SIGN_IN_GOOGLE);
  });

  it('triggers login on button click', async () => {
    await act(async () => {
      root!.render(<Login />);
    });

    const signInBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes(USER_MESSAGES.AUTH.SIGN_IN_GOOGLE)
    );

    await act(async () => {
      signInBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockLogin).toHaveBeenCalled();
  });
});
