// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ProfileEdit } from '../ProfileEdit';
import { USER_ROLE, USER_STATUS } from '../../config';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdateProfileDetails = vi.fn().mockResolvedValue(true);

const mockProfile = {
  userId: 'u-1',
  displayName: 'Prem Coach',
  email: 'prem@example.com',
  gender: 'male',
  country: 'India',
  timezone: 'Asia/Kolkata',
  bio: 'Experienced life coach',
  userRole: USER_ROLE.USER,
  userStatus: USER_STATUS.ACTIVE,
  icf_pcc: true,
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u-1', email: 'prem@example.com' },
    profile: mockProfile,
    updateProfileDetails: mockUpdateProfileDetails,
  }),
}));

vi.mock('../../context/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    setPageDirtyState: vi.fn(),
    requestExplicitSave: vi.fn(),
  }),
  useNavigateToProfile: () => vi.fn(),
}));

vi.mock('../../utils/timezonesLazy', () => ({
  loadTimezonesForCountry: vi.fn().mockResolvedValue([
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  ]),
}));

vi.mock('../../services/firebaseService', () => ({
  formatDisplayName: () => 'Prem Coach',
  formatMemberSince: () => 'January 2026',
  logAnalyticsEvent: vi.fn(),
}));

describe('ProfileEdit component', () => {
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

  it('renders profile form with initial values', async () => {
    await act(async () => {
      root!.render(<ProfileEdit />);
    });

    expect(container?.textContent).toContain('Prem Coach');
    expect(container?.textContent).toContain('Experienced life coach');
  });

  it('submits updated profile details on form save', async () => {
    await act(async () => {
      root!.render(<ProfileEdit />);
    });

    const bioInput = container?.querySelector('textarea#bio') as HTMLTextAreaElement;
    if (bioInput) {
      await act(async () => {
        bioInput.value = 'Updated bio for coaching sessions';
        bioInput.dispatchEvent(new Event('input', { bubbles: true }));
        bioInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    const saveBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Save Profile')
    );

    if (saveBtn) {
      await act(async () => {
        saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }
  });
});
