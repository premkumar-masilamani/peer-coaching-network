import React from 'react';
import { Sparkles, Mail, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear();
  const appUrl = import.meta.env.VITE_APP_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5173'
      : 'https://app.peercoachingnetwork.com'
  );

  return (
    <footer style={{
      background: 'hsl(var(--bg-surface))',
      borderTop: '1px solid var(--border-light)',
      paddingTop: '60px',
      paddingBottom: '40px',
      marginTop: 'auto',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '40px',
          marginBottom: '48px',
        }}>
          {/* Brand Col */}
          <div style={{ maxWidth: '340px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
            }}>
              <div style={{
                background: 'hsl(var(--primary))',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Sparkles size={18} />
              </div>
              <span style={{
                fontFamily: 'var(--font-family-body)',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'hsl(var(--text-primary))',
              }}>
                Peer Coaching Network
              </span>
            </div>
            <p style={{
              fontSize: '0.9rem',
              color: 'hsl(var(--text-secondary))',
              lineHeight: '1.6',
              marginBottom: '16px',
            }}>
              A dedicated, distraction-free peer practice platform for credentialed life coaches and trainee coaches to grow through reciprocal coaching.
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'hsl(var(--primary))',
              fontWeight: 500,
            }}>
              <ShieldCheck size={16} />
              <span>Safe • Non-commercial • Vetted</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'hsl(var(--text-primary))',
              marginBottom: '16px',
            }}>
              Explore
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'hsl(var(--text-secondary))',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                >
                  Home
                </button>
              </li>
              <li>
                <a
                  href={appUrl}
                  style={{
                    color: 'hsl(var(--text-secondary))',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                >
                  Member Sign In
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Governance */}
          <div>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'hsl(var(--text-primary))',
              marginBottom: '16px',
            }}>
              Legal & Trust
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/privacy')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'hsl(var(--text-secondary))',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/terms')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'hsl(var(--text-secondary))',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'hsl(var(--text-secondary))',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                >
                  Contact & Support
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Col */}
          <div>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'hsl(var(--text-primary))',
              marginBottom: '16px',
            }}>
              Get In Touch
            </h4>
            <p style={{
              fontSize: '0.9rem',
              color: 'hsl(var(--text-secondary))',
              marginBottom: '12px',
            }}>
              Questions, feedback, or need assistance? Reach out directly:
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/contact')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: 'hsl(var(--primary))',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Mail size={16} />
              <span>Contact Support Team</span>
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid var(--border-light)',
          paddingTop: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          fontSize: '0.85rem',
          color: 'hsl(var(--text-muted))',
        }}>
          <div>
            © {currentYear} Peer Coaching Network. All rights reserved.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Built with <Heart size={14} color="hsl(var(--accent))" style={{ fill: 'hsl(var(--accent))' }} /> for the life coaching community.
          </div>
        </div>
      </div>
    </footer>
  );
};
