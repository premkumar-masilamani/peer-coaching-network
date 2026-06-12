import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  MapPin,
  User,
  CheckCircle,
  BookOpen,
  Globe
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { getTimezonesForCountry } from '../utils/timezones';
import { formatDisplayName } from '../services/firebaseService';

export const VerificationNotice: React.FC = () => {
  const { user, profile, updateProfileDetails } = useAuth();

  // State for editable profile details
  const [gender, setGender] = useState<'Male' | 'Female' | 'Prefer not to say' | ''>(profile?.gender || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [qualifications] = useState<('ICF ACC' | 'ICF PCC' | 'ICF MCC')[]>(profile?.qualifications || []);
  const [bio, setBio] = useState(profile?.bio || '');
  const [timezone, setTimezone] = useState(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  const timezoneOptions = getTimezonesForCountry(country);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      await updateProfileDetails({
        gender: gender === '' ? undefined : gender,
        country,
        qualifications,
        bio,
        timezone
      });
      setSuccessMsg('Profile updated! Administrators will review your details.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
      {/* Pending Banner */}
      <div className="glass-panel" style={{
        padding: '32px',
        borderLeft: '4px solid hsl(var(--warning))',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            padding: '12px',
            borderRadius: '12px',
            color: 'hsl(var(--warning))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={28} className="animate-pulse" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>
              Application Under Review
            </h2>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'hsl(var(--text-secondary))' }}>
              Welcome, {formatDisplayName(profile || user)}! <br />An administrator will provide access once the review process is complete.
            </p>
          </div>
        </div>
      </div>

      {/* Editable details card */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={18} color="hsl(var(--primary))" />
          Your Coach Profile
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Complete your profile information to help administrators review your information.
        </p>

        {/* Prominent Name & Email Row (Read-only) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }} className="responsive-notice-grid">
          <style>{`
            @media (max-width: 600px) {
              .responsive-notice-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name</label>
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              fontSize: '0.95rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600
            }}>
              {formatDisplayName(profile || user)}
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <div style={{
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              fontSize: '0.95rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600,
              wordBreak: 'break-all'
            }}>
              {profile?.email || user?.email}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>


          {/* 2. Gender Select */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="gender-select">
              <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Gender
            </label>
            <select
              id="gender-select"
              className="input-field"
              value={gender}
              onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Prefer not to say' | '')}
            >
              <option value="">Select Gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          {/* 3. Country Select */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="country-select">
              <MapPin size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Country
            </label>
            <select
              id="country-select"
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

          {/* 4. Timezone Select */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="timezone-select">
              <Globe size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Timezone
            </label>
            <select
              id="timezone-select"
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

          {/* 5. Coach Bio */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="bio-input">Professional Biography</label>
            <textarea
              id="bio-input"
              rows={4}
              className="input-field"
              placeholder="Tell other coaches about your coaching style, focus and ideal clients..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }}>
            <div>
              {successMsg && (
                <div style={{
                  color: '#34d399',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <CheckCircle size={15} />
                  {successMsg}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ minWidth: '150px' }}
            >
              {saving ? 'Saving...' : 'Save Profile Info'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
