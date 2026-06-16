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
import { isApproved } from './services/firebaseService';
import { Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, role, loading, profile } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [adminTabFilter, setAdminTabFilter] = useState<'all' | 'pending' | 'user' | 'admin'>('all');
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('peer-coaching-nav-collapsed');
    return saved ? JSON.parse(saved) : true;
  });

  // Sync theme with document class
  useEffect(() => {
    const theme = profile?.theme || 'system';
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
        if (e.matches) {
          document.documentElement.classList.add('light-theme');
        } else {
          document.documentElement.classList.remove('light-theme');
        }
      };
      
      // Initialize
      handleThemeChange(mediaQuery);
      
      // Subscribe
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleThemeChange);
      } else {
        mediaQuery.addListener(handleThemeChange);
      }
      
      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleThemeChange);
        } else {
          mediaQuery.removeListener(handleThemeChange);
        }
      };
    } else if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [profile?.theme]);

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
      <div className="app-container">
        <div className="bg-gradient-radial" />
        <main className="content-wrapper">
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
        <main className="content-wrapper">
          <VerificationNotice />
        </main>
      </div>
    );
  }

  // Approved User or Admin Panel router
  return (
    <div className="app-container">
      <div className="bg-gradient-radial" />
      <Header 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        setAdminTabFilter={setAdminTabFilter} 
      />
      
      <div className="content-wrapper">
        <div className="app-main-layout">
          <LeftNav 
            currentTab={currentTab} 
            setCurrentTab={setCurrentTab} 
            collapsed={navCollapsed} 
            setCollapsed={setNavCollapsed} 
          />
          
          <main style={{ flex: 1, minWidth: 0 }}>
            {currentTab === 'dashboard' && <CoachDashboard />}
            {currentTab === 'profile' && <ProfileEdit />}
            {currentTab === 'availability' && <AvailabilityEdit />}
            {currentTab === 'bookings' && <MyBookings />}
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
