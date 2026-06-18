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
  Terminal
} from 'lucide-react';

interface LeftNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
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
  const isAdmin = role === 'admin' && profile?.userStatus === 'active';

  const toggleCollapse = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem('peer-coaching-nav-collapsed', JSON.stringify(nextState));
  };

  return (
    <aside className={`left-sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className="sidebar-nav">
        {/* Home / Browse coaches */}
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`sidebar-nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          title={collapsed ? 'Home' : undefined}
        >
          <span className="nav-icon">
            <Home size={18} />
          </span>
          <span className="nav-text">Home</span>
        </button>

        {/* Admin Panel */}
        {isAdmin && (
          <button
            onClick={() => setCurrentTab('admin')}
            className={`sidebar-nav-item ${currentTab === 'admin' ? 'active' : ''}`}
            title={collapsed ? 'Admin Panel' : undefined}
          >
            <span className="nav-icon">
              <Shield size={18} />
            </span>
            <span className="nav-text">Admin Panel</span>
          </button>
        )}

        {/* System Logs */}
        {isAdmin && (
          <button
            onClick={() => setCurrentTab('system-logs')}
            className={`sidebar-nav-item ${currentTab === 'system-logs' ? 'active' : ''}`}
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
          onClick={() => setCurrentTab('availability')}
          className={`sidebar-nav-item ${currentTab === 'availability' ? 'active' : ''}`}
          title={collapsed ? 'My Availability' : undefined}
        >
          <span className="nav-icon">
            <Calendar size={18} />
          </span>
          <span className="nav-text">My Availability</span>
        </button>

        {/* My Bookings */}
        <button
          onClick={() => setCurrentTab('bookings')}
          className={`sidebar-nav-item ${currentTab === 'bookings' ? 'active' : ''}`}
          title={collapsed ? 'My Bookings' : undefined}
        >
          <span className="nav-icon">
            <BookOpen size={18} />
          </span>
          <span className="nav-text">My Sessions</span>
        </button>

        {/* My Profile */}
        <button
          onClick={() => setCurrentTab('profile')}
          className={`sidebar-nav-item ${currentTab === 'profile' ? 'active' : ''}`}
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
            const currentTheme: 'light' | 'dark' = profile?.theme === 'light' ? 'light' : 'dark';
            const nextTheme: 'light' | 'dark' = currentTheme === 'light' ? 'dark' : 'light';
            try {
              await updateProfileDetails({ theme: nextTheme });
            } catch (err) {
              console.error('Failed to toggle theme:', err);
            }
          }}
          className="sidebar-nav-item"
          style={{ cursor: 'pointer' }}
          title={collapsed ? (profile?.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode') : undefined}
        >
          <span className="nav-icon">
            {profile?.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </span>
          <span className="nav-text">
            {profile?.theme === 'light' ? 'Dark Mode' : 'Light Mode'}
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
