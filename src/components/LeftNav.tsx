import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Shield, 
  Calendar, 
  BookOpen, 
  User, 
  ChevronLeft, 
  ChevronRight 
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
  const { profile, role } = useAuth();
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
          <span className="nav-text">My Bookings</span>
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
