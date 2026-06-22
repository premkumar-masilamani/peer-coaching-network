import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Shield, 
  Calendar, 
  BookOpen, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Terminal,
  UserPlus
} from 'lucide-react';
import { type Theme, TABS, type TabKey, USER_ROLE, USER_STATUS, THEME } from '../config';

interface LeftNavProps {
  currentTab: TabKey;
  setCurrentTab: (tab: TabKey) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const LeftNav: React.FC<LeftNavProps> = ({ 
  currentTab, 
  setCurrentTab, 
  collapsed, 
  setCollapsed 
}) => {
  const { profile, role, logout, updateProfileDetails } = useAuth();
  const isAdmin = role === USER_ROLE.ADMIN && profile?.userStatus === USER_STATUS.ACTIVE;

  const toggleCollapse = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem('peer-coaching-nav-collapsed', JSON.stringify(nextState));
  };

  return (
    <aside className={`left-sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className="sidebar-nav">
        {/* Dashboard / Browse coaches */}
        <button
          onClick={() => setCurrentTab(TABS.DASHBOARD)}
          className={`sidebar-nav-item ${currentTab === TABS.DASHBOARD ? 'active' : ''}`}
          title={collapsed ? 'Dashboard' : undefined}
        >
          <span className="nav-icon">
            <Home size={18} />
          </span>
          <span className="nav-text">Dashboard</span>
        </button>

        {/* Admin Panel */}
        {isAdmin && (
          <button
            onClick={() => setCurrentTab(TABS.ADMIN)}
            className={`sidebar-nav-item ${currentTab === TABS.ADMIN ? 'active' : ''}`}
            title={collapsed ? 'Admin Panel' : undefined}
          >
            <span className="nav-icon">
              <Shield size={18} />
            </span>
            <span className="nav-text">Admin Panel</span>
          </button>
        )}

        {/* Invite Coaches */}
        {isAdmin && (
          <button
            onClick={() => setCurrentTab(TABS.INVITE_COACHES)}
            className={`sidebar-nav-item ${currentTab === TABS.INVITE_COACHES ? 'active' : ''}`}
            title={collapsed ? 'Invite Coaches' : undefined}
          >
            <span className="nav-icon">
              <UserPlus size={18} />
            </span>
            <span className="nav-text">Invite Coaches</span>
          </button>
        )}

        {/* System Logs */}
        {isAdmin && (
          <button
            onClick={() => setCurrentTab(TABS.SYSTEM_LOGS)}
            className={`sidebar-nav-item ${currentTab === TABS.SYSTEM_LOGS ? 'active' : ''}`}
            title={collapsed ? 'System Logs' : undefined}
          >
            <span className="nav-icon">
              <Terminal size={18} />
            </span>
            <span className="nav-text">System Logs</span>
          </button>
        )}

        {/* My Availability */}
        <button
          onClick={() => setCurrentTab(TABS.AVAILABILITY)}
          className={`sidebar-nav-item ${currentTab === TABS.AVAILABILITY ? 'active' : ''}`}
          title={collapsed ? 'My Availability' : undefined}
        >
          <span className="nav-icon">
            <Calendar size={18} />
          </span>
          <span className="nav-text">My Availability</span>
        </button>

        {/* My Bookings */}
        <button
          onClick={() => setCurrentTab(TABS.BOOKINGS)}
          className={`sidebar-nav-item ${currentTab === TABS.BOOKINGS ? 'active' : ''}`}
          title={collapsed ? 'My Bookings' : undefined}
        >
          <span className="nav-icon">
            <BookOpen size={18} />
          </span>
          <span className="nav-text">My Sessions</span>
        </button>

        {/* My Profile */}
        <button
          onClick={() => setCurrentTab(TABS.PROFILE)}
          className={`sidebar-nav-item ${currentTab === TABS.PROFILE ? 'active' : ''}`}
          title={collapsed ? 'My Profile' : undefined}
        >
          <span className="nav-icon">
            <User size={18} />
          </span>
          <span className="nav-text">My Profile</span>
        </button>
      </div>

      <div className="sidebar-footer">
        {/* Theme Toggle */}
        <button
          onClick={async () => {
            // Treat any value other than 'light' (incl. legacy 'system') as 'dark'
            const currentTheme: Theme = profile?.theme === THEME.LIGHT ? THEME.LIGHT : THEME.DARK;
            const nextTheme: Theme = currentTheme === THEME.LIGHT ? THEME.DARK : THEME.LIGHT;
            try {
              await updateProfileDetails({ theme: nextTheme });
            } catch (err) {
              console.error('Failed to toggle theme:', err);
            }
          }}
          className="sidebar-nav-item"
          style={{ cursor: 'pointer' }}
          title={collapsed ? (profile?.theme === THEME.LIGHT ? 'Switch to Dark Mode' : 'Switch to Light Mode') : undefined}
        >
          <span className="nav-icon">
            {profile?.theme === THEME.LIGHT ? <Moon size={18} /> : <Sun size={18} />}
          </span>
          <span className="nav-text">
            {profile?.theme === THEME.LIGHT ? 'Dark Mode' : 'Light Mode'}
          </span>
        </button>

        {/* Sign Out */}
        <button
          onClick={async () => {
            await logout();
          }}
          className="sidebar-nav-item"
          style={{ color: '#f87171', cursor: 'pointer' }}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <span className="nav-icon">
            <LogOut size={18} />
          </span>
          <span className="nav-text">Sign Out</span>
        </button>

        {/* Toggle Button */}
        <button 
          onClick={toggleCollapse}
          className="sidebar-toggle-btn"
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};
