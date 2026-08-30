import React from 'react';
import { ArrowLeft, FileText, AlertCircle, Mail } from 'lucide-react';
import { SUPPORT_EMAIL } from '../config';

interface TermsPageProps {
  onNavigate: (path: string) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => {
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
            <FileText size={18} />
            <span>Legal & Terms</span>
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 2.8rem)',
            fontWeight: 800,
            color: 'hsl(var(--text-primary))',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'hsl(var(--text-muted))' }}>
            Effective Date: August 30, 2026 • Last Updated: August 30, 2026
          </p>
        </div>

        {/* Content Box */}
        <div style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          lineHeight: 1.7,
          fontSize: '0.98rem',
          color: 'hsl(var(--text-secondary))',
        }}>
          {/* Section 1 */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing, registering, or using the <strong>Peer Coaching Network</strong> web application or website (collectively, the "Platform"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, please do not use the Platform.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              2. Purpose of the Platform
            </h2>
            <p>
              Peer Coaching Network exists exclusively to provide a safe, non-commercial environment for credentialed life coaches and trainee coaches to engage in reciprocal peer coaching sessions, sharpen core competencies, accumulate practice hours, and exchange professional feedback.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              3. Member Eligibility & Community Standards
            </h2>
            <p>To join and maintain an active account on the Platform, you agree to:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Be at least 18 years of age.</li>
              <li>Provide accurate, truthful information regarding your coaching credentials, certifications, or coach-in-training status.</li>
              <li>Treat every member with dignity, professionalism, inclusivity, and respect.</li>
              <li>Honour scheduled peer coaching commitments promptly or provide reasonable advance cancellation notice.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section style={{
            background: 'hsl(var(--accent) / 0.05)',
            border: '1px solid hsl(var(--accent) / 0.25)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertCircle size={20} color="hsl(var(--accent))" />
              <h2 style={{ fontSize: '1.25rem', color: 'hsl(var(--text-primary))', fontWeight: 700 }}>
                4. Strictly Non-Commercial / No-Solicitation Rule
              </h2>
            </div>
            <p style={{ marginBottom: '12px', color: 'hsl(var(--text-primary))', fontWeight: 500 }}>
              Peer Coaching Network is dedicated exclusively to peer practice and skill development.
            </p>
            <p>
              Members may <strong>never</strong> use the platform or peer sessions to pitch commercial services, sell coaching packages, solicit paid client engagements, or market paid courses to fellow members. Violations of this policy will result in immediate suspension or termination of access.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              5. Confidentiality of Coaching Conversations
            </h2>
            <p>
              Confidentiality is fundamental to effective coaching practice. You agree that all personal, professional, and sensitive disclosures made by your peer coach or client during a session are strictly confidential and must not be shared, recorded without consent, or published outside the session.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              6. Educational & Practice Disclaimer
            </h2>
            <p>
              Peer Coaching Network is an educational peer exchange platform. Peer coaching is <strong>not</strong> a substitute for licensed medical care, psychiatric treatment, psychological psychotherapy, legal counsel, or financial advisory services.
            </p>
            <p style={{ marginTop: '12px' }}>
              The Platform does not guarantee specific coaching outcomes, exam passing scores, or credentialing approvals by certifying bodies (such as the ICF).
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              7. Account Security & Google Integration
            </h2>
            <p>
              You are responsible for maintaining the security of your Google account and credentials used to sign in to the Platform. You agree to immediately notify our support team of any unauthorized access or security breach.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              8. Termination & Account Removal
            </h2>
            <p>
              We reserve the right to suspend or terminate any user account that violates these Terms, engages in harassing or unprofessional behaviour, or fails to uphold community standards. You may also request account deletion at any time.
            </p>
          </section>

          {/* Section 9 */}
          <section style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              9. Contact & Inquiries
            </h2>
            <p>
              If you have any questions regarding these Terms of Service, please reach out to our support team:
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
            }}>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.9rem' }}
              >
                <Mail size={16} />
                <span>Send Email</span>
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
