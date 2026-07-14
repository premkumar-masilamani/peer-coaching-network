/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { AuthProvider, useAuth } from '../AuthContext';
import * as firebaseService from '../../services/firebaseService';

// Tell React we are in an act-supporting environment to suppress warnings
// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/firebaseService', () => {
  return {
    subscribeToAuth: vi.fn(),
    getProfile: vi.fn(),
    loginWithGoogle: vi.fn(),
    handleAuthRedirect: vi.fn(),
    logout: vi.fn(),
    updateOwnProfile: vi.fn(),
    getEffectiveRole: vi.fn(),
    getEffectiveStatus: vi.fn(),
    lazyRecalculateAvailableSlotsCache: vi.fn(),
    isFirebaseConfigured: true,
  };
});

describe('AuthContext', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let authCallback: ((user: any) => void) | null = null;

  let latestContextValue: any = null;

  const TestConsumer = () => {
    latestContextValue = useAuth();
    return <div id="consumer">Consumer</div>;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    authCallback = null;
    latestContextValue = null;

    vi.mocked(firebaseService.subscribeToAuth).mockImplementation((cb) => {
      authCallback = cb;
      return () => {};
    });
    vi.mocked(firebaseService.handleAuthRedirect).mockResolvedValue(false);

    // Default: profile fetch resolves to null; individual tests override.
    vi.mocked(firebaseService.getProfile).mockResolvedValue(null);

    vi.mocked(firebaseService.getEffectiveStatus).mockImplementation((prof: any) => {
      return prof?.status || 'inactive';
    });

    vi.mocked(firebaseService.getEffectiveRole).mockImplementation((prof: any) => {
      return prof?.role || 'user';
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    if (container) {
      document.body.removeChild(container);
    }
    vi.clearAllMocks();
  });

  it('initially sets loading to true and fields to default values', () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(latestContextValue.loading).toBe(true);
    expect(latestContextValue.user).toBeNull();
    expect(latestContextValue.profile).toBeNull();
    expect(latestContextValue.role).toBeUndefined();
  });

  it('updates state when user is not authenticated', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(authCallback).not.toBeNull();

    await act(async () => {
      authCallback!(null);
    });

    expect(latestContextValue.loading).toBe(false);
    expect(latestContextValue.user).toBeNull();
    expect(latestContextValue.profile).toBeNull();
    expect(latestContextValue.role).toBeUndefined();
  });

  it('updates state when user is authenticated and active profile is fetched', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const mockUser = { uid: 'user123', email: 'test@example.com' };
    const mockProfile = { uid: 'user123', status: 'active', role: 'admin' };

    // Deferred so we can observe the pending (loading) state before the fetch resolves.
    let resolveProfile: (p: any) => void = () => {};
    vi.mocked(firebaseService.getProfile).mockImplementation(
      () => new Promise((res) => { resolveProfile = res; })
    );

    await act(async () => {
      authCallback!(mockUser);
    });

    expect(firebaseService.getProfile).toHaveBeenCalledWith('user123');
    expect(latestContextValue.loading).toBe(true);

    await act(async () => {
      resolveProfile(mockProfile);
      await Promise.resolve();
    });

    expect(latestContextValue.loading).toBe(false);
    expect(latestContextValue.user).toEqual(mockUser);
    expect(latestContextValue.profile).toEqual(mockProfile);
    expect(latestContextValue.role).toBe('admin');
  });

  it('sets role to null if user profile is inactive', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const mockUser = { uid: 'user123' };
    const mockProfile = { uid: 'user123', status: 'inactive', role: 'admin' };
    vi.mocked(firebaseService.getProfile).mockResolvedValue(mockProfile as any);

    await act(async () => {
      authCallback!(mockUser);
    });

    expect(latestContextValue.role).toBeNull();
  });

  it('handles null profile state', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const mockUser = { uid: 'user123' };
    vi.mocked(firebaseService.getProfile).mockResolvedValue(null);

    await act(async () => {
      authCallback!(mockUser);
    });

    expect(latestContextValue.profile).toBeNull();
    expect(latestContextValue.role).toBeNull();
  });

  it('calls loginWithGoogle and updates loading during login', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    vi.mocked(firebaseService.loginWithGoogle).mockResolvedValue(undefined);

    let loginPromise: Promise<any>;
    act(() => {
      loginPromise = latestContextValue.login();
    });

    expect(latestContextValue.loading).toBe(true);
    expect(firebaseService.loginWithGoogle).toHaveBeenCalled();

    await act(async () => {
      await loginPromise;
    });
  });

  it('handles login errors by resetting loading and re-throwing', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const mockError = new Error('Login failed');
    vi.mocked(firebaseService.loginWithGoogle).mockRejectedValue(mockError);

    let loginPromise: Promise<any>;
    act(() => {
      loginPromise = latestContextValue.login();
    });

    // Suppress expected console.error during rejection test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      try {
        await loginPromise;
      } catch (e) {
        expect((e as Error).message).toBe('Login failed');
      }
    });

    consoleErrorSpy.mockRestore();
    expect(latestContextValue.loading).toBe(false);
  });

  it('calls logout and resets local state on success', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    vi.mocked(firebaseService.logout).mockResolvedValue(undefined);

    let logoutPromise: Promise<any>;
    act(() => {
      logoutPromise = latestContextValue.logout();
    });

    expect(latestContextValue.loading).toBe(true);
    expect(firebaseService.logout).toHaveBeenCalled();

    await act(async () => {
      await logoutPromise;
    });

    expect(latestContextValue.user).toBeNull();
    expect(latestContextValue.profile).toBeNull();
    expect(latestContextValue.role).toBeUndefined();
    expect(latestContextValue.loading).toBe(false);
  });

  it('resets local state on logout error', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    vi.mocked(firebaseService.logout).mockRejectedValue(new Error('Logout failed'));

    let logoutPromise: Promise<any>;
    act(() => {
      logoutPromise = latestContextValue.logout();
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      await logoutPromise;
    });

    consoleErrorSpy.mockRestore();

    expect(latestContextValue.user).toBeNull();
    expect(latestContextValue.profile).toBeNull();
    expect(latestContextValue.role).toBeUndefined();
    expect(latestContextValue.loading).toBe(false);
  });

  it('calls updateOwnProfile when updating profile details', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    // Not logged in: does nothing
    await act(async () => {
      await latestContextValue.updateProfileDetails({ displayName: 'New Name' });
    });
    expect(firebaseService.updateOwnProfile).not.toHaveBeenCalled();

    // Logged in
    const mockUser = { uid: 'user123' };
    act(() => {
      authCallback!(mockUser);
    });

    vi.mocked(firebaseService.updateOwnProfile).mockResolvedValue(undefined);

    await act(async () => {
      await latestContextValue.updateProfileDetails({ displayName: 'New Name' });
    });

    expect(firebaseService.updateOwnProfile).toHaveBeenCalledWith('user123', { displayName: 'New Name' });
  });

  it('re-throws update profile errors', async () => {
    act(() => {
      root!.render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const mockUser = { uid: 'user123' };
    act(() => {
      authCallback!(mockUser);
    });

    vi.mocked(firebaseService.updateOwnProfile).mockRejectedValue(new Error('Update failed'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let updatePromise: Promise<any>;
    act(() => {
      updatePromise = latestContextValue.updateProfileDetails({ displayName: 'New Name' });
    });

    await act(async () => {
      try {
        await updatePromise;
      } catch (e) {
        expect((e as Error).message).toBe('Update failed');
      }
    });

    consoleErrorSpy.mockRestore();
  });

  it('throws an error when useAuth is consumed outside AuthProvider', () => {
    const BadComponent = () => {
      useAuth();
      return null;
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      act(() => {
        root!.render(<BadComponent />);
      });
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleErrorSpy.mockRestore();
  });
});
