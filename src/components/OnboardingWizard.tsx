import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProfileEdit } from './ProfileEdit';
import { AvailabilityEdit } from './AvailabilityEdit';
import { updateOwnProfile } from '../services/firebaseService';
import { User, CalendarDays } from 'lucide-react';

export const OnboardingWizard: React.FC = () => {
  const { profile, user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  const missingFields = [];
  if (!profile?.country) missingFields.push('Country');
  if (!profile?.bio) missingFields.push('Professional Bio');
  if (!profile?.gender) missingFields.push('Gender');

  const handleComplete = async () => {
    if (!user) return;
    try {
      await updateOwnProfile(user.uid, { onboardingComplete: true });
    } catch (e) {
      console.error('Failed to complete onboarding', e);
    }
  };

  return (
    <div className="app-container" style={{ height: 'auto', minHeight: '100vh' }}>
      <div className="bg-gradient-radial" />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 16px', position: 'relative', zIndex: 10 }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Welcome to Peer Coaching!</h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '1.1rem' }}>Let's get your account set up so you can start coaching.</p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step === 1 ? 1 : 0.6 }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              background: step === 1 ? 'hsl(var(--primary))' : 'hsl(var(--bg-surface))',
              color: step === 1 ? 'white' : 'hsl(var(--text-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: step === 1 ? 'none' : '1px solid var(--border-light)'
            }}>
              <User size={16} />
            </div>
            <span style={{ fontWeight: 600 }}>Profile Setup</span>
          </div>
          
          <div style={{ height: '2px', width: '40px', background: 'var(--border-light)', alignSelf: 'center' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step === 2 ? 1 : 0.4 }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              background: step === 2 ? 'hsl(var(--primary))' : 'hsl(var(--bg-surface))',
              color: step === 2 ? 'white' : 'hsl(var(--text-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: step === 2 ? 'none' : '1px solid var(--border-light)'
            }}>
              <CalendarDays size={16} />
            </div>
            <span style={{ fontWeight: 600 }}>Availability</span>
          </div>
        </div>

        {/* Step Content */}
        <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {step === 1 ? (
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
                  onSaveSuccess={() => setStep(2)} 
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
                  onBackClick={() => setStep(1)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
