import React from 'react';
import { ArrowLeft, Shield, CheckCircle2, Lock, Mail } from 'lucide-react';

interface PrivacyPageProps {
  onNavigate: (path: string) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate }) => {
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
            <Shield size={18} />
            <span>Legal & Privacy</span>
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 2.8rem)',
            fontWeight: 800,
            color: 'hsl(var(--text-primary))',
            marginBottom: '12px',
            letterSpacing: '-0.02em',
          }}>
            Privacy Policy
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
          {/* Section 1: Overview */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              1. Overview & Purpose
            </h2>
            <p>
              Welcome to <strong>Peer Coaching Network</strong> ("we", "our", or "the Platform"). Peer Coaching Network is a dedicated peer-to-peer life coaching practice platform designed for credentialed life coaches and trainee coaches to sharpen their coaching skills, accumulate verified practice hours, and exchange constructive feedback.
            </p>
            <p style={{ marginTop: '12px' }}>
              We value your trust and are committed to protecting your personal information. This Privacy Policy explains what information we collect, how it is used to facilitate peer coaching sessions, and how we safeguard your data.
            </p>
          </section>

          {/* Section 2: Information We Collect */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              2. Information We Collect
            </h2>
            <p>When you use Peer Coaching Network, we collect only the necessary information to provide and operate the platform:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Google Account Information:</strong> When you sign in with Google, we receive basic authentication details including your full name, email address, and profile picture.
              </li>
              <li>
                <strong>Coach Profile Information:</strong> Details you voluntarily provide on your profile, including your bio, country, local time zone, gender, coaching qualifications or trainee status, and coaching focus areas.
              </li>
              <li>
                <strong>Availability & Schedule Data:</strong> Your recurring availability preferences and blocked dates for peer coaching sessions.
              </li>
              <li>
                <strong>Session Records:</strong> Metadata regarding booked peer sessions (session start/end time, paired coach name, status, and feedback notes).
              </li>
              <li>
                <strong>Google Calendar Information:</strong> With your explicit permission during sign-in, the application connects to your Google Calendar to add coaching sessions and generate Google Meet video conference links.
              </li>
            </ul>
          </section>

          {/* Section 3: How We Use Your Information */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              3. How We Use Your Information
            </h2>
            <p>We use the collected information solely for the following purposes:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>To authenticate your identity and provide secure access to your account.</li>
              <li>To allow other verified coaches and trainees on the platform to discover your availability and book peer sessions.</li>
              <li>To automatically create calendar events with secure Google Meet video links on your calendar and your peer's calendar.</li>
              <li>To send you important session reminders, schedule updates, or administrative notices.</li>
              <li>To provide technical assistance and respond to support inquiries.</li>
            </ul>
          </section>

          {/* Section 4: Google API Services User Data Policy Compliance */}
          <section style={{
            background: 'hsl(var(--primary) / 0.05)',
            border: '1px solid hsl(var(--primary) / 0.2)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Lock size={20} color="hsl(var(--primary))" />
              <h2 style={{ fontSize: '1.25rem', color: 'hsl(var(--text-primary))', fontWeight: 700 }}>
                4. Google API Services & Limited Use Disclosure
              </h2>
            </div>
            <p style={{ fontWeight: 500, color: 'hsl(var(--text-primary))', marginBottom: '12px' }}>
              Peer Coaching Network's use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>We only access your Google Calendar to create, update, or cancel coaching session events initiated through the platform.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>We do not read, process, or inspect your unrelated private emails, contacts, files, or personal calendar entries.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>We never use or transfer Google user data for serving advertisements, retargeting, or data brokering.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>We do not use Google user data to train general artificial intelligence or machine learning models.</span>
              </div>
            </div>
          </section>

          {/* Section 5: Data Sharing & Disclosures */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              5. Data Sharing & Third Parties
            </h2>
            <p>
              We do <strong>not</strong> sell, rent, trade, or monetize your personal data. We only share information in the following limited scenarios:
            </p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>With Other Members:</strong> Your public coach profile (name, bio, qualifications, timezone, and open session slots) is visible to registered members on the platform for peer matching.
              </li>
              <li>
                <strong>With Infrastructure Providers:</strong> We use Google Cloud / Firebase for secure data hosting, database storage, and authentication.
              </li>
              <li>
                <strong>Legal Compliance:</strong> If required by law, subpoena, or to protect the safety and integrity of our community.
              </li>
            </ul>
          </section>

          {/* Section 6: Security & Storage */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              6. Data Security & Storage
            </h2>
            <p>
              We implement industry-standard administrative, physical, and technical safeguards to protect your personal information. All network transmissions are encrypted using HTTPS/TLS, and your data is stored in enterprise-grade Google Cloud Firestore infrastructure with strict security rules and access controls.
            </p>
          </section>

          {/* Section 7: User Rights & Data Deletion */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              7. Your Rights & Account Deletion
            </h2>
            <p>You have full control over your personal data:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>Updating Your Profile:</strong> You can edit or remove your biographical information, availability, and preferences at any time directly in the app.
              </li>
              <li>
                <strong>Revoking Google Calendar Permissions:</strong> You can revoke Peer Coaching Network's access to your Google Calendar at any time through your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>Google Account Permissions</a>.
              </li>
              <li>
                <strong>Account Deletion:</strong> You may request complete deletion of your account, profile, and all associated session logs by emailing us at <a href="mailto:support@peercoachingnetwork.com" style={{ color: 'hsl(var(--primary))' }}>support@peercoachingnetwork.com</a>. Upon receipt, we will permanently purge your account data within 30 days.
              </li>
            </ul>
          </section>

          {/* Section 8: Changes to This Policy */}
          <section>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              8. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically to reflect changes in our services or legal requirements. When we make updates, we will revise the "Last Updated" date at the top of this page. We encourage you to review this policy periodically.
            </p>
          </section>

          {/* Section 9: Contact Us */}
          <section style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '1.35rem', color: 'hsl(var(--text-primary))', marginBottom: '12px', fontWeight: 700 }}>
              9. Contact Us
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please reach out to us:
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              color: 'hsl(var(--primary))',
              fontWeight: 600,
            }}>
              <Mail size={18} />
              <a href="mailto:support@peercoachingnetwork.com" style={{ color: 'inherit', textDecoration: 'none' }}>
                support@peercoachingnetwork.com
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
