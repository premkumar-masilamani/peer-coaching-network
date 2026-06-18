import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Login } from './components/Login';
import { VerificationNotice } from './components/VerificationNotice';
import { CoachDashboard } from './components/CoachDashboard';
import { ProfileEdit } from './components/ProfileEdit';
import { AvailabilityEdit } from './components/AvailabilityEdit';
import { AdminDashboard } from './components/AdminDashboard';
import { LeftNav } from './components/LeftNav';
import { MyBookings } from './components/MyBookings';
import { SystemLogs } from './components/SystemLogs';
import { isApproved } from './services/firebaseService';
import { Sparkles, AlertTriangle, X } from 'lucide-react';

// Fields that matter for the non-blocking profile-complete banner.
// Returns a list of human-readable missing field names.
const getMissingProfileFields = (profile: ReturnType<typeof useAuth>['profile']): string[] => {
  const missing: string[] = [];
  if (!profile?.country) missing.push('Country');
  if (!profile?.bio) missing.push('Professional Bio');
  if (!profile?.gender || profile.gender === 'Prefer not to say') missing.push('Gender');
  return missing;
};

const AppContent: React.FC = () => {
  const { user, role, loading, profile } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [adminTabFilter, setAdminTabFilter] = useState<'all' | 'pending' | 'user' | 'admin'>('all');
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('peer-coaching-nav-collapsed');
    return saved ? JSON.parse(saved) : true;
  });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Sync theme with document class — only 'light' and 'dark' are supported.
  // Legacy 'system' values stored in Firestore are treated as 'dark'.
  useEffect(() => {
    if (profile?.theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [profile?.theme]);

  // Re-show the banner whenever the profile changes (e.g. after partial save)
  useEffect(() => {
    setBannerDismissed(false);
  }, [profile?.country, profile?.bio, profile?.gender]);

  const approved = isApproved(profile) && (role === 'admin' || role === 'user');

  // Route to the default panel when approval state transitions, using React's
  // recommended "adjust state during render" pattern rather than an effect (no
  // setTimeout hack, no cascading-render lint violation). See BUG-012/015.
  const [prevApproved, setPrevApproved] = useState(approved);
  if (approved !== prevApproved) {
    setPrevApproved(approved);
    setCurrentTab(approved ? 'dashboard' : 'pending');
  }

  // Loading Screen
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        gap: '16px'
      }}>
        <div className="bg-gradient-radial" />
        <div style={{
          background: 'hsl(var(--primary))',
          width: '50px',
          height: '50px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px var(--primary-glow)',
        }} className="animate-pulse">
          <Sparkles size={24} color="#fff" />
        </div>
        <p style={{ 
          fontSize: '0.9rem', 
          color: 'var(--text-secondary)', 
          fontWeight: 600, 
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          Loading Peer Coaching Network...
        </p>
      </div>
    );
  }

  // Unauthenticated: Land on Login Page
  if (!user) {
    return (
      <div className="app-container" style={{ height: 'auto', minHeight: '100vh', overflow: 'visible' }}>
        <div className="bg-gradient-radial" />
        <main className="content-wrapper" style={{ overflowY: 'visible', padding: '24px 16px' }}>
          <Login />
        </main>
      </div>
    );
  }

  // Authenticated but unapproved (No Role Assigned) or Inactive
  if (!approved) {
    return (
      <div className="app-container">
        <div className="bg-gradient-radial" />
        <Header 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
          setAdminTabFilter={setAdminTabFilter} 
        />
        <main className="content-wrapper" style={{ overflowY: 'auto', padding: '0 16px 16px 16px' }}>
          <VerificationNotice />
        </main>
      </div>
    );
  }

  // Compute missing profile fields for the non-blocking banner
  const missingFields = getMissingProfileFields(profile);
  const showBanner = missingFields.length > 0 && !bannerDismissed && currentTab !== 'profile';

  // Approved User or Admin Panel router
  return (
    <div className="app-container">
      <div className="bg-gradient-radial" />
      <Header 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        setAdminTabFilter={setAdminTabFilter} 
      />
      
      <div className="content-wrapper" style={{ overflow: 'hidden' }}>
        <div className="app-main-layout">
          <LeftNav 
            currentTab={currentTab} 
            setCurrentTab={setCurrentTab} 
            collapsed={navCollapsed} 
            setCollapsed={setNavCollapsed} 
          />
          
          <main style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', paddingRight: '16px', paddingBottom: '16px' }}>

            {/* ── Non-blocking profile completion banner ───────────────────── */}
            {showBanner && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'linear-gradient(135deg, hsl(var(--warning) / 0.1), hsl(var(--warning) / 0.05))',
                border: '1px solid hsl(var(--warning) / 0.35)',
                borderLeft: '4px solid hsl(var(--warning))',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '20px',
                marginTop: '16px',
                flexWrap: 'wrap',
              }}>
                <AlertTriangle size={18} color="hsl(var(--warning))" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Your profile is incomplete.{' '}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Complete your profile to use the app effectively and help other coaches discover you.{' '}
                    Missing: {missingFields.join(', ')}.
                  </span>
                </div>
                <button
                  onClick={() => setCurrentTab('profile')}
                  style={{
                    background: 'hsl(var(--warning))',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  My Profile →
                </button>
                <button
                  onClick={() => setBannerDismissed(true)}
                  aria-label="Dismiss"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    flexShrink: 0,
                    borderRadius: '6px',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {currentTab === 'dashboard' && <CoachDashboard />}
            {currentTab === 'profile' && <ProfileEdit />}
            {currentTab === 'availability' && <AvailabilityEdit />}
            {currentTab === 'bookings' && <MyBookings />}
            {currentTab === 'system-logs' && role === 'admin' && <SystemLogs />}
            {currentTab === 'admin' && role === 'admin' && (
              <AdminDashboard 
                initialFilter={adminTabFilter} 
                setInitialFilter={setAdminTabFilter} 
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
