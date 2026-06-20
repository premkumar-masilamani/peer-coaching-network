import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUpcomingEvents, cancelBooking } from '../services/googleCalendar';
import { logAnalyticsEvent } from '../services/firebaseService';
import type { CalendarEvent } from '../services/googleCalendar';
import {
  Calendar,
  Clock,
  Video,
  ExternalLink,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { sanitizeMeetLink } from '../utils/url';
import { getTimezoneCode } from '../utils/timezoneHelpers';
import { EVENT_TYPE } from '../config';

export const MyBookings: React.FC = () => {
  const { user, profile } = useAuth();
  const viewerTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [sessions, setSessions] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const loadSessions = async () => {
    setLoading(true);
    try {
      const list = await getUpcomingEvents();
      // Identify peer-coaching sessions by an explicit type tag.
      const coachingSessions = list.filter(e => e.type === EVENT_TYPE.PEER_COACHING);
      setSessions(coachingSessions);
    } catch (e) {
      console.error('Error loading bookings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      await cancelBooking(bookingId);
      logAnalyticsEvent('cancel_booking', { bookingId });
      await loadSessions();
    } catch (e) {
      console.error('Error cancelling booking:', e);
    } finally {
      setCancellingId(null);
    }
  };

  // Initial load. Inlined (rather than calling loadSessions) so no setState runs
  // synchronously in the effect body — loading already starts true. See BUG-015.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getUpcomingEvents();
        if (cancelled) return;
        const coachingSessions = list.filter(e => e.type === EVENT_TYPE.PEER_COACHING);
        setSessions(coachingSessions);
      } catch (e) {
        console.error('Error loading bookings:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!user) return null;

  const upcoming = sessions.filter(s => new Date(s.start.dateTime).getTime() >= now);
  const completed = sessions.filter(s => new Date(s.start.dateTime).getTime() < now);

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>My Sessions</h2>
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
            Centralised registry of all your upcoming and past peer coaching sessions.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={loadSessions} 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', fontSize: '0.85rem', height: '38px', gap: '6px' }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh List
          </button>

        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Syncing scheduled sessions...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Upcoming Sessions */}
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'hsl(var(--primary))' }} />
              Upcoming Sessions ({upcoming.length})
            </h3>
            
            {upcoming.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', color: 'hsl(var(--text-muted))' }}>
                <Clock size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.9rem' }}>No upcoming sessions scheduled. Browse the Dashboard to schedule a session with a peer coach.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {upcoming.map((session) => {
                  const start = new Date(session.start.dateTime);
                  const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;
                  const timeStr = `${start.toLocaleTimeString([], { timeZone: viewerTimezone, ...timeOpts })} ${getTimezoneCode(start, viewerTimezone)}`;
                  const dateStr = start.toLocaleDateString([], { timeZone: viewerTimezone, month: 'short', day: 'numeric', weekday: 'short', year: 'numeric' });
                  const safeMeetLink = sanitizeMeetLink(session.meetLink);
                  const isCancellable = session.type === EVENT_TYPE.PEER_COACHING;

                  return (
                    <div
                      key={session.id}
                      className="glass-panel glass-panel-interactive"
                      style={{ padding: '20px', borderLeft: '4px solid hsl(var(--primary))' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span className="badge badge-user" style={{ fontSize: '0.65rem', padding: '3px 8px', textTransform: 'none' }}>
                          Confirmed
                        </span>
                        {safeMeetLink && (
                          <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Video size={12} /> Google Meet
                          </span>
                        )}
                      </div>
                      
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--text-primary))', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {session.summary}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '8px' }}>
                        {dateStr}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} style={{ color: 'hsl(var(--primary))' }} />
                        {timeStr}
                      </p>

                      {session.description && (
                        <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '16px', lineHeight: 1.4, background: 'var(--panel-hover-bg)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          {session.description}
                        </p>
                      )}
                      
                      {safeMeetLink && (
                        <a
                          href={safeMeetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary"
                          style={{
                            width: '100%',
                            padding: '8px 16px',
                            fontSize: '0.8rem',
                            height: '34px',
                            gap: '6px'
                          }}
                        >
                          Join Google Meet
                          <ExternalLink size={12} />
                        </a>
                      )}

                      {isCancellable && (
                        <button
                          onClick={() => handleCancel(session.id)}
                          disabled={cancellingId === session.id}
                          className="btn btn-secondary"
                          style={{
                            width: '100%',
                            padding: '8px 16px',
                            fontSize: '0.8rem',
                            height: '34px',
                            gap: '6px',
                            marginTop: '8px',
                            borderColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171'
                          }}
                        >
                          <XCircle size={12} />
                          {cancellingId === session.id ? 'Cancelling...' : 'Cancel Session'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Completed Sessions */}
          {completed.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'hsl(var(--text-secondary))' }}>
                <Clock size={18} style={{ color: 'hsl(var(--text-muted))' }} />
                Past Sessions ({completed.length})
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {completed.map((session) => {
                  const start = new Date(session.start.dateTime);
                  const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;
                  const timeStr = `${start.toLocaleTimeString([], { timeZone: viewerTimezone, ...timeOpts })} ${getTimezoneCode(start, viewerTimezone)}`;
                  const dateStr = start.toLocaleDateString([], { timeZone: viewerTimezone, month: 'short', day: 'numeric', weekday: 'short', year: 'numeric' });
                  
                  return (
                    <div 
                      key={session.id} 
                      className="glass-panel" 
                      style={{ padding: '20px', opacity: 0.65, borderLeft: '4px solid hsl(var(--text-muted))' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span className="badge" style={{ fontSize: '0.65rem', padding: '3px 8px', textTransform: 'none', background: 'var(--btn-secondary-bg)', color: 'hsl(var(--text-muted))' }}>
                          Completed
                        </span>
                      </div>
                      
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'hsl(var(--text-secondary))', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {session.summary}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginBottom: '8px' }}>
                        {dateStr}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} />
                        {timeStr}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
