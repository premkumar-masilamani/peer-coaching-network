/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import {
  subscribeToAuth,
  getProfile,
  loginWithGoogle,
  handleAuthRedirect,
  logout as fbLogout,
  updateOwnProfile,
  getEffectiveRole,
  getEffectiveStatus,
  isFirebaseConfigured,
  lazyRecalculateAvailableSlotsCache
} from '../services/firebaseService';
import type { UserProfile } from '../services/firebaseService';
import { type UserRole, USER_ROLE, USER_STATUS } from '../config';


interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null | undefined; // undefined = loading/unset, null = no role (pending)
  loading: boolean;
  isRealFirebase: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfileDetails: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [isHandlingRedirect, setIsHandlingRedirect] = useState(true);

  // Handle OAuth Redirect Result
  useEffect(() => {
    console.log('[AuthContext] Triggering handleAuthRedirect effect...');
    handleAuthRedirect()
      .then(res => console.log('[AuthContext] handleAuthRedirect completed, result:', res))
      .catch(e => console.error("OAuth redirect handling error:", e))
      .finally(() => {
        console.log('[AuthContext] Setting isHandlingRedirect to false');
        setIsHandlingRedirect(false);
      });
  }, []);

  // Subscribe to Auth status
  useEffect(() => {
    console.log('[AuthContext] Subscribing to Auth status...');
    const unsubAuth = subscribeToAuth((usr) => {
      console.log('[AuthContext] onAuthStateChanged callback fired. User:', usr?.uid, usr?.email);
      setUser(usr);
      if (!usr) {
        setProfile(null);
        setRole(undefined);
        setLoading(false);
      } else {
        // Re-enter loading until the profile snapshot resolves.
        setLoading(true);
      }
    });
    return () => {
      console.log('[AuthContext] Unsubscribing from Auth status...');
      unsubAuth();
    };
  }, []);

  // Apply a fetched profile to context state (profile + derived role), and kick
  // the lazy availability recalc for active coaches.
  const applyProfile = useCallback((uid: string, prof: UserProfile | null) => {
    if (prof) {
      setProfile(prof);
      const status = getEffectiveStatus(prof);
      const roleVal = getEffectiveRole(prof);
      setRole(status === USER_STATUS.ACTIVE ? roleVal : null);

      // If the user is active (coach or admin), trigger lazy available slots cache recalculation
      if (status === USER_STATUS.ACTIVE && (roleVal === USER_ROLE.USER || roleVal === USER_ROLE.ADMIN)) {
        lazyRecalculateAvailableSlotsCache(uid);
      }
    } else {
      setProfile(null);
      setRole(null);
    }
  }, []);

  // Fetch the user profile once auth is resolved (one-shot query, not a live
  // subscription). Own-profile edits re-fetch via updateProfileDetails below.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const prof = await getProfile(user.uid);
        if (cancelled) return;
        applyProfile(user.uid, prof);
      } catch (e) {
        console.error('Profile load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, applyProfile]);

  // Stable callback identities so the memoized context value below only changes
  // when the underlying state does — otherwise every provider render would hand
  // consumers a fresh value object and re-render all of them.
  const login = useCallback(async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error('Login error:', e);
      setLoading(false);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fbLogout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setProfile(null);
      setRole(undefined);
      setLoading(false);
    }
  }, []);

  const updateProfileDetails = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateOwnProfile(user.uid, updates);
      // Re-fetch to reflect the saved changes (previously delivered by the live
      // profile snapshot).
      const prof = await getProfile(user.uid);
      applyProfile(user.uid, prof);
    } catch (e) {
      console.error('Update profile error:', e);
      throw e;
    }
  }, [user, applyProfile]);

  // Memoize the context value so consumers don't re-render on every provider
  // render — only when one of these dependencies actually changes.
  const contextValue = useMemo(
    () => ({
      user,
      profile,
      role,
      loading: loading || isHandlingRedirect,
      isRealFirebase: isFirebaseConfigured,
      login,
      logout,
      updateProfileDetails,
    }),
    [user, profile, role, loading, isHandlingRedirect, login, logout, updateProfileDetails]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
