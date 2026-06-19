import React from 'react';
import { TABS, type TabKey, type UserRole, type UserStatus, USER_ROLE, USER_STATUS } from '../config';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Shield } from 'lucide-react';
import { formatDisplayName, formatMemberSince, isApproved, subscribeToPendingUsersCount } from '../services/firebaseService';
import { sanitizeImageUrl } from '../utils/url';

interface HeaderProps {
  currentTab: TabKey;
  setCurrentTab: (tab: TabKey) => void;
  setAdminTabFilter?: (filter: 'all' | UserStatus | UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({ setCurrentTab, setAdminTabFilter }) => {
  const { user, profile, role } = useAuth();
  const [pendingCount, setPendingCount] = React.useState(0);

  const isActive = isApproved(profile);
  const isActiveAdmin = role === USER_ROLE.ADMIN && isActive;

  React.useEffect(() => {
    if (role === USER_ROLE.ADMIN && isActive) {
      // Subscribe to a count derived from only the pending docs, not the whole
      // users collection. See BUG-006. (The badge is hidden for non-admins, so
      // no explicit reset is needed when this branch is skipped.)
      const unsub = subscribeToPendingUsersCount(setPendingCount);
      return () => unsub();
    }
  }, [role, isActive]);

  if (!user) return null;

  return (
    <header className="glass-panel" style={{ 
      borderRadius: '0 0 16px 16px', 
      borderTop: 'none',
      flexShrink: 0,
      zIndex: 50,
      marginBottom: '16px'
    }}>
      <div className="content-wrapper" style={{ 
        padding: '16px', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        margin: '0 auto'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => (role === USER_ROLE.USER || role === USER_ROLE.ADMIN) && setCurrentTab(TABS.DASHBOARD)}>
          <div style={{
            background: 'hsl(var(--primary))',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px var(--primary-glow)'
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
          {/* Member Requests link for Admin */}
          {isActiveAdmin && pendingCount > 0 && (
            <button
              onClick={() => {
                setCurrentTab(TABS.ADMIN);
                if (setAdminTabFilter) {
                  setAdminTabFilter(USER_STATUS.INACTIVE);
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

          {/* User Details & Avatar (Static) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '4px',
              borderRadius: '8px',
              textAlign: 'right'
            }}
          >
            {/* User details displayed to the left of the profile picture */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-primary))', margin: 0 }}>
                {formatDisplayName(profile || user) || 'Coaching Peer'}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', margin: 0, marginTop: '2px' }}>
                {profile?.email || user.email}
              </p>
              {profile?.createdAt && (
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: 0, marginTop: '2px' }}>
                  Member since {formatMemberSince(profile.createdAt)}
                </p>
              )}
            </div>

            <img
              src={sanitizeImageUrl(profile?.photoURL || user.photoURL)}
              alt={formatDisplayName(profile || user) || 'User'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border-light)'
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
};
