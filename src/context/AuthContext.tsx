/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    handleAuthRedirect()
      .catch(e => console.error("OAuth redirect handling error:", e))
      .finally(() => setIsHandlingRedirect(false));
  }, []);

  // Subscribe to Auth status
  useEffect(() => {
    const unsubAuth = subscribeToAuth((usr) => {
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
    return () => unsubAuth();
  }, []);

  // Apply a fetched profile to context state (profile + derived role), and kick
  // the lazy availability recalc for active coaches.
  const applyProfile = useCallback((uid: string, prof: UserProfile | null) => {
    if (prof) {
      setProfile(prof);
      const status = getEffectiveStatus(prof);
      const roleVal = getEffectiveRole(prof);
      setRole(status === USER_STATUS.ACTIVE ? roleVal : null);

      // If the user is an active coach, trigger lazy available slots cache recalculation
      if (status === USER_STATUS.ACTIVE && roleVal === USER_ROLE.USER) {
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

  const login = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error('Login error:', e);
      setLoading(false);
      throw e;
    }
  };

  const logout = async () => {
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
  };

  const updateProfileDetails = async (updates: Partial<UserProfile>) => {
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
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading: loading || isHandlingRedirect,
        isRealFirebase: isFirebaseConfigured,
        login,
        logout,
        updateProfileDetails,
      }}
    >
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
