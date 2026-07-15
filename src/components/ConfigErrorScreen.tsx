import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfigErrorScreenProps {
  /** Human-readable detail about what is misconfigured. */
  message?: string;
}

/**
 * Full-screen "configuration error" state. Rendered in place of the app when a
 * required piece of runtime configuration (e.g. Firebase credentials) is
 * missing, so a misconfigured deployment shows an explanation instead of a
 * blank white page.
 */
export const ConfigErrorScreen: React.FC<ConfigErrorScreenProps> = ({ message }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      gap: '16px',
      padding: '24px',
      textAlign: 'center',
    }}
  >
    <div className="bg-gradient-radial" />
    <div
      style={{
        background: 'hsl(var(--warning))',
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 30px hsl(var(--warning) / 0.4)',
      }}
    >
      <AlertTriangle size={24} color="#000" />
    </div>
    <h1
      style={{
        fontSize: '1.25rem',
        color: 'var(--text-primary)',
        fontWeight: 700,
        margin: 0,
      }}
    >
      Configuration error
    </h1>
    <p
      style={{
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        maxWidth: '520px',
        lineHeight: 1.5,
        margin: 0,
      }}
    >
      The application is not configured correctly and can’t start. Please contact
      the site administrator.
    </p>
    {message && (
      <p
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          maxWidth: '520px',
          lineHeight: 1.5,
          margin: 0,
          fontFamily: 'monospace',
        }}
      >
        {message}
      </p>
    )}
  </div>
);
