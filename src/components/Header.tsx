import React from 'react';
import { TABS, type TabKey, type UserRole, type UserStatus, USER_ROLE, USER_STATUS, ENABLE_GOOGLE_INTEGRATION, GOOGLE_TOKEN_STATUS } from '../config';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Shield, CalendarCheck, CalendarX } from 'lucide-react';
import { formatDisplayName, formatMemberSince, isApproved, getPendingUsersCount } from '../services/firebaseService';
import { sanitizeImageUrl } from '../utils/url';
import { useFocusRefresh } from '../hooks/useFocusRefresh';

interface HeaderProps {
  currentTab: TabKey;
  setCurrentTab: (tab: TabKey, adminFilter?: 'all' | UserStatus | UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({ setCurrentTab }) => {
  const { user, profile, role, googleTokenStatus, login } = useAuth();
  const [pendingCount, setPendingCount] = React.useState(0);

  const isActive = isApproved(profile);
  const isActiveAdmin = role === USER_ROLE.ADMIN && isActive;
  const canNavigateHome = role === USER_ROLE.USER || role === USER_ROLE.ADMIN;

  // One-shot query for a count derived from only the pending docs, not the whole
  // users collection. (The badge is hidden for non-admins, so no explicit reset
  // is needed when the branch is skipped.) Refreshed on window focus so newly
  // registered members surface without a live subscription.
  const refreshPendingCount = React.useCallback(async () => {
    if (role !== USER_ROLE.ADMIN || !isActive) return;
    try {
      setPendingCount(await getPendingUsersCount());
    } catch (e) {
      console.error('Error loading pending users count:', e);
    }
  }, [role, isActive]);

  React.useEffect(() => {
    (async () => {
      await refreshPendingCount();
    })();
  }, [refreshPendingCount]);

  useFocusRefresh(refreshPendingCount);

  if (!user) return null;

  const logoContent = (
    <>
      <span style={{
        background: 'hsl(var(--primary))',
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px var(--primary-glow)'
      }}>
        <Sparkles size={20} color="#fff" />
      </span>
      <span>
        {/* Styled as a heading, but not an h3: headings are not valid inside a button. */}
        <span style={{
          display: 'block',
          fontFamily: 'var(--font-family-display)',
          color: 'hsl(var(--text-primary))',
          fontSize: '1.15rem',
          fontWeight: 800,
          letterSpacing: '-0.03em'
        }}>
          Peer Coaching <span style={{ color: 'hsl(var(--primary))' }}>Network</span>
        </span>
        <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>
          Collaborative Calendly for coaches
        </span>
      </span>
    </>
  );

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
        {/* Logo. Only a button when the role can actually navigate, so other
            roles do not get a focusable control that does nothing. A button may
            only contain phrasing content, hence the spans rather than div/h3. */}
        {canNavigateHome ? (
          <button
            type="button"
            className="logo-button"
            aria-label="Go to Dashboard"
            onClick={() => setCurrentTab(TABS.DASHBOARD)}
          >
            {logoContent}
          </button>
        ) : (
          <div className="logo-button">{logoContent}</div>
        )}

        {/* User Badge and Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Google Calendar Connection Status Badge */}
          {ENABLE_GOOGLE_INTEGRATION && (
            <button
              type="button"
              onClick={login}
              className={googleTokenStatus === GOOGLE_TOKEN_STATUS.EXPIRED ? 'animate-pulse-warning' : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                padding: '6px 10px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: '1px solid transparent',
                transition: 'all 0.2s ease',
                ...(googleTokenStatus === GOOGLE_TOKEN_STATUS.CONNECTED
                  ? {
                      background: 'rgba(16, 185, 129, 0.08)',
                      borderColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                    }
                  : googleTokenStatus === GOOGLE_TOKEN_STATUS.EXPIRED
                  ? {
                      background: 'rgba(245, 158, 11, 0.08)',
                      borderColor: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                    }
                  : {
                      background: 'rgba(156, 163, 175, 0.08)',
                      borderColor: 'rgba(156, 163, 175, 0.2)',
                      color: 'hsl(var(--text-muted))',
                    }),
              }}
              title={
                googleTokenStatus === GOOGLE_TOKEN_STATUS.CONNECTED
                  ? 'Google Calendar Linked. Click to reconnect/change account.'
                  : googleTokenStatus === GOOGLE_TOKEN_STATUS.EXPIRED
                  ? 'Your Google Calendar connection has expired. Click to reconnect.'
                  : 'Google Calendar is disconnected. Click to link your account.'
              }
            >
              {googleTokenStatus === GOOGLE_TOKEN_STATUS.CONNECTED ? (
                <CalendarCheck size={13} />
              ) : (
                <CalendarX size={13} />
              )}
              <span>
                {googleTokenStatus === GOOGLE_TOKEN_STATUS.CONNECTED
                  ? 'Calendar Linked'
                  : googleTokenStatus === GOOGLE_TOKEN_STATUS.EXPIRED
                  ? 'Calendar Expired (Reconnect)'
                  : 'Calendar Offline (Connect)'}
              </span>
            </button>
          )}

          {/* Member Requests link for Admin */}
          {isActiveAdmin && pendingCount > 0 && (
            <button
              onClick={() => {
                setCurrentTab(TABS.ADMIN, USER_STATUS.INACTIVE);
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
