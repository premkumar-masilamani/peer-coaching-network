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
                <p style={{ color: 'hsl(var(--text-secondary))' }}>
                  Please review and accept our guidelines and code of ethics before joining the platform.
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
                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>1. Confidentiality</h4>
                <p style={{ marginBottom: '16px' }}>
                  All coaching conversations, materials, goals, and personal information shared between coaching partners are strictly confidential. You must not disclose any details of your coaching sessions to external parties.
                </p>

                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>2. Respect and Professionalism</h4>
                <p style={{ marginBottom: '16px' }}>
                  Treat your peer coaching partners with professional respect. Provide constructive, honest, and supportive feedback. Harassment, discrimination, or disrespectful behavior of any kind will result in immediate termination of platform access.
                </p>

                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>3. Commitment and Reliability</h4>
                <p style={{ marginBottom: '16px' }}>
                  By scheduling a session, you commit to honoring that time. If you must reschedule or cancel, you agree to provide at least 24 hours notice to your coaching partner. Chronic cancellations or no-shows may lead to suspension.
                </p>

                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>4. Code of Conduct and Ethics</h4>
                <p style={{ marginBottom: '16px' }}>
                  All sessions should align with the ethical guidelines set by the International Coaching Federation (ICF). Coaches are responsible for maintaining a professional boundary and acting in the best interest of their coaching partners.
                </p>

                <h4 style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>5. Client-Side Architecture Disclaimer</h4>
                <p style={{ marginBottom: '8px' }}>
                  This is an experimental application operating strictly client-side. The network and data are managed directly in the browser via Firestore rules. All credentials and certification statuses submitted are subject to manual administrator review.
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
                  I accept the Terms and Conditions and Peer Coaching guidelines
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
