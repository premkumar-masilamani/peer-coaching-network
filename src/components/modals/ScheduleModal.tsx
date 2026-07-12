import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { scheduleMeeting } from '../../services/googleCalendar';
import type { CalendarEvent } from '../../services/googleCalendar';
import { logger } from '../../utils/logger';
import { type UserProfile } from '../../services/types';
import { formatDisplayName } from '../../services/profileService';
import { logAnalyticsEvent } from '../../services/firebaseApp';
import { sanitizeMeetLink } from '../../utils/url';
import { getTimezoneCode } from '../../utils/timezoneHelpers';
import { 
  Calendar, 
  Clock, 
  Video, 
  CheckCircle,
  AlertCircle,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { Modal } from './Modal';
import { BOOKING_ERROR, type BookingError, BOOKING_ERROR_MESSAGES, SCHEDULE_MODAL_STATUS, type ScheduleModalStatus, INPUT_LIMITS } from '../../config';
import { collectValidationErrors, clearFieldError, type FormErrors } from '../../utils/formValidation';

interface ScheduleModalProps {
  coach: UserProfile;
  startTime: Date;
  endTime: Date;
  onClose: () => void;
  onBookingSuccess?: (event: CalendarEvent) => void;
}



export const ScheduleModal: React.FC<ScheduleModalProps> = ({ 
  coach, 
  startTime, 
  endTime, 
  onClose,
  onBookingSuccess
}) => {
  const { profile, user, login } = useAuth();
  const [topic, setTopic] = useState('');
  const [bookingStatus, setBookingStatus] = useState<ScheduleModalStatus>(SCHEDULE_MODAL_STATUS.IDLE);
  const [createdEvent, setCreatedEvent] = useState<CalendarEvent | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const qualifications: string[] = [];
  if (coach.icf_acc) qualifications.push('ICF ACC');
  if (coach.icf_pcc) qualifications.push('ICF PCC');
  if (coach.icf_mcc) qualifications.push('ICF MCC');
  if (coach.icf_actc) qualifications.push('ICF ACTC');

  const viewerTimezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  useEffect(() => {
    logAnalyticsEvent('booking_modal_open', {
      coachUid: coach.userId,
      startTime: startTime.toISOString(),
    });
  }, [coach.userId, startTime]);
  
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

  const handleBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity() || !topic.trim()) {
      const errors = collectValidationErrors(form);
      if (!topic.trim() && !errors['topic-input']) {
        errors['topic-input'] = 'Please enter a coaching topic to confirm your booking.';
      }
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setBookingStatus(SCHEDULE_MODAL_STATUS.BOOKING);
    setErrorMsg('');

    try {
      const event = await scheduleMeeting(
        coach.userId,
        coach.email || 'coach@example.com',
        coach.displayName || 'Coach',
        user?.uid || '',
        profile?.displayName || user?.displayName || 'Peer',
        startTime.toISOString(),
        endTime.toISOString(),
        topic.trim()
      );
      logAnalyticsEvent('booking_success', {
        coachUid: coach.userId,
        startTime: startTime.toISOString(),
        topic: topic.trim(),
      });
      setCreatedEvent(event);
      setBookingStatus(SCHEDULE_MODAL_STATUS.SUCCESS);
      if (onBookingSuccess) {
        onBookingSuccess(event);
      }
    } catch (err) {
      logger.error('Failed to schedule meeting:', err);
      let message = BOOKING_ERROR_MESSAGES[BOOKING_ERROR.UNKNOWN];
      let errCode: BookingError = BOOKING_ERROR.UNKNOWN;
      if (err instanceof Error) {
        errCode = ((err as { code?: string }).code || BOOKING_ERROR.UNKNOWN) as keyof typeof BOOKING_ERROR;
        if (err.message === BOOKING_ERROR.SLOT_TAKEN) {
          message = BOOKING_ERROR_MESSAGES[BOOKING_ERROR.SLOT_TAKEN];
        } else if (err.message === BOOKING_ERROR.BOOKED_AS_CLIENT || err.message === BOOKING_ERROR.BOOKED_AS_COACH) {
          message = BOOKING_ERROR_MESSAGES[BOOKING_ERROR.BOOKED_AS_CLIENT];
        } else if (errCode === BOOKING_ERROR.GOOGLE_TOKEN_EXPIRED) {
          message = BOOKING_ERROR_MESSAGES[BOOKING_ERROR.GOOGLE_TOKEN_EXPIRED];
          setBookingStatus(SCHEDULE_MODAL_STATUS.TOKEN_EXPIRED);
          setErrorMsg(message);
          logAnalyticsEvent('booking_failure', {
            coachUid: coach.userId,
            startTime: startTime.toISOString(),
            error: message,
            code: errCode,
          });
          return;
        } else if ((err as { code?: string }).code === BOOKING_ERROR.GOOGLE_API_ERROR) {
          message = err.message;
        }
      }
      logAnalyticsEvent('booking_failure', {
        coachUid: coach.userId,
        startTime: startTime.toISOString(),
        error: message,
        code: errCode,
      });
      setErrorMsg(message);
      setBookingStatus(SCHEDULE_MODAL_STATUS.ERROR);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      {/* State 1: Booking Success Screen */}
      {bookingStatus === SCHEDULE_MODAL_STATUS.SUCCESS && createdEvent && (
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

          <div className="glass-panel" style={{ padding: '20px', background: 'var(--panel-hover-bg)', textAlign: 'left', marginBottom: '24px' }}>
            <p style={{ fontSize: '0.85rem', marginBottom: '6px' }}><strong>Topic:</strong> {topic}</p>
            <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
              <strong>Time:</strong> {dateString} at {timeString}
            </p>
            
            {sanitizeMeetLink(createdEvent.meetLink) && (
              <div style={{
                borderTop: '1px solid var(--border-light)',
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
                  href={sanitizeMeetLink(createdEvent.meetLink)}
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
      {bookingStatus !== SCHEDULE_MODAL_STATUS.SUCCESS && (
        <form noValidate onSubmit={handleBook}>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: qualifications.length > 0 ? '4px' : '20px' }}>
            Book a session with {formatDisplayName(coach)}
          </h3>
          {qualifications.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
              {qualifications.join(', ')}
            </p>
          )}

          {/* Date & Time details read-only block */}
          <div className="glass-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px' }}>
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
              Coaching Topic
            </label>
            <textarea
              id="topic-input"
              className={`input-field${formErrors['topic-input'] ? ' input-error' : ''}`}
              placeholder="e.g. Life coaching feedback, ICF log hours practice..."
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setFormErrors(prev => clearFieldError(prev, 'topic-input'));
                if (bookingStatus === SCHEDULE_MODAL_STATUS.ERROR && e.target.value.trim()) {
                  setBookingStatus(SCHEDULE_MODAL_STATUS.IDLE);
                  setErrorMsg('');
                }
              }}
              required
              // The rule guards against autofocus on page load. This is a modal
              // opened by explicit user action, where focus must move into the
              // dialog; this textarea is its first and primary control.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              rows={10}
              maxLength={INPUT_LIMITS.COACHING_TOPIC}
              style={{ resize: 'vertical', minHeight: '140px' }}
            />
            {formErrors['topic-input'] && (
              <span className="form-error-text">{formErrors['topic-input']}</span>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                {topic.length} / {INPUT_LIMITS.COACHING_TOPIC} characters
              </span>
            </div>
          </div>



          {/* Error message (e.g. slot just taken) */}
          {(bookingStatus === SCHEDULE_MODAL_STATUS.ERROR || bookingStatus === SCHEDULE_MODAL_STATUS.TOKEN_EXPIRED) && errorMsg && (
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              fontSize: '0.8rem',
              marginTop: '16px'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button 
              type={bookingStatus === SCHEDULE_MODAL_STATUS.TOKEN_EXPIRED ? 'button' : 'submit'}
              onClick={bookingStatus === SCHEDULE_MODAL_STATUS.TOKEN_EXPIRED ? async () => {
                try {
                  await login();
                  setBookingStatus(SCHEDULE_MODAL_STATUS.IDLE);
                  setErrorMsg('');
                } catch (e) {
                  logger.error('Re-login failed', e);
                }
              } : undefined}
              className="btn btn-primary"
              disabled={bookingStatus === SCHEDULE_MODAL_STATUS.BOOKING}
              style={{ flex: 2 }}
            >
              {bookingStatus === SCHEDULE_MODAL_STATUS.BOOKING ? 'Scheduling...' : bookingStatus === SCHEDULE_MODAL_STATUS.TOKEN_EXPIRED ? 'Reconnect Google' : 'Confirm Session'}
            </button>
          </div>
        </form>
      )}
      </Modal>
  );
};
