import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  MapPin,
  Award,
  Globe,
  CheckCircle
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { getTimezonesForCountry } from '../utils/timezones';
import { getCredentialDescription } from '../utils/credentials';
import { formatDisplayName, formatMemberSince } from '../services/firebaseService';
import { sanitizeImageUrl } from '../utils/url';

export const ProfileEdit: React.FC = () => {
  const { user, profile, updateProfileDetails } = useAuth();

  // State for editable profile details
  const [gender, setGender] = useState<'Male' | 'Female' | 'Prefer not to say' | ''>(profile?.gender || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [qualifications] = useState<('ICF ACC' | 'ICF PCC' | 'ICF MCC')[]>(profile?.qualifications || []);
  const [bio, setBio] = useState(profile?.bio || '');
  const [timezone, setTimezone] = useState(profile?.timezone || '');

  const timezoneOptions = getTimezonesForCountry(country);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleCountryChange = (selectedCountry: string) => {
    setCountry(selectedCountry);
    if (selectedCountry) {
      const options = getTimezonesForCountry(selectedCountry);
      if (options.length > 0) {
        setTimezone(options[0].value);
      } else {
        setTimezone('');
      }
    } else {
      setTimezone('');
    }
  };

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
      setSuccessMsg('Profile changes saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      {/* Column 1: Editable details */}
      <div className="glass-panel" style={{ padding: '32px', width: '100%', maxWidth: '640px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
          <img
            src={sanitizeImageUrl(profile?.photoURL || user?.photoURL)}
            alt="Profile Avatar"
            style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid hsl(var(--primary))' }}
          />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatDisplayName(profile || user) || 'Coaching Profile'}</h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>{profile?.email}</p>
            {profile?.createdAt && (
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                Member since {formatMemberSince(profile.createdAt)}
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
              onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Prefer not to say' | '')}
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
              onChange={(e) => handleCountryChange(e.target.value)}
              required
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
              <option value="">Select Timezone</option>
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
              placeholder="Tell other coaches about your coaching style..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ resize: 'vertical' }}
              required
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
    </div>
  );
};
