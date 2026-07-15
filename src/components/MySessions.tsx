import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { useNow } from '../hooks/useNow';
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
import { CancelModal } from './modals/CancelModal';
import { getParticipantNames, getBookingTopic } from '../utils/calendarHelpers';
import { sanitizeMeetLink } from '../utils/url';
import { getTimezoneCode } from '../utils/timezoneHelpers';
import { EVENT_TYPE } from '../config';

export const MySessions: React.FC = () => {
  const { user, profile } = useAuth();
  const viewerTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [sessions, setSessions] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<CalendarEvent | null>(null);
  // Recomputed every minute / on focus so ended sessions move to "past" without
  // a manual reload (a mount-frozen timestamp left them classified as upcoming).
  const now = useNow();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [currentPage, setCurrentPage] = useState(1);

  const loadSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const list = await getUpcomingEvents();
      // Identify peer-coaching sessions by an explicit type tag.
      const coachingSessions = list.filter(e => e.type === EVENT_TYPE.PEER_COACHING);
      setSessions(coachingSessions);
    } catch (e) {
      console.error('Error loading bookings:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusRefresh(useCallback(() => {
    loadSessions(true);
  }, [loadSessions]));

  const handleCancel = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      await cancelBooking(bookingId);
      logAnalyticsEvent('cancel_booking', { bookingId });
      await loadSessions(true); // Silent refresh to avoid UI flicker
    } catch (e) {
      console.error('Error cancelling booking:', e);
    } finally {
      setCancellingId(null);
    }
  };

  // Initial load. Inlined (rather than calling loadSessions) so no setState runs
  // synchronously in the effect body — loading already starts true.
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

  // Memoize the split so the grouping memos below have stable inputs — filtering
  // inline recreated these arrays every render, defeating those useMemos.
  const upcoming = useMemo(
    () => sessions.filter(s => new Date(s.start.dateTime).getTime() >= now),
    [sessions, now]
  );
  const completed = useMemo(
    () => sessions.filter(s => new Date(s.start.dateTime).getTime() < now),
    [sessions, now]
  );

  const groupedUpcoming = useMemo(() => {
    const groups: { [dateStr: string]: CalendarEvent[] } = {};
    upcoming.forEach(session => {
      const start = new Date(session.start.dateTime);
      const dateStr = start.toLocaleDateString([], { 
        timeZone: viewerTimezone, 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(session);
    });
    
    return Object.keys(groups)
      .sort((a, b) => new Date(groups[a][0].start.dateTime).getTime() - new Date(groups[b][0].start.dateTime).getTime())
      .map(dateStr => ({
        dateStr,
        sessions: groups[dateStr].sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime())
      }));
  }, [upcoming, viewerTimezone]);

  const groupedPast = useMemo(() => {
    const groups: { [dateStr: string]: CalendarEvent[] } = {};
    completed.forEach(session => {
      const start = new Date(session.start.dateTime);
      const dateStr = start.toLocaleDateString([], { 
        timeZone: viewerTimezone, 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(session);
    });
    
    return Object.keys(groups)
      .sort((a, b) => new Date(groups[b][0].start.dateTime).getTime() - new Date(groups[a][0].start.dateTime).getTime())
      .map(dateStr => ({
        dateStr,
        sessions: groups[dateStr].sort((a, b) => new Date(b.start.dateTime).getTime() - new Date(a.start.dateTime).getTime())
      }));
  }, [completed, viewerTimezone]);

  const activeGroups = activeTab === 'upcoming' ? groupedUpcoming : groupedPast;
  const totalPages = Math.max(1, Math.ceil(activeGroups.length / 5));
  const paginatedGroups = activeGroups.slice((currentPage - 1) * 5, currentPage * 5);

  if (!user) return null;

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>My Sessions</h2>
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
            Centralised registry of all your upcoming and past peer coaching sessions.
          </p>
        </div>
      </div>

      {!loading && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
          <button
            onClick={() => { setActiveTab('upcoming'); setCurrentPage(1); }}
            className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', borderRadius: '20px' }}
          >
            Upcoming Sessions
          </button>
          <button
            onClick={() => { setActiveTab('past'); setCurrentPage(1); }}
            className={`btn ${activeTab === 'past' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', borderRadius: '20px' }}
          >
            Past Sessions
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Syncing scheduled sessions...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: activeTab === 'past' ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-primary))' }}>
              <Calendar size={18} style={{ color: activeTab === 'upcoming' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))' }} />
              {activeTab === 'upcoming' ? `Upcoming Sessions (${upcoming.length})` : `Past Sessions (${completed.length})`}
            </h3>
            
            {paginatedGroups.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', color: 'hsl(var(--text-muted))' }}>
                <Clock size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.9rem' }}>
                  {activeTab === 'upcoming' 
                    ? 'No upcoming sessions scheduled. Browse the Dashboard to schedule a session with a peer coach.' 
                    : 'No past sessions found.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {paginatedGroups.map((group) => (
                  <div key={group.dateStr}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: 'hsl(var(--text-secondary))', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      {group.dateStr}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                      {group.sessions.map((session) => {
                        const start = new Date(session.start.dateTime);
                        const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;
                        const timeStr = `${start.toLocaleTimeString([], { timeZone: viewerTimezone, ...timeOpts })} ${getTimezoneCode(start, viewerTimezone)}`;
                        const safeMeetLink = sanitizeMeetLink(session.meetLink);
                        const isCancellable = activeTab === 'upcoming' && session.type === EVENT_TYPE.PEER_COACHING;

                        return (
                          <div
                            key={session.id}
                            className={`glass-panel ${activeTab === 'upcoming' ? 'glass-panel-interactive' : ''}`}
                            style={{ 
                              padding: '20px', 
                              borderLeft: `4px solid ${activeTab === 'upcoming' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))'}`,
                              opacity: activeTab === 'past' ? 0.65 : 1
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                              <span 
                                className={`badge ${activeTab === 'upcoming' ? 'badge-user' : ''}`} 
                                style={{ 
                                  fontSize: '0.65rem', 
                                  padding: '3px 8px', 
                                  textTransform: 'none',
                                  background: activeTab === 'past' ? 'var(--btn-secondary-bg)' : undefined,
                                  color: activeTab === 'past' ? 'hsl(var(--text-muted))' : undefined
                                }}
                              >
                                {activeTab === 'upcoming' ? 'Confirmed' : 'Completed'}
                              </span>
                              {activeTab === 'upcoming' && (
                                safeMeetLink ? (
                                  <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Video size={12} /> Google Meet
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Video size={12} /> Link pending
                                  </span>
                                )
                              )}
                            </div>
                            
                            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: activeTab === 'upcoming' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))', lineHeight: '1.4' }}>
                              {session.summary}
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: activeTab === 'upcoming' ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-muted))', marginBottom: activeTab === 'upcoming' ? '16px' : '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={12} style={{ color: activeTab === 'upcoming' ? 'hsl(var(--primary))' : undefined }} />
                              {timeStr}
                            </p>

                            {session.description && activeTab === 'upcoming' && (
                              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '16px', lineHeight: 1.4, background: 'var(--panel-hover-bg)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                {session.description}
                              </p>
                            )}
                            
                            {activeTab === 'upcoming' && (
                              safeMeetLink ? (
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
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="btn btn-primary"
                                  style={{
                                    width: '100%',
                                    padding: '8px 16px',
                                    fontSize: '0.8rem',
                                    height: '34px',
                                    gap: '6px',
                                    opacity: 0.5,
                                    cursor: 'not-allowed'
                                  }}
                                >
                                  Join Link Pending
                                  <ExternalLink size={12} />
                                </button>
                              )
                            )}

                            {isCancellable && (
                              <button
                                onClick={() => setBookingToCancel(session)}
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
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '32px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel confirmation modal overlay */}
      <CancelModal
        isOpen={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onConfirm={async () => {
          if (!bookingToCancel) return;
          const idToCancel = bookingToCancel.id;
          await handleCancel(idToCancel);
          setBookingToCancel(null);
        }}
        isCancelling={!!cancellingId}
        coachName={bookingToCancel ? getParticipantNames(bookingToCancel, user.uid, profile).coachName : ''}
        clientName={bookingToCancel ? getParticipantNames(bookingToCancel, user.uid, profile).clientName : ''}
        topic={bookingToCancel ? getBookingTopic(bookingToCancel) : ''}
        date={bookingToCancel ? new Date(bookingToCancel.start.dateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
        time={bookingToCancel ? new Date(bookingToCancel.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: viewerTimezone }) + ` ${getTimezoneCode(new Date(bookingToCancel.start.dateTime), viewerTimezone)}` : ''}
      />
    </div>
  );
};
