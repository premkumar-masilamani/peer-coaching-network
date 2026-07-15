/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  formatDisplayName,
  formatMemberSince,
  updateProfile,
  updateOwnProfile,
  getProfile,
  getAllUsers,
  getActiveCoaches,
  getPendingUsersCount,
  setUserRoleAndStatus,
  updateVerifiedCredentials,
  getProfiles,
} from '../profileService';

const H = vi.hoisted(() => {
  (import.meta.env as any).VITE_USE_FIREBASE_EMULATOR = 'true';
  (import.meta.env as any).VITE_FIRESTORE_DATABASE_ID = 'pcn-dev';
  return {
    authState: { currentUser: null as null | { uid: string } },
    shared: {
      mockGetDoc: vi.fn(), mockSetDoc: vi.fn(), mockUpdateDoc: vi.fn(),
      mockGetDocs: vi.fn(), mockOnSnapshot: vi.fn(), mockDeleteDoc: vi.fn(),
      mockBatchSet: vi.fn(), mockBatchUpdate: vi.fn(), mockBatchDelete: vi.fn(), mockBatchCommit: vi.fn(() => Promise.resolve()),
    },
  };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', async () => (await import('./helpers/firebaseMocks')).buildAnalyticsMock());
vi.mock('firebase/auth', async () => (await import('./helpers/firebaseMocks')).buildAuthMock(H.authState));
vi.mock('firebase/firestore', async () => (await import('./helpers/firebaseMocks')).buildFirestoreMock(H.shared));
vi.mock('../../utils/logger', async () => (await import('./helpers/firebaseMocks')).buildLoggerMock());

const { mockGetDoc, mockUpdateDoc, mockGetDocs } = H.shared;

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.authState.currentUser = null;
    // Fire-and-forget recalc triggered by mutators → clean no-op.
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('formatDisplayName', () => {
    it('prefers first/last name', () => {
      expect(formatDisplayName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
    });
    it('strips parentheses from a legacy displayName', () => {
      expect(formatDisplayName({ displayName: 'John Doe (Coach)' })).toBe('John Doe');
    });
    it('handles null/undefined/empty', () => {
      expect(formatDisplayName(null)).toBe('');
      expect(formatDisplayName(undefined)).toBe('');
      expect(formatDisplayName({ displayName: null })).toBe('');
    });
  });

  describe('formatMemberSince', () => {
    it('returns empty for null/undefined', () => {
      expect(formatMemberSince(null)).toBe('');
      expect(formatMemberSince(undefined)).toBe('');
    });
    it('formats a Firestore Timestamp', () => {
      const d = new Date('2026-06-18T00:00:00Z');
      expect(formatMemberSince({ toDate: () => d } as unknown as Timestamp)).toBe('June 2026');
    });
    it('formats an ISO string', () => {
      expect(formatMemberSince('2026-06-18T00:00:00Z')).toBe('June 2026');
    });
    it('falls back to the raw string for unparseable input', () => {
      expect(formatMemberSince('not-a-date')).toBe('not-a-date');
    });
  });

  describe('updateProfile', () => {
    it('writes the updates directly', async () => {
      await updateProfile('user-123', { bio: 'hello' });
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { bio: 'hello' });
    });
  });

  describe('updateOwnProfile', () => {
    it('writes only safe fields and strips privileged ones', async () => {
      await updateOwnProfile('user-123', { displayName: 'New Name', bio: 'New Bio', userRole: 'admin', userStatus: 'active' } as any);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.displayName).toBe('New Name');
      expect(updates.bio).toBe('New Bio');
      expect(updates.userRole).toBeUndefined();
      expect(updates.userStatus).toBeUndefined();
    });

    it('skips the write when no safe field changed', async () => {
      await updateOwnProfile('user-123', { userRole: 'admin' } as any);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('setUserRoleAndStatus', () => {
    it('updates role and status via updateProfile', async () => {
      await setUserRoleAndStatus('user-123', 'admin', 'active');
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { userRole: 'admin', userStatus: 'active' });
    });
  });

  describe('updateVerifiedCredentials', () => {
    it('maps qualifications to icf_* booleans', async () => {
      await updateVerifiedCredentials('coach-cred', ['ICF ACC']);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const updates = mockUpdateDoc.mock.calls[0][1];
      expect(updates.icf_acc).toBe(true);
      expect(updates.icf_pcc).toBe(false);
      expect(updates.icf_mcc).toBe(false);
      expect(updates.icf_actc).toBe(false);
    });
  });

  describe('getProfile', () => {
    it('returns the profile when the doc exists', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ userId: 'u1', displayName: 'Jane' }) });
      expect(await getProfile('u1')).toEqual({ userId: 'u1', displayName: 'Jane' });
    });
    it('returns null when the doc is missing', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      expect(await getProfile('u1')).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('maps the snapshot to a users array', async () => {
      mockGetDocs.mockResolvedValueOnce({ forEach: (f: any) => { f({ data: () => ({ userId: 'u1' }) }); f({ data: () => ({ userId: 'u2' }) }); } });
      expect(await getAllUsers()).toEqual([{ userId: 'u1' }, { userId: 'u2' }]);
    });
  });

  describe('getActiveCoaches', () => {
    it('returns active coaches', async () => {
      mockGetDocs.mockResolvedValueOnce({ forEach: (f: any) => f({ data: () => ({ userId: 'active' }) }) });
      expect(await getActiveCoaches()).toEqual([{ userId: 'active' }]);
    });
  });

  describe('getPendingUsersCount', () => {
    it('returns the query size', async () => {
      mockGetDocs.mockResolvedValueOnce({ size: 5 });
      expect(await getPendingUsersCount()).toBe(5);
    });
  });

  describe('getProfiles', () => {
    it('returns [] for an empty uid list without querying', async () => {
      expect(await getProfiles([])).toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('fetches matching user documents', async () => {
      mockGetDocs.mockResolvedValueOnce({ forEach: (cb: any) => cb({ data: () => ({ userId: 'coach1', firstName: 'Alice' }) }) });
      const result = await getProfiles(['coach1']);
      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('Alice');
    });
  });
});
