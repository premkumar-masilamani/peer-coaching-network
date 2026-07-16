import React, { useState, useMemo } from 'react';
import { useTransientState } from '../hooks/useTransientState';
import { useAuth } from '../context/AuthContext';
import {
  User,
  MapPin,
  Award,
  Globe,
  CheckCircle,
  Circle,
  FileText,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { loadTimezonesForCountry, type TimezoneOption } from '../utils/timezonesLazy';
import { getCredentialBadgeClass, buildDisplayCredentials } from '../utils/credentials';
import { formatDisplayName, formatMemberSince, logAnalyticsEvent } from '../services/firebaseService';
import { sanitizeImageUrl } from '../utils/url';
import { GENDER_OPTIONS, type Gender, type Qualification, INPUT_LIMITS } from '../config';
import { collectValidationErrors, clearFieldError, type FormErrors } from '../utils/formValidation';


import { useUnsavedChanges, useNavigateToProfile } from '../context/UnsavedChangesContext';

export interface ProfileEditProps {
  onboardingMode?: boolean;
  onSaveSuccess?: () => void;
}

// ── Profile completion logic ──────────────────────────────────────────────────
interface CompletionItem {
  label: string;
  done: boolean;
  icon: React.ReactNode;
}

function getCompletionItems(profile: ReturnType<typeof useAuth>['profile']): CompletionItem[] {
  return [
    {
      label: 'Gender',
      done: !!profile?.gender,
      icon: <User size={13} />,
    },
    {
      label: 'Country',
      done: !!profile?.country,
      icon: <MapPin size={13} />,
    },
    {
      label: 'Timezone',
      done: !!profile?.timezone,
      icon: <Globe size={13} />,
    },
    {
      label: 'Professional Bio',
      done: !!profile?.bio,
      icon: <FileText size={13} />,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

export const ProfileEdit: React.FC<ProfileEditProps> = ({ onboardingMode, onSaveSuccess }) => {
  const { user, profile, updateProfileDetails } = useAuth();
  const { setPageDirtyState, requestExplicitSave } = useUnsavedChanges();
  const navigateToProfile = useNavigateToProfile();
  const [copied, setCopied] = useTransientState(false);

  // State for editable profile details
  const [gender, setGender] = useState<Gender | ''>(profile?.gender || '');
  const [country, setCountry] = useState(profile?.country || '');

  const qualifications = useMemo<Qualification[]>(() => {
    const list: Qualification[] = [];
    if (profile?.icf_acc) list.push('ICF ACC');
    if (profile?.icf_pcc) list.push('ICF PCC');
    if (profile?.icf_mcc) list.push('ICF MCC');
    if (profile?.icf_actc) list.push('ICF ACTC');
    return list;
  }, [profile]);
  const [bio, setBio] = useState(profile?.bio || '');
  const [timezone, setTimezone] = useState(profile?.timezone || '');
  const [credentialDetails, setCredentialDetails] = useState(profile?.credentialDetails || '');

  // Timezone options are loaded from a lazily-imported chunk (see timezonesLazy).
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneOption[]>([]);
  React.useEffect(() => {
    let active = true;
    loadTimezonesForCountry(country).then((opts) => {
      if (active) setTimezoneOptions(opts);
    });
    return () => { active = false; };
  }, [country]);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useTransientState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const dismissError = (key: string) => setFormErrors(prev => clearFieldError(prev, key));

  const displayCredentials = buildDisplayCredentials(profile || {});

  const handleDirectSave = React.useCallback(async () => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await updateProfileDetails({
        gender: gender === '' ? undefined : gender,
        country,
        bio,
        timezone,
        credentialDetails
      });
      logAnalyticsEvent('update_profile', {
        gender: gender === '' ? undefined : gender,
        country,
        timezone,
        hasBio: !!bio,
        hasCredentialDetails: !!credentialDetails,
      });
      setSuccessMsg('Profile changes saved successfully!', 4000);
      if (onSaveSuccess) onSaveSuccess();
      return true;
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to save profile changes. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [gender, country, bio, timezone, credentialDetails, updateProfileDetails, onSaveSuccess, setSuccessMsg]);

  React.useEffect(() => {
    const newChanges: string[] = [];
    if (gender !== (profile?.gender || '')) newChanges.push(`Gender: ${profile?.gender || 'Not set'} -> ${gender || 'Not set'}`);
    if (country !== (profile?.country || '')) newChanges.push(`Country: ${profile?.country || 'Not set'} -> ${country || 'Not set'}`);
    if (bio !== (profile?.bio || '')) newChanges.push(`Bio updated`);
    if (timezone !== (profile?.timezone || '')) newChanges.push(`Timezone: ${profile?.timezone || 'Not set'} -> ${timezone || 'Not set'}`);
    if (credentialDetails !== (profile?.credentialDetails || '')) newChanges.push(`Credential details updated`);

    const isDirty = newChanges.length > 0;

    setPageDirtyState(isDirty, newChanges, handleDirectSave);

    return () => {
      setPageDirtyState(false, [], async () => true);
    };
  }, [gender, country, bio, timezone, credentialDetails, profile, qualifications, updateProfileDetails, setPageDirtyState, onSaveSuccess, handleDirectSave]);

  const handleCountryChange = async (selectedCountry: string) => {
    setCountry(selectedCountry);
    if (selectedCountry) {
      const options = await loadTimezonesForCountry(selectedCountry);
      setTimezone(options.length > 0 ? options[0].value : '');
    } else {
      setTimezone('');
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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      {!onboardingMode && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>My Profile</h2>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
              Manage your personal information and preferences.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div className="glass-panel" style={{ padding: '32px', width: '100%' }}>

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
            {user?.uid && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => navigateToProfile(user.uid)}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    height: '28px',
                    gap: '4px',
                    borderColor: 'var(--border-light)',
                    background: 'transparent',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <ExternalLink size={12} />
                  View Public Profile
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const profileLink = `${window.location.origin}${window.location.pathname}?profile=${user.uid}`;
                    try {
                      await navigator.clipboard.writeText(profileLink);
                      setCopied(true, 2000);
                    } catch (err) {
                      console.error('Failed to copy link:', err);
                    }
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    height: '28px',
                    gap: '4px',
                    borderColor: copied ? 'hsl(var(--success) / 0.4)' : 'var(--border-light)',
                    background: copied ? 'hsl(var(--success) / 0.05)' : 'transparent',
                    color: copied ? 'hsl(var(--success))' : 'var(--text-secondary)'
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Link Copied!' : 'Copy Public Link'}
                </button>
              </div>
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
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (!form.checkValidity()) {
              setFormErrors(collectValidationErrors(form));
              return;
            }
            setFormErrors({});
            if (onboardingMode) {
              handleDirectSave();
            } else {
              requestExplicitSave();
            }
          }}
        >
          {/* 1. Credentials */}
          {!onboardingMode && (
            <div className="form-group">
              {/* Not a <label>: the credentials below are read-only badges, not a form control. */}
              <span className="form-label">
                <Award size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Credentials
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {displayCredentials.length > 0 ? (
                  displayCredentials.map((qual, idx) => {
                    return (
                      <span key={idx} className={`badge ${getCredentialBadgeClass(qual as Qualification)}`} style={{ fontSize: '0.8rem' }}>
                        <Award size={14} style={{ marginRight: '6px' }} />
                        {qual}
                      </span>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                    No verified credentials
                  </div>
                )}
              </div>
            </div>
          )}

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
              onChange={(e) => setGender(e.target.value as Gender | '')}
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
              className={`input-field${formErrors['country-select-edit'] ? ' input-error' : ''}`}
              value={country}
              onChange={(e) => { handleCountryChange(e.target.value); dismissError('country-select-edit'); dismissError('timezone-select-edit'); }}
              required
            >
              <option value="">Select Country</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {formErrors['country-select-edit'] && (
              <span className="form-error-text">{formErrors['country-select-edit']}</span>
            )}
          </div>

          {/* 4. Timezone */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="timezone-select-edit">
              <Globe size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Timezone
            </label>
            <select
              id="timezone-select-edit"
              className={`input-field${formErrors['timezone-select-edit'] ? ' input-error' : ''}`}
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); dismissError('timezone-select-edit'); }}
              required
            >
              <option value="">Select Timezone</option>
              {timezoneOptions.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            {formErrors['timezone-select-edit'] && (
              <span className="form-error-text">{formErrors['timezone-select-edit']}</span>
            )}
          </div>

          {/* 5. Professional Biography */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="bio-input-edit">Professional Biography</label>
            <textarea
              id="bio-input-edit"
              rows={4}
              className={`input-field${formErrors['bio-input-edit'] ? ' input-error' : ''}`}
              placeholder="Tell other coaches about your coaching style..."
              value={bio}
              onChange={(e) => { setBio(e.target.value); dismissError('bio-input-edit'); }}
              style={{ resize: 'vertical' }}
              maxLength={INPUT_LIMITS.BIO}
              required
            />
            {formErrors['bio-input-edit'] && (
              <span className="form-error-text">{formErrors['bio-input-edit']}</span>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                {bio.length} / {INPUT_LIMITS.BIO} characters
              </span>
            </div>
          </div>

          {/* 6. Credential Details */}
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label" htmlFor="credential-details-input-edit">Coaching Credentials</label>
            <textarea
              id="credential-details-input-edit"
              rows={3}
              className="input-field"
              placeholder="Please provide a link to your ICF certification (credly link or pdf link) to complete your verification. Without this, your profile will be marked as uncertified. You can always contact the administrator at any time to update your credentials."
              value={credentialDetails}
              onChange={(e) => setCredentialDetails(e.target.value)}
              style={{ resize: 'vertical' }}
              maxLength={INPUT_LIMITS.CREDENTIAL_DETAILS}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                {credentialDetails.length} / {INPUT_LIMITS.CREDENTIAL_DETAILS} characters
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }}>
            <div>
              {successMsg && (
                <div style={{ color: '#34d399', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={15} />
                  {successMsg}
                </div>
              )}
              {errorMsg && (
                <div style={{ color: 'hsl(var(--error))', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={15} />
                  {errorMsg}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || (onboardingMode && !isComplete)}
              title={onboardingMode && !isComplete ? 'Please fill out all required fields' : undefined}
            >
              {saving ? (onboardingMode ? 'Continuing...' : 'Saving...') : (onboardingMode ? 'Continue' : 'Save Profile')}
            </button>
          </div>

        </form>
      </div>
    </div>
    </div>
  );
};
