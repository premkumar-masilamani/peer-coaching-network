import React from 'react';
import { Sparkles, ShieldCheck, Heart, Plus, ArrowRight } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear();

  const team = [
    {
      name: 'Premkumar Masilamani',
      role: 'Founder & Lead Architect',
      credential: 'ICF PCC • 20+ Yrs Tech',
      isFounder: true,
      initials: 'PM',
    },
    {
      name: 'Early Coach Contributor',
      role: 'Beta Tester & Peer Advisor',
      credential: 'Open Seat',
      isFounder: false,
      initials: '+',
    },
    {
      name: 'Early Coach Contributor',
      role: 'Beta Tester & Peer Advisor',
      credential: 'Open Seat',
      isFounder: false,
      initials: '+',
    },
    {
      name: 'Early Coach Contributor',
      role: 'Beta Tester & Peer Advisor',
      credential: 'Open Seat',
      isFounder: false,
      initials: '+',
    },
    {
      name: 'Early Coach Contributor',
      role: 'Beta Tester & Peer Advisor',
      credential: 'Open Seat',
      isFounder: false,
      initials: '+',
    },
  ];

  return (
    <footer style={{
      background: 'hsl(var(--bg-surface))',
      borderTop: '1px solid var(--border-light)',
      paddingTop: '64px',
      paddingBottom: '40px',
      marginTop: 'auto',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          marginBottom: '56px',
        }}>
          {/* ── Left Column: About Us & Community Builders ─────────── */}
          <div style={{ maxWidth: '680px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
            }}>
              <div style={{
                background: 'hsl(var(--primary))',
                color: '#fff',
                width: '34px',
                height: '34px',
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
                fontSize: '1.15rem',
                color: 'hsl(var(--text-primary))',
                letterSpacing: '-0.02em',
              }}>
                About Peer Coaching Network
              </span>
            </div>

            <p style={{
              fontSize: '0.94rem',
              color: 'hsl(var(--text-secondary))',
              lineHeight: '1.65',
              marginBottom: '20px',
            }}>
              Peer Coaching Network was founded to solve the core scheduling, matching, and practice challenges faced by life coaches and coaches-in-training. Architected and developed by a 20+ years software engineering veteran and certified ICF PCC coach to provide a secure, non-commercial environment for continuous skill mastery.
            </p>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'hsl(var(--primary))',
              fontWeight: 600,
              marginBottom: '24px',
            }}>
              <ShieldCheck size={16} />
              <span>Built by Coaches • For Coaches • 100% Non-Commercial</span>
            </div>

            {/* Team & Contributors Grid */}
            <div style={{
              background: 'hsl(var(--bg-surface-elevated))',
              border: '1px solid var(--border-light)',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '16px',
            }}>
              <div style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'hsl(var(--text-muted))',
                marginBottom: '16px',
              }}>
                Core Builder & Early Coach Contributors
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
              }}>
                {team.map((member, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'hsl(var(--bg-surface))',
                      border: member.isFounder
                        ? '1px solid hsl(var(--primary) / 0.3)'
                        : '1px dashed var(--border-light)',
                    }}
                  >
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: member.isFounder ? 'hsl(var(--primary))' : 'hsl(var(--btn-secondary-bg))',
                      color: member.isFounder ? '#ffffff' : 'hsl(var(--text-muted))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      flexShrink: 0,
                    }}>
                      {member.isFounder ? (
                        member.initials
                      ) : (
                        <Plus size={16} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: 'hsl(var(--text-primary))',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {member.name}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: member.isFounder ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
                        fontWeight: 500,
                        lineHeight: 1.2,
                      }}>
                        {member.credential}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Join Early Contributors Callout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '0.86rem',
              color: 'hsl(var(--text-secondary))',
            }}>
              <span>Want to help test and shape the network as an early coach advisor?</span>
              <button
                type="button"
                onClick={() => onNavigate('/contact')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--primary))',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Get In Touch</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* ── Right Column: Legal & Trust ────────────────────────── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
          }}>
            <h4 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'hsl(var(--text-primary))',
              marginBottom: '20px',
            }}>
              Legal & Trust
            </h4>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'hsl(var(--text-secondary))',
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/privacy')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'hsl(var(--text-secondary))',
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                    transition: 'color 0.15s ease',
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
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                    transition: 'color 0.15s ease',
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
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontWeight: 500,
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--primary))')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--text-secondary))')}
                >
                  Contact & Support
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Bottom Bar ─────────────────────────────────────────── */}
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
