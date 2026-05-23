import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUpcomingEvents, isCalendarSynced } from '../services/googleCalendar';
import type { CalendarEvent } from '../services/googleCalendar';
import { 
  User, 
  MapPin, 
  Award, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Video,
  ExternalLink,
  BookOpen,
  Globe
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { getTimezonesForCountry } from '../utils/timezones';
import { getCredentialDescription } from '../utils/credentials';
import { formatDisplayName } from '../services/firebaseService';

export const ProfileEdit: React.FC = () => {
  const { user, profile, updateProfileDetails } = useAuth();
  
  // State for editable profile details
  const [gender, setGender] = useState(profile?.gender || '');
  const [country, setCountry] = useState(profile?.location?.country || '');
  const [qualifications] = useState<string[]>(profile?.qualifications || []);
  const [bio, setBio] = useState(profile?.bio || '');
  const [timezone, setTimezone] = useState(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  const timezoneOptions = getTimezonesForCountry(country);
  
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Calendar and scheduled sessions state
  const [synced, setSynced] = useState(isCalendarSynced());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  useEffect(() => {
    const loadUpcomingSessions = async () => {
      if (synced) {
        setLoadingCalendar(true);
        try {
          const list = await getUpcomingEvents(!!profile?.role);
          // Filter events created by our app (they contain "Coaching:" in the summary)
          const coachingSessions = list.filter(e => e.summary.toLowerCase().includes('coaching'));
          setEvents(coachingSessions);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingCalendar(false);
        }
      } else {
        setEvents([]);
      }
    };

    loadUpcomingSessions();
  }, [synced, profile?.role]);


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      await updateProfileDetails({
        gender,
        location: { country },
        qualifications,
        bio,
        timezone
      });
      setSuccessMsg('Profile changes saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarSyncToggle = async () => {
    if (synced) {
      // Disconnect
      sessionStorage.removeItem('google_access_token');
      await updateProfileDetails({ calendarSynced: false });
      setSynced(false);
    } else {
      // Sync
      sessionStorage.setItem('google_access_token', 'mock_google_access_token');
      await updateProfileDetails({ calendarSynced: true });
      setSynced(true);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', width: '100%' }}>
      {/* CSS responsive breakdown helper */}
      <style>{`
        @media (max-width: 900px) {
          .animate-fade-in {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Column 1: Editable details */}
      <div className="glass-panel" style={{ padding: '32px', alignSelf: 'start' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
          <img 
            src={profile?.photoURL || user?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg'} 
            alt="Profile Avatar" 
            style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid hsl(var(--primary))' }}
          />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatDisplayName(profile || user) || 'Coaching Profile'}</h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>{profile?.email}</p>
            {profile?.createdAt && (
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                Member since {profile.createdAt}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* 1. Credentials */}
          <div className="form-group">
            <label className="form-label">
              <Award size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Credentials
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {qualifications && qualifications.length > 0 ? (
                qualifications.map((qual) => (
                  <div 
                    key={qual} 
                    style={{ 
                      fontSize: '0.9rem',
                      color: 'hsl(var(--text-primary))',
                      padding: '2px 0',
                      fontWeight: 500
                    }}
                  >
                    {getCredentialDescription(qual)}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                  No credentials assigned
                </div>
              )}
            </div>
          </div>

          {/* 2. Gender */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="gender-select-edit">
              <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Gender
            </label>
            <select
              id="gender-select-edit"
              className="input-field"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Select Gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          {/* 3. Country */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="country-select-edit">
              <MapPin size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Country
            </label>
            <select
              id="country-select-edit"
              className="input-field"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Select Country</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 4. Timezone */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="timezone-select-edit">
              <Globe size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Timezone
            </label>
            <select
              id="timezone-select-edit"
              className="input-field"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
            >
              {timezoneOptions.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* 5. Personal Biography */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="bio-input-edit">Professional Biography</label>
            <textarea
              id="bio-input-edit"
              rows={4}
              className="input-field"
              placeholder="Tell other coaches about your coaching focus..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }}>
            <div>
              {successMsg && (
                <div style={{ color: '#34d399', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={15} />
                  {successMsg}
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Column 2: Calendar integration & Booked Sessions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Calendar Connection Panel */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="hsl(var(--primary))" />
            Google Calendar Sync
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
            Syncing your calendar overlays your current schedule directly on the platform and helps other coaches match with your available times.
          </p>

          <div className="glass-panel" style={{
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            borderColor: synced ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-light)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {synced ? (
                <CheckCircle size={22} color="#34d399" />
              ) : (
                <XCircle size={22} color="#f87171" />
              )}
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                  {synced ? 'Google Calendar Connected' : 'Google Calendar Not Synced'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {synced ? 'Active sync with primary calendar' : 'Permissions needed to pull availability'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={handleCalendarSyncToggle}
              className={`btn ${synced ? 'btn-danger' : 'btn-primary'}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              {synced ? 'Disconnect' : 'Connect Calendar'}
            </button>
          </div>
        </div>

        {/* Scheduled Sessions list */}
        <div className="glass-panel" style={{ padding: '32px', flex: 1 }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="hsl(var(--primary))" />
            Scheduled Peer Sessions
          </h3>

          {!synced ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'hsl(var(--text-muted))' }}>
              <Calendar size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem' }}>Connect your Google Calendar to view upcoming peer coaching sessions.</p>
            </div>
          ) : loadingCalendar ? (
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>Loading calendar sessions...</p>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'hsl(var(--text-muted))' }}>
              <CheckCircle size={32} style={{ marginBottom: '12px', opacity: 0.5, color: '#34d399' }} />
              <p style={{ fontSize: '0.9rem' }}>No coaching sessions scheduled yet. Check the coaches list to book your first peer session!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {events.map((ev) => {
                const start = new Date(ev.start.dateTime);
                const timeString = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateString = start.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });

                return (
                  <div key={ev.id} className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{ev.summary}</h4>
                      <span className="badge badge-user" style={{ fontSize: '0.65rem' }}>Active Invite</span>
                    </div>
                    
                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '12px' }}>
                      {dateString} at {timeString}
                    </p>

                    {ev.meetLink && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a 
                          href={ev.meetLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px' }}
                        >
                          <Video size={12} color="#34d399" />
                          Join Google Meet
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
