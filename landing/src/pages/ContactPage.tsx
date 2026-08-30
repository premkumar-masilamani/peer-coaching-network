import React from 'react';
import { ArrowLeft, Mail, Clock, MessageSquare, CheckCircle2 } from 'lucide-react';

interface ContactPageProps {
  onNavigate: (path: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  return (
    <div className="animate-fade-in" style={{ padding: '48px 0 80px 0' }}>
      <div className="container" style={{ maxWidth: '840px' }}>
        {/* Back Link */}
        <button
          type="button"
          onClick={() => onNavigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'hsl(var(--primary))',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            padding: 0,
            marginBottom: '32px',
          }}
        >
          <ArrowLeft size={18} />
          <span>Back to Home</span>
        </button>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'hsl(var(--primary))',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '12px',
          }}>
            <MessageSquare size={18} />
            <span>Support & Community</span>
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 2.8rem)',
            fontWeight: 800,
            color: 'hsl(var(--text-primary))',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            Contact & Support
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'hsl(var(--text-secondary))' }}>
            We're here to support your peer coaching journey. Reach out with questions, feedback, or assistance requests.
          </p>
        </div>

        {/* Contact Card */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '40px',
        }}>
          {/* Email Support Card */}
          <div className="landing-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'hsl(var(--primary) / 0.1)',
              color: 'hsl(var(--primary))',
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Mail size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                Email Support
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5, marginBottom: '16px' }}>
                Our team responds to all member inquiries, privacy requests, and technical questions directly.
              </p>
              <a
                href="mailto:support@peercoachingnetwork.com"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.95rem' }}
              >
                <Mail size={16} />
                <span>support@peercoachingnetwork.com</span>
              </a>
            </div>
          </div>

          {/* Response SLA Card */}
          <div className="landing-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: 'hsl(var(--accent) / 0.1)',
              color: 'hsl(var(--accent))',
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Clock size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                Response Time
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5, marginBottom: '16px' }}>
                We typically review and respond to inquiries within <strong>24 to 48 business hours</strong>.
              </p>
              <div style={{
                background: 'hsl(var(--bg-surface-elevated))',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '0.85rem',
                color: 'hsl(var(--text-muted))',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" />
                <span>Dedicated support for active coaches & trainees</span>
              </div>
            </div>
          </div>
        </div>

        {/* Common Topics */}
        <div style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '36px',
        }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '20px' }}>
            How Can We Assist You?
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
          }}>
            <div style={{ borderLeft: '3px solid hsl(var(--primary))', paddingLeft: '16px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
                Account & Credentials
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                Questions regarding registration approval, updating your coaching qualifications, or profile status.
              </p>
            </div>

            <div style={{ borderLeft: '3px solid hsl(var(--accent))', paddingLeft: '16px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
                Calendar & Meeting Links
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                Assistance with Google Calendar synchronization or Google Meet link generation.
              </p>
            </div>

            <div style={{ borderLeft: '3px solid hsl(var(--success))', paddingLeft: '16px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
                Privacy & Data Deletion
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
                Requests for account removal, data export, or questions on our privacy standards.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
