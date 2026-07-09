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
  db,
  recalculateAvailableSlotsCache
} from '../services/firebaseService';
import type { UserProfile } from '../services/firebaseService';
import { doc, getDoc } from 'firebase/firestore';
import { type UserRole, USER_ROLE, USER_STATUS, COLLECTIONS } from '../config';


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
        setRole(getEffectiveStatus(prof) === 'active' ? getEffectiveRole(prof) : null);
        
        // Stale cache checking & lazy background refresh
        if (prof.userRole === USER_ROLE.USER && getEffectiveStatus(prof) === USER_STATUS.ACTIVE) {
          const cacheRef = doc(db, COLLECTIONS.PERSONAL_AVAILABILITY_CACHE, user.uid);
          getDoc(cacheRef).then((cacheSnap) => {
            let shouldRefresh = !cacheSnap.exists();
            if (cacheSnap.exists()) {
              const data = cacheSnap.data();
              const lastUpdated = data?.lastUpdated;
              if (lastUpdated) {
                const ageMs = Date.now() - new Date(lastUpdated).getTime();
                if (ageMs > 24 * 60 * 60 * 1000) {
                  shouldRefresh = true;
                }
              } else {
                shouldRefresh = true;
              }
            }
            if (shouldRefresh) {
              recalculateAvailableSlotsCache(user.uid).catch(console.error);
            }
          }).catch(console.error);
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
