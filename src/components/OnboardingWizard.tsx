import React, { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProfileEdit } from './ProfileEdit';
import { AvailabilityEdit } from './AvailabilityEdit';
import { User, CalendarDays, FileText } from 'lucide-react';

export const OnboardingWizard: React.FC = () => {
  const { profile, user, updateProfileDetails } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [acceptedTC, setAcceptedTC] = useState(false);

  const missingFields = [];
  if (!profile?.country) missingFields.push('Country');
  if (!profile?.bio) missingFields.push('Professional Bio');
  if (!profile?.gender) missingFields.push('Gender');

  const handleComplete = useCallback(async () => {
    if (!user) return;
    try {
      await updateProfileDetails({ onboardingComplete: true });
    } catch (e) {
      console.error('Failed to complete onboarding', e);
    }
  }, [user, updateProfileDetails]);

  const handleNextStep = useCallback(() => setStep(prev => (prev + 1) as 1 | 2 | 3), []);
  const handlePrevStep = useCallback(() => setStep(prev => (prev - 1) as 1 | 2 | 3), []);

  return (
    <div className="app-container" style={{ height: 'auto', minHeight: '100vh' }}>
      <div className="bg-gradient-radial" />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 16px', position: 'relative', zIndex: 10 }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Welcome to Peer Coaching!</h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '1.1rem' }}>Let's get your account set up so you can start coaching.</p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '40px', flexWrap: 'wrap' }}>
          {/* Step 1: Terms & Conditions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step === 1 ? 1 : 0.6 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: step === 1 ? 'hsl(var(--primary))' : 'hsl(var(--bg-surface))',
              color: step === 1 ? 'white' : 'hsl(var(--text-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: step === 1 ? 'none' : '1px solid var(--border-light)'
            }}>
              <FileText size={16} />
            </div>
            <span style={{ fontWeight: 600 }}>Terms & Conditions</span>
          </div>

          <div style={{ height: '2px', width: '30px', background: 'var(--border-light)', alignSelf: 'center' }} />

          {/* Step 2: Profile Setup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step === 2 ? 1 : 0.6 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: step === 2 ? 'hsl(var(--primary))' : 'hsl(var(--bg-surface))',
              color: step === 2 ? 'white' : 'hsl(var(--text-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: step === 2 ? 'none' : '1px solid var(--border-light)'
            }}>
              <User size={16} />
            </div>
            <span style={{ fontWeight: 600 }}>Profile Setup</span>
          </div>

          <div style={{ height: '2px', width: '30px', background: 'var(--border-light)', alignSelf: 'center' }} />

          {/* Step 3: Availability */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step === 3 ? 1 : 0.4 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: step === 3 ? 'hsl(var(--primary))' : 'hsl(var(--bg-surface))',
              color: step === 3 ? 'white' : 'hsl(var(--text-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: step === 3 ? 'none' : '1px solid var(--border-light)'
            }}>
              <CalendarDays size={16} />
            </div>
            <span style={{ fontWeight: 600 }}>Availability</span>
          </div>
        </div>

        {/* Step Content */}
        <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {step === 1 ? (
            <div style={{ padding: '32px' }}>
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Terms & Conditions</h2>
                <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: '1.5' }}>
                  Welcome to Peer Coaching Network (PCN). By using this service, you agree to the following terms, to maintain a professional, ethical, and reliable community.
                </p>
              </div>

              {/* T&C Text Container */}
              <div style={{
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '16px',
                background: 'var(--panel-hover-bg)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                color: 'hsl(var(--text-secondary))',
                marginBottom: '24px'
              }}>
                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>1. Ethics and Professionalism</h4>
                <p style={{ marginBottom: '12px' }}>
                  <strong>ICF Standards:</strong> All coaching sessions must adhere to the International Coaching Federation (ICF) Code of Ethics. Maintain professional boundaries and prioritize the best interests of your coaching partner.
                </p>
                <p style={{ marginBottom: '12px' }}>
                  <strong>Conduct:</strong> Treat all peers with respect. Harassment, discrimination, or disrespectful behavior will result in the immediate termination of your account.
                </p>
                <p style={{ marginBottom: '16px' }}>
                  <strong>Confidentiality:</strong> All conversations, goals, and personal information shared during sessions are strictly confidential. You must not disclose session details to external parties.
                </p>

                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginTop: '16px', marginBottom: '8px' }}>2. Platform Rules</h4>
                <p style={{ marginBottom: '12px' }}>
                  <strong>Open Access:</strong> This is an open platform. By creating an account, you acknowledge that any other registered coach may discover your profile and book a session with you.
                </p>
                <p style={{ marginBottom: '16px' }}>
                  <strong>Commitment:</strong> Honoring scheduled sessions is essential. You must provide at least 24 hours' notice for any cancellations or rescheduling. Chronic no-shows may lead to account suspension.
                </p>

                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginTop: '16px', marginBottom: '8px' }}>3. Verification Process</h4>
                <p style={{ marginBottom: '12px' }}>
                  All coaching credentials are subject to manual administrator review. Please provide one of the following for verification:
                </p>
                <p style={{ marginBottom: '12px' }}>
                  <strong>Publicly Verifiable Link:</strong> Provide a link to your digital badge (e.g., <a href="https://www.credly.com/badges/fc25c64a-832d-4704-aee5-e96f67ee0ff4" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>https://www.credly.com/badges/fc25c64a-832d-4704-aee5-e96f67ee0ff4</a>).
                </p>
                <p style={{ marginBottom: '16px' }}>
                  <strong>Certification PDF:</strong> Provide a direct link to your certification document (e.g., <a href="https://www.premkumarmasilamani.com/downloads/profile/2026-Premkumar-Masilamani.pdf" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>https://www.premkumarmasilamani.com/downloads/profile/2026-Premkumar-Masilamani.pdf</a>).
                </p>

                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginTop: '16px', marginBottom: '8px' }}>4. Software</h4>
                <p style={{ marginBottom: '12px' }}>
                  <strong>Access & Permissions:</strong> Access is restricted to Google login (Gmail). By logging in, you grant the platform permission to access your basic profile information (name, email, profile picture) and manage events in your Google Calendar for scheduling.
                </p>
                <p style={{ marginBottom: '8px' }}>
                  <strong>Experimental Software:</strong> This software is in an experimental stage and may contain bugs. Please report any issues directly to the administrator using the built-in support system.
                </p>
              </div>

              {/* Acceptance Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <input
                  type="checkbox"
                  id="tc-checkbox"
                  checked={acceptedTC}
                  onChange={(e) => setAcceptedTC(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))', cursor: 'pointer' }}
                />
                <label htmlFor="tc-checkbox" style={{ fontSize: '0.925rem', fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
                  I accept the terms and conditions
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!acceptedTC}
                  className="btn btn-primary"
                  style={{ minWidth: '120px' }}
                >
                  Accept & Continue
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-light)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Complete your profile</h2>
                <p style={{ color: 'hsl(var(--text-secondary))' }}>
                  Please fill out the missing information below. Make sure to click "Save Profile" before continuing.
                </p>
                {missingFields.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'hsl(var(--warning) / 0.1)', color: 'hsl(var(--warning))', borderRadius: '8px', fontSize: '0.9rem' }}>
                    Missing required fields: {missingFields.join(', ')}
                  </div>
                )}
              </div>

              <div style={{ margin: '0' }}>
                <ProfileEdit
                  onboardingMode={true}
                  onSaveSuccess={handleNextStep}
                />
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-light)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Set your availability</h2>
                <p style={{ color: 'hsl(var(--text-secondary))' }}>
                  Define your weekly schedule and working hours. Remember to click "Save Changes" at the bottom!
                </p>
              </div>

              <div style={{ margin: '0' }}>
                <AvailabilityEdit
                  onboardingMode={true}
                  onSaveSuccess={handleComplete}
                  onBackClick={handlePrevStep}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
