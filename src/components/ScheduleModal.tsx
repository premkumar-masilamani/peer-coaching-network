import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { scheduleMeeting, isCalendarSynced } from '../services/googleCalendar';
import type { CalendarEvent } from '../services/googleCalendar';
import type { UserProfile } from '../services/firebaseService';
import { formatDisplayName } from '../services/firebaseService';
import { 
  X, 
  Calendar, 
  Clock, 
  Video, 
  AlertCircle, 
  CheckCircle,
  ExternalLink,
  BookOpen
} from 'lucide-react';

interface ScheduleModalProps {
  coach: UserProfile;
  startTime: Date;
  endTime: Date;
  onClose: () => void;
  onBookingSuccess?: (event: CalendarEvent) => void;
}

const getTimezoneCode = (date: Date, timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short'
    }).formatToParts(date);
    return parts.find(p => p.type === 'timeZoneName')?.value || timeZone;
  } catch {
    return timeZone;
  }
};

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ 
  coach, 
  startTime, 
  endTime, 
  onClose,
  onBookingSuccess
}) => {
  const { profile, user } = useAuth();
  const [topic, setTopic] = useState('');
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'booking' | 'success' | 'error'>('idle');
  const [createdEvent, setCreatedEvent] = useState<CalendarEvent | null>(null);

  const synced = isCalendarSynced();
  const viewerTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  
  const timeString = startTime.toLocaleTimeString([], { 
    timeZone: viewerTimezone,
    hour: '2-digit', 
    minute: '2-digit' 
  }) + ' - ' + endTime.toLocaleTimeString([], { 
    timeZone: viewerTimezone,
    hour: '2-digit', 
    minute: '2-digit' 
  }) + ' ' + getTimezoneCode(startTime, viewerTimezone);

  const dateString = startTime.toLocaleDateString([], {
    timeZone: viewerTimezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setBookingStatus('booking');

    try {
      const event = await scheduleMeeting(
        !!profile?.role,
        coach.email || 'coach@example.com',
        coach.displayName || 'Coach',
        profile?.displayName || user?.displayName || 'Peer',
        startTime.toISOString(),
        endTime.toISOString(),
        topic.trim()
      );
      setCreatedEvent(event);
      setBookingStatus('success');
      if (onBookingSuccess) {
        onBookingSuccess(event);
      }
    } catch (err) {
      console.error(err);
      setBookingStatus('error');
    }
  };

  return (
    <div className="modal-overlay" style={{ pointerEvents: 'auto' }}>
      <div className="glass-panel modal-content" style={{ padding: '32px', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'hsl(var(--text-muted))',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* State 1: Booking Success Screen */}
        {bookingStatus === 'success' && createdEvent && (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--success))',
              margin: '0 auto 20px auto'
            }}>
              <CheckCircle size={32} />
            </div>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Session Confirmed!</h3>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginBottom: '24px' }}>
              We have scheduled the calendar invite and sent it to <strong>{formatDisplayName(coach)}</strong>.
            </p>

            <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', textAlign: 'left', marginBottom: '24px' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '6px' }}><strong>Topic:</strong> {topic}</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                <strong>Time:</strong> {dateString} at {timeString}
              </p>
              
              {createdEvent.meetLink && (
                <div style={{ 
                  borderTop: '1px solid rgba(255,255,255,0.05)', 
                  paddingTop: '12px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>
                    <Video size={14} />
                    Google Meet Room Generated
                  </div>
                  <a 
                    href={createdEvent.meetLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', width: '100%', gap: '6px' }}
                  >
                    Join Google Meet
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%' }}>
              Close Window
            </button>
          </div>
        )}

        {/* State 2: Booking Form */}
        {bookingStatus !== 'success' && (
          <form onSubmit={handleBook}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '4px' }}>Book Peer Session</h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
              Scheduling with <strong>{formatDisplayName(coach)}</strong> ({coach.qualifications?.join(', ') || 'Coach'})
            </p>

            {/* Date & Time details read-only block */}
            <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '0.9rem' }}>
                <Calendar size={15} color="hsl(var(--primary))" />
                <span><strong>Date:</strong> {dateString}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <Clock size={15} color="hsl(var(--primary))" />
                <span><strong>Time:</strong> {timeString}</span>
              </div>
            </div>

            {/* Meeting Topic */}
            <div className="form-group">
              <label className="form-label" htmlFor="topic-input">
                <BookOpen size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Meeting Focus / Topic
              </label>
              <input
                id="topic-input"
                type="text"
                className="input-field"
                placeholder="e.g. Life coaching feedback, ICF log hours practice..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Alert if current user calendar is offline */}
            {!synced && (
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(251, 191, 36, 0.05)',
                border: '1px solid rgba(251, 191, 36, 0.15)',
                color: '#fbbf24',
                fontSize: '0.75rem',
                marginTop: '16px'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>You haven't synced your Google Calendar. This booking will trigger in sandbox mode. Go to "My Profile" to sync.</span>
              </div>
            )}

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={!topic.trim() || bookingStatus === 'booking'}
                style={{ flex: 2 }}
              >
                {bookingStatus === 'booking' ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
