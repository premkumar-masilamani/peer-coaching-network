import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const appUrl = import.meta.env.VITE_APP_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5173'
      : 'https://app.peercoachingnetwork.com'
  );

  const handleNavClick = (sectionId: string) => {
    if (currentPath !== '/') {
      onNavigate('/');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(251, 249, 245, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-light)',
      transition: 'all 0.2s ease',
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '72px',
      }}>
        {/* Brand Logo */}
        <button
          type="button"
          onClick={() => onNavigate('/')}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <div style={{
            background: 'hsl(var(--primary))',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(15, 118, 110, 0.25)',
          }}>
            <Sparkles size={20} />
          </div>
          <span style={{
            fontFamily: 'var(--font-family-body)',
            fontWeight: 700,
            fontSize: '1.15rem',
            color: 'hsl(var(--text-primary))',
            letterSpacing: '-0.02em',
          }}>
            Peer Coaching Network
          </span>
        </button>

        {/* Navigation Links */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
        }}>
          <div style={{
            display: 'none',
            gap: '24px',
            alignItems: 'center',
          }} className="desktop-nav">
            <button
              type="button"
              onClick={() => handleNavClick('how-it-works')}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--text-secondary))',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('who-it-is-for')}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--text-secondary))',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
            >
              Who It's For
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('trust-pillars')}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--text-secondary))',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
            >
              Our Values
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('faq')}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--text-secondary))',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
            >
              FAQ
            </button>
          </div>

          {/* App Sign In Action */}
          <a
            href={appUrl}
            className="btn btn-primary"
            style={{
              padding: '9px 18px',
              fontSize: '0.9rem',
            }}
          >
            <span>Launch App</span>
            <ArrowRight size={16} />
          </a>
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
};
