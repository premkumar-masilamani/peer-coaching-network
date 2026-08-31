// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { VerificationNotice } from '../VerificationNotice';
import { USER_ROLE, USER_STATUS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockLogout = vi.fn();

const mockProfile = {
  userId: 'u-pending',
  displayName: 'Pending Coach',
  email: 'pending@example.com',
  bio: 'Eager trainee coach',
  country: 'India',
  timezone: 'Asia/Kolkata',
  userRole: USER_ROLE.USER,
  userStatus: USER_STATUS.INACTIVE,
  icf_acc: true,
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u-pending', email: 'pending@example.com' },
    profile: mockProfile,
    logout: mockLogout,
  }),
}));

vi.mock('../../services/profileService', () => ({
  formatDisplayName: (u: { displayName?: string } | null | undefined) => u?.displayName || 'Pending Coach',
  formatMemberSince: () => 'January 2026',
}));

describe('VerificationNotice component', () => {
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

  it('renders application under review banner and submitted profile details', async () => {
    await act(async () => {
      root!.render(<VerificationNotice />);
    });

    expect(container?.textContent).toContain('Application Under Review');
    expect(container?.textContent).toContain('Pending Coach');
    expect(container?.textContent).toContain('Eager trainee coach');
    expect(container?.textContent).toContain('India');
  });

  it('triggers logout on sign out button click', async () => {
    await act(async () => {
      root!.render(<VerificationNotice />);
    });

    const signOutBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Sign Out')
    );

    await act(async () => {
      signOutBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockLogout).toHaveBeenCalled();
  });
});
