import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  MapPin,
  Award,
  Globe,
  CheckCircle,
  Circle,
  FileText,
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { getTimezonesForCountry } from '../utils/timezones';
import { getCredentialDescription } from '../utils/credentials';
import { formatDisplayName, formatMemberSince } from '../services/firebaseService';
import { sanitizeImageUrl } from '../utils/url';
import { GENDER_OPTIONS, type GenderValue } from '../config';

// ── Profile completion logic ──────────────────────────────────────────────────
interface CompletionItem {
  label: string;
  done: boolean;
  icon: React.ReactNode;
}

function getCompletionItems(profile: ReturnType<typeof useAuth>['profile']): CompletionItem[] {
  return [
    {
      label: 'Country',
      done: !!profile?.country,
      icon: <MapPin size={13} />,
    },
    {
      label: 'Professional Bio',
      done: !!profile?.bio,
      icon: <FileText size={13} />,
    },
    {
      label: 'Gender',
      done: !!profile?.gender,
      icon: <User size={13} />,
    },
    {
      label: 'Timezone',
      done: !!profile?.timezone,
      icon: <Globe size={13} />,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

export const ProfileEdit: React.FC = () => {
  const { user, profile, updateProfileDetails } = useAuth();

  // State for editable profile details
  const [gender, setGender] = useState<GenderValue | ''>(profile?.gender || '');
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

  // Compute completion against *current local state* so the bar updates live
  // while the user fills in the form (before saving).
  const localProfile = { ...profile, country, bio, gender, timezone };
  const completionItems = getCompletionItems(localProfile as typeof profile);
  const doneCount = completionItems.filter(i => i.done).length;
  const pct = Math.round((doneCount / completionItems.length) * 100);
  const isComplete = pct === 100;

  const progressColor =
    pct === 100 ? 'hsl(var(--success))' :
    pct >= 50   ? 'hsl(var(--primary))' :
                  'hsl(var(--warning))';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '32px', width: '100%', maxWidth: '640px' }}>

        {/* ── Profile card header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '28px' }}>
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

        {/* ── Profile completion widget ────────────────────────────────────── */}
        <div style={{
          background: isComplete
            ? 'linear-gradient(135deg, hsl(var(--success) / 0.08), hsl(var(--success) / 0.04))'
            : 'linear-gradient(135deg, hsl(var(--primary) / 0.07), hsl(var(--primary) / 0.03))',
          border: `1px solid ${isComplete ? 'hsl(var(--success) / 0.3)' : 'hsl(var(--primary) / 0.2)'}`,
          borderRadius: '14px',
          padding: '20px 22px',
          marginBottom: '28px',
        }}>
          {/* Heading + percentage */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Profile Completion
            </span>
            <span style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: progressColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {pct}%
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: '8px',
            borderRadius: '99px',
            background: 'var(--border-light)',
            overflow: 'hidden',
            marginBottom: '16px',
          }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: '99px',
              background: progressColor,
              transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease',
              boxShadow: `0 0 8px ${progressColor}66`,
            }} />
          </div>

          {/* Checklist */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {completionItems.map(item => (
              <div
                key={item.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: `1px solid ${item.done ? 'hsl(var(--success) / 0.3)' : 'var(--border-light)'}`,
                  background: item.done ? 'hsl(var(--success) / 0.08)' : 'var(--bg-surface-elevated)',
                  color: item.done ? 'hsl(var(--success))' : 'var(--text-muted)',
                  transition: 'all 0.25s ease',
                }}
              >
                {item.done
                  ? <CheckCircle size={13} />
                  : <Circle size={13} />}
                {item.label}
              </div>
            ))}
          </div>

          {isComplete && (
            <p style={{ margin: '12px 0 0 0', fontSize: '0.82rem', color: 'hsl(var(--success))', fontWeight: 600 }}>
              🎉 Your profile is complete — other coaches can fully discover you!
            </p>
          )}
        </div>

        {/* ── Editable form ───────────────────────────────────────────────── */}
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
              onChange={(e) => setGender(e.target.value as GenderValue | '')}
            >
              <option value="">Select Gender</option>
              {GENDER_OPTIONS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
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

          {/* 5. Professional Biography */}
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
