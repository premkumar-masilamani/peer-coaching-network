import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isCalendarSynced } from '../services/googleCalendar';
import { 
  Sparkles, 
  LogOut, 
  User, 
  Shield, 
  Calendar,
  Sun,
  Moon
} from 'lucide-react';
import { formatDisplayName, subscribeToAllUsers } from '../services/firebaseService';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  setAdminTabFilter?: (filter: 'all' | 'pending' | 'user' | 'admin') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab: _, setCurrentTab, setAdminTabFilter }) => {
  const { user, profile, role, logout, updateProfileDetails } = useAuth();
  const synced = isCalendarSynced();
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    if (role === 'admin') {
      const unsub = subscribeToAllUsers((usersList) => {
        const count = usersList.filter(u => {
          const status = u.userStatus || (u.role !== null ? 'active' : 'inactive');
          return status === 'inactive';
        }).length;
        setPendingCount(count);
      });
      return () => unsub();
    } else {
      setPendingCount(0);
    }
  }, [role]);

  if (!user) return null;

  return (
    <header className="glass-panel" style={{ 
      borderRadius: '0 0 16px 16px', 
      borderTop: 'none',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      marginBottom: '24px'
    }}>
      <div className="content-wrapper" style={{ 
        padding: '16px', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        margin: '0 auto'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => (role === 'user' || role === 'admin') && setCurrentTab('dashboard')}>
          <div style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Peer Coaching <span style={{ color: 'hsl(var(--primary))' }}>Network</span>
            </h3>
            <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>
              Collaborative Calendly for coaches
            </span>
          </div>
        </div>

        {/* User Badge and Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Calendar Status Indicator (For users and admins) */}
          {(role === 'user' || role === 'admin') && (
            <button 
              onClick={() => setCurrentTab('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                padding: '6px 10px',
                borderRadius: '20px',
                background: synced ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${synced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                color: synced ? '#34d399' : '#f87171',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              title="Go to My Profile to manage calendar sync"
            >
              <Calendar size={13} />
              <span className="hide-mobile">{synced ? 'Calendar Synced' : 'Calendar Offline'}</span>
            </button>
          )}

          {/* Member Requests link for Admin */}
          {role === 'admin' && pendingCount > 0 && (
            <button
              onClick={() => {
                setCurrentTab('admin');
                if (setAdminTabFilter) {
                  setAdminTabFilter('pending');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                padding: '6px 10px',
                borderRadius: '20px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                color: '#fbbf24',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              title="View pending approval requests in Admin Panel"
            >
              <Shield size={13} />
              <span>Member Requests ({pendingCount})</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={async () => {
              const currentTheme = profile?.theme || 'dark';
              const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
              try {
                await updateProfileDetails({ theme: nextTheme });
              } catch (e) {
                console.error('Failed to toggle theme:', e);
              }
            }}
            className="btn btn-secondary"
            title={`Switch to ${profile?.theme === 'light' ? 'dark' : 'light'} mode`}
            style={{ 
              padding: '8px', 
              fontSize: '0.85rem', 
              height: '38px', 
              width: '38px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {profile?.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Profile Dropdown */}
          <div className="profile-dropdown">
            <button style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px',
              borderRadius: '50%'
            }}>
              <img 
                src={profile?.photoURL || user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg'} 
                alt={formatDisplayName(profile || user) || 'User'} 
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--border-light)'
                }}
              />
            </button>
            <div className="dropdown-menu">
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', marginBottom: '4px' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatDisplayName(profile || user) || 'Coaching Peer'}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                  {profile?.email || user.email}
                </p>
                {profile?.createdAt && (
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Member since {profile.createdAt}
                  </p>
                )}
              </div>

              {role && (
                <>
                  <button onClick={() => setCurrentTab('profile')} className="dropdown-item">
                    <User size={14} />
                    My Profile
                  </button>
                  {role === 'admin' && (
                    <button onClick={() => setCurrentTab('admin')} className="dropdown-item">
                      <Shield size={14} />
                      Admin Panel
                    </button>
                  )}
                </>
              )}

              <button onClick={logout} className="dropdown-item" style={{ color: '#f87171' }}>
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
