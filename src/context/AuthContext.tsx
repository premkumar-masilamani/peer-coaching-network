/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  subscribeToAuth,
  subscribeToProfile,
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

  // Subscribe to user profile updates once auth is resolved
  useEffect(() => {
    if (!user) return;

    const unsubProfile = subscribeToProfile(user.uid, (prof) => {
      if (prof) {
        setProfile(prof);
        const status = getEffectiveStatus(prof);
        const roleVal = getEffectiveRole(prof);
        setRole(status === USER_STATUS.ACTIVE ? roleVal : null);

        // If the user is an active coach, trigger lazy available slots cache recalculation
        if (status === USER_STATUS.ACTIVE && roleVal === USER_ROLE.USER) {
          lazyRecalculateAvailableSlotsCache(user.uid).catch((err) => {
            console.error('Failed lazy availability recalculation on login:', err);
          });
        }
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubProfile();
  }, [user]);

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
