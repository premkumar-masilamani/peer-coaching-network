import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  Calendar, 
  Video, 
  ShieldCheck
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();

  const handleRealLogin = async () => {
    try {
      await login();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '85vh',
      width: '100%',
      padding: '24px 16px'
    }}>
      {/* Background decoration */}
      <div className="bg-aurora-glow" style={{ top: '10%', left: '10%' }} />
      <div className="bg-aurora-glow" style={{ bottom: '10%', right: '10%' }} />

      <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '9999px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '24px',
          fontSize: '0.85rem',
          color: 'hsl(var(--primary))',
          fontWeight: 600
        }}>
          <Sparkles size={14} />
          Exclusive Peer-to-Peer Coaching Platform
        </div>
        
        <h1 style={{
          fontSize: '3.5rem',
          lineHeight: '1.15',
          fontWeight: 800,
          background: 'linear-gradient(to right, #ffffff, #a78bfa, #818cf8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '16px',
          letterSpacing: '-0.04em'
        }}>
          Elevate Your Practice Through Peer Coaching
        </h1>
        
        <p style={{
          fontSize: '1.2rem',
          maxWidth: '600px',
          margin: '0 auto 32px auto',
          color: 'hsl(var(--text-secondary))',
          lineHeight: '1.6'
        }}>
          Connect with credentialed life coaches, sync your Google Calendar schedules, and arrange mutual coaching sessions with automated Google Meet links.
        </p>

        {/* Real Sign In Action */}
        <div>
          <button 
            onClick={handleRealLogin} 
            className="btn btn-primary"
            style={{ fontSize: '1.05rem', padding: '14px 32px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign In with Google
          </button>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '12px' }}>
            Requires permission to add events to your Google Calendar.
          </p>
        </div>
      </div>

      {/* Feature Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px',
        width: '100%',
        maxWidth: '900px'
      }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'hsl(var(--accent))',
            marginBottom: '16px'
          }}>
            <Calendar size={22} />
          </div>
          <h4 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>Google Calendar Integration</h4>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            Real-time Google Calendar synchronization helps prevent scheduling conflicts by automatically overlaying existing commitments and identifying mutually available coaching slots.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{
            background: 'rgba(139, 92, 246, 0.1)',
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'hsl(var(--primary))',
            marginBottom: '16px'
          }}>
            <Video size={22} />
          </div>
          <h4 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>Google Meet Integration</h4>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            Confirmed sessions automatically generate secure Google Meet conference links, providing free, reliable video meetings along with synchronized calendar invitations for both participants.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'hsl(var(--success))',
            marginBottom: '16px'
          }}>
            <ShieldCheck size={22} />
          </div>
          <h4 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>Verified Coaches</h4>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            Access is restricted through role-based authentication and administrative approval workflows. All new registrations are manually reviewed and approved by an administrator.
          </p>
        </div>
      </div>
    </div>
  );
};
