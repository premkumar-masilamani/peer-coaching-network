import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { USER_MESSAGES } from '../config';

export const GoogleCalendarBanner: React.FC = () => {
  const { isGoogleTokenExpired, reconnectGoogle } = useAuth();
  const { showToast } = useToast();
  const [isReconnecting, setIsReconnecting] = useState(false);

  if (!isGoogleTokenExpired) return null;

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await reconnectGoogle();
      showToast(USER_MESSAGES.CALENDAR.RECONNECT_SUCCESS);
    } catch (err) {
      console.error('Failed to reconnect Google Calendar:', err);
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'linear-gradient(135deg, hsl(var(--danger) / 0.1), hsl(var(--danger) / 0.05))',
        border: '1px solid hsl(var(--danger) / 0.35)',
        borderLeft: '4px solid hsl(var(--danger))',
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '20px',
        marginTop: '16px',
        flexWrap: 'wrap',
      }}
    >
      <AlertTriangle size={18} color="hsl(var(--danger))" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
          {USER_MESSAGES.CALENDAR.EXPIRED_BANNER_TITLE}.{' '}
        </span>
        <span style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>
          {USER_MESSAGES.CALENDAR.EXPIRED_BANNER_DESC}
        </span>
      </div>
      <div style={{ flexShrink: 0 }}>
        <button
          type="button"
          disabled={isReconnecting}
          onClick={handleReconnect}
          className="btn btn-primary"
        >
          {isReconnecting && <RefreshCw size={14} className="animate-spin" />}
          <span>{isReconnecting ? USER_MESSAGES.CALENDAR.RECONNECTING_BTN : USER_MESSAGES.CALENDAR.RECONNECT_BTN}</span>
        </button>
      </div>
    </div>
  );
};
