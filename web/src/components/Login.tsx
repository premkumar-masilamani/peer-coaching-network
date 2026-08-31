import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar, ShieldCheck, ArrowLeft } from 'lucide-react';
import { LogoIcon } from './Logo';
import { logAnalyticsEvent } from '../services/firebaseService';
import { USER_MESSAGES, LANDING_URL } from '../config';

export const Login: React.FC = () => {
  const { login } = useAuth();

  const handleRealLogin = async () => {
    try {
      await login();
      logAnalyticsEvent('login_success');
    } catch (e) {
      console.error(e);
    }
  };

  const landingUrl = LANDING_URL;

  return (
    <div className="animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '85vh',
      width: '100%',
      padding: '24px 16px',
    }}>
      {/* Background Radial Glow */}
      <div className="bg-aurora-glow" style={{ top: '15%', left: '20%' }} />

      {/* Main Login Card */}
      <div className="glass-panel" style={{
        maxWidth: '460px',
        width: '100%',
        padding: '40px 32px',
        textAlign: 'center',
        boxShadow: '0 12px 40px rgba(15, 23, 42, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Brand Icon */}
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <LogoIcon size={56} />
        </div>

        {/* Brand Title & Welcome */}
        <span style={{
          fontSize: '0.88rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'hsl(var(--primary))',
          marginBottom: '6px',
        }}>
          Peer Coaching Network
        </span>

        <h1 style={{
          fontSize: '1.85rem',
          fontWeight: 800,
          color: 'hsl(var(--text-primary))',
          marginBottom: '10px',
          letterSpacing: '-0.02em',
        }}>
          {USER_MESSAGES.AUTH.LOGIN_TITLE}
        </h1>

        <p style={{
          fontSize: '0.95rem',
          color: 'hsl(var(--text-secondary))',
          lineHeight: 1.5,
          marginBottom: '32px',
          maxWidth: '360px',
        }}>
          {USER_MESSAGES.AUTH.LOGIN_SUBTITLE}
        </p>

        {/* Google Sign In Button */}
        <div style={{ width: '100%', display: 'grid' }}>
          <button
            type="button"
            onClick={handleRealLogin}
            className="btn btn-primary"
            style={{
              padding: '14px 24px',
              fontSize: '1rem',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>{USER_MESSAGES.AUTH.SIGN_IN_GOOGLE}</span>
          </button>
        </div>

        {/* Friendly Calendar Sync Notice */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          background: 'hsl(var(--bg-surface-elevated))',
          border: '1px solid var(--border-light)',
          borderRadius: '10px',
          padding: '12px 14px',
          marginTop: '24px',
          textAlign: 'left',
          fontSize: '0.82rem',
          color: 'hsl(var(--text-secondary))',
          lineHeight: 1.45,
        }}>
          <Calendar size={18} color="hsl(var(--primary))" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{USER_MESSAGES.AUTH.CALENDAR_PERMISSION_NOTICE}</span>
        </div>

        {/* Back Link to Landing Page */}
        <div style={{ marginTop: '28px' }}>
          <a
            href={landingUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'hsl(var(--primary))',
              fontSize: '0.88rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} />
            <span>{USER_MESSAGES.AUTH.LEARN_MORE_LINK}</span>
          </a>
        </div>
      </div>

      {/* Trust & Legal Footer */}
      <div style={{
        marginTop: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.82rem',
        color: 'hsl(var(--text-muted))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="hsl(var(--success))" />
          <span>Vetted community for credentialed coaches & trainees</span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a
            href={`${landingUrl}/privacy`}
            style={{ color: 'hsl(var(--text-muted))', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-muted))')}
          >
            Privacy Policy
          </a>
          <span>•</span>
          <a
            href={`${landingUrl}/terms`}
            style={{ color: 'hsl(var(--text-muted))', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-muted))')}
          >
            Terms of Service
          </a>
          <span>•</span>
          <a
            href={`${landingUrl}/contact`}
            style={{ color: 'hsl(var(--text-muted))', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-muted))')}
          >
            Support
          </a>
        </div>
      </div>
    </div>
  );
};
