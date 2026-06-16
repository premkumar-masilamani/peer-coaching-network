/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  subscribeToAuth,
  subscribeToProfile,
  loginWithGoogle,
  logout as fbLogout,
  updateOwnProfile,
  getEffectiveRole,
  getEffectiveStatus,
  isFirebaseConfigured
} from '../services/firebaseService';
import type { UserProfile } from '../services/firebaseService';


interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: 'admin' | 'user' | null | undefined; // undefined = loading/unset, null = no role (pending)
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
  const [role, setRole] = useState<'admin' | 'user' | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

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
        setRole(getEffectiveStatus(prof) === 'active' ? getEffectiveRole(prof) : null);
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
        loading,
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
