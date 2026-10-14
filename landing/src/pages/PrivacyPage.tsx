import React from 'react';
import { ArrowLeft, Shield, CheckCircle2, Lock, Mail } from 'lucide-react';
import { SUPPORT_EMAIL } from '../config';

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
            Effective Date: August 30, 2026 • Last Updated: October 14, 2026
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
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={20} color="hsl(var(--primary))" />
              <h2 style={{ fontSize: '1.25rem', color: 'hsl(var(--text-primary))', fontWeight: 700, margin: 0 }}>
                4. Google API Services & Limited Use Disclosure
              </h2>
            </div>
            <p style={{ fontWeight: 500, color: 'hsl(var(--text-primary))', margin: 0 }}>
              Peer Coaching Network's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>We only access your Google Calendar to create, update, or cancel coaching session events and calculate free/busy availability initiated through the platform.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" style={{ flexShrink: 0, marginTop: '3px' }} />
                <span>We do not read, process, or inspect your private personal emails, contacts, files, or personal calendar entries.</span>
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

            {/* Privacy Policy Disclosures: Google User Data */}
            <div style={{
              background: 'hsl(var(--bg-surface))',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '24px 20px',
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}>
              <div>
                <h3 style={{
                  fontSize: '1.15rem',
                  color: 'hsl(var(--text-primary))',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}>
                  Privacy Policy Disclosures: Google User Data
                </h3>
                <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-muted))', margin: 0 }}>
                  In accordance with the Google API Services User Data Policy, the following disclosures detail our specific policies and practices regarding the access, use, transfer, protection, and retention/deletion of Google user data.
                </p>
              </div>

              {/* Data Access */}
              <div>
                <h4 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: 700, marginBottom: '8px' }}>
                  Data Access
                </h4>
                <p style={{ fontSize: '0.93rem', marginBottom: '8px' }}>
                  Clearly stating exactly what raw and aggregated/anonymized Google user data is accessed by the app:
                </p>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                  <li>
                    <strong>Raw Google User Data Accessed:</strong>
                    <ul style={{ listStyle: 'circle', paddingLeft: '18px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li>
                        <strong>Google Account Authentication Data:</strong> When you sign in with Google, we receive basic authentication details: your full name, email address, profile photo URL, and unique Google account ID (`sub`), used to authenticate your session and establish your coach/trainee account.
                      </li>
                      <li>
                        <strong>Google Calendar Free/Busy Time Intervals:</strong> Through the Google Calendar API (<code>https://www.googleapis.com/auth/calendar.events</code> scope), our application accesses busy time ranges (start and end timestamps) on your primary calendar within a rolling 30-day window via the <code>calendar/v3/freeBusy</code> endpoint.
                      </li>
                      <li>
                        <strong>Peer Coaching Calendar Events:</strong> We access calendar event metadata for sessions scheduled through Peer Coaching Network (event ID, start and end date-times, agreed session topic, participant names/emails, and Google Meet video conference link) via <code>calendar/v3/calendars/primary/events</code>.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <strong>Aggregated / Anonymized Google User Data Accessed:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      We compute anonymized availability time intervals (e.g., UTC time slot timestamps such as "2026-10-15T14:00:00Z") by comparing your primary calendar's busy intervals with your recurring availability schedule template. No personal event titles, descriptions, attendee lists, or private calendar contents are ever aggregated or stored.
                    </p>
                  </li>
                  <li>
                    <strong>Data Not Accessed:</strong> We do not access, inspect, or request permissions for your Gmail inbox, emails, contacts, Google Drive files, search history, or any personal calendar event details unrelated to Peer Coaching Network.
                  </li>
                </ul>
              </div>

              {/* Data Use */}
              <div>
                <h4 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: 700, marginBottom: '8px' }}>
                  Data Use
                </h4>
                <p style={{ fontSize: '0.93rem', marginBottom: '8px' }}>
                  Clearly stating how raw and aggregated/anonymized Google user data is used by the app:
                </p>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                  <li>
                    <strong>How Raw Google User Data is Used:</strong>
                    <ul style={{ listStyle: 'circle', paddingLeft: '18px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li>To authenticate your identity and provision your secure coach/trainee profile on the platform.</li>
                      <li>To automatically create, update, or delete peer coaching appointments on your primary Google Calendar, including session summaries, coaching topic descriptions, attendee invitations, and auto-generated Google Meet video conference links.</li>
                      <li>To display your upcoming peer coaching sessions within your personal session dashboard.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>How Aggregated / Anonymized Google User Data is Used:</strong>
                    <p style={{ margin: '4px 0 0 0' }}>
                      Anonymized availability time intervals are used solely to display your open practice availability to other verified coaches and trainees on the platform so they can book conflict-free coaching sessions with you.
                    </p>
                  </li>
                  <li>
                    <strong>Prohibitions & Restrictions on Data Use:</strong>
                    <ul style={{ listStyle: 'circle', paddingLeft: '18px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <li>Google user data is <strong>never</strong> used for serving advertisements, retargeting, or market research.</li>
                      <li>Google user data is <strong>never</strong> used to train, retrain, or fine-tune general artificial intelligence (AI) or machine learning (ML) models.</li>
                      <li>Google user data is used strictly for providing and improving the peer coaching scheduling features requested and authorized by you.</li>
                    </ul>
                  </li>
                </ul>
              </div>

              {/* Data Transfer */}
              <div>
                <h4 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: 700, marginBottom: '8px' }}>
                  Data Transfer
                </h4>
                <p style={{ fontSize: '0.93rem', marginBottom: '8px' }}>
                  Clearly stating what raw and aggregated/anonymized Google user data is shared and with what types of parties:
                </p>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                  <li>
                    <strong>Sharing with Matched Coaching Session Participants:</strong> When you confirm a peer coaching session with another registered coach or trainee, raw session event details (your name, email address, scheduled date/time, selected coaching topic, and generated Google Meet link) are shared with the other participant through the Google Calendar event invitation so both participants can join the session.
                  </li>
                  <li>
                    <strong>Transfer to Infrastructure Service Providers:</strong> Google user data is securely processed through Google Cloud Platform and Firebase (Authentication, Cloud Functions, and Cloud Firestore) to execute application logic, secure calendar synchronization, and store session records. These providers process data under enterprise confidentiality and security terms.
                  </li>
                  <li>
                    <strong>Sharing of Aggregated / Anonymized Data:</strong> Only anonymized open calendar slot times (dates and time intervals where you are available, completely stripped of any personal details or calendar event information) are shared with other registered coaches on the platform for peer matching.
                  </li>
                  <li>
                    <strong>No Data Sale or Third-Party Brokers:</strong> We do <strong>not</strong> sell, rent, trade, or transfer raw or aggregated Google user data to data brokers, advertising networks, or any other third parties. Data is transferred only as necessary to fulfill peer coaching sessions, comply with valid legal processes, or with your explicit consent.
                  </li>
                </ul>
              </div>

              {/* Data Protection */}
              <div>
                <h4 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: 700, marginBottom: '8px' }}>
                  Data Protection
                </h4>
                <p style={{ fontSize: '0.93rem', marginBottom: '8px' }}>
                  Clearly stating how Google user data is secured and protected:
                </p>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                  <li>
                    <strong>Encryption in Transit:</strong> All network communications involving Google user data, API requests, and application interactions are encrypted using Transport Layer Security (TLS 1.2 or TLS 1.3 / HTTPS).
                  </li>
                  <li>
                    <strong>Encryption at Rest:</strong> Any stored booking metadata and profile records are hosted in Google Cloud Firestore and encrypted at rest using industry-standard AES-256 bit encryption.
                  </li>
                  <li>
                    <strong>Ephemeral In-Memory Token Management:</strong> Google OAuth access tokens are held strictly in memory and temporary browser session storage (<code>sessionStorage</code>) for active tab requests. Access tokens are <strong>never</strong> persisted to <code>localStorage</code> or stored on unauthenticated servers, and are immediately cleared when you log out or close your session.
                  </li>
                  <li>
                    <strong>Role-Based Access Control & Backend Security:</strong> Calendar operations are gated through backend Firebase Cloud Functions and protected by granular Firestore Security Rules that enforce strict user authentication and authorization checks.
                  </li>
                  <li>
                    <strong>Least Privilege Principle:</strong> We request only the minimal Google Calendar scope (<code>calendar.events</code>) necessary to create and manage peer coaching appointments, rather than requesting full calendar management or read-all permissions.
                  </li>
                </ul>
              </div>

              {/* Data Retention & Deletion */}
              <div>
                <h4 style={{ fontSize: '1.05rem', color: 'hsl(var(--text-primary))', fontWeight: 700, marginBottom: '8px' }}>
                  Data Retention & Deletion
                </h4>
                <p style={{ fontSize: '0.93rem', marginBottom: '8px' }}>
                  Clearly stating the user data retention and deletion policies and practices:
                </p>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                  <li>
                    <strong>Short-Lived Token Expiration:</strong> Temporary Google OAuth access tokens expire automatically (typically within 1 hour) and are immediately removed from browser session storage upon sign-out, session expiration, or explicit disconnect.
                  </li>
                  <li>
                    <strong>Non-Retention of External Calendar Events:</strong> Personal calendar events inspected during free/busy queries are processed in memory and are <strong>never</strong> retained, cached, or written to our permanent database. Only peer coaching bookings created through Peer Coaching Network are retained as session records during your active membership.
                  </li>
                  <li>
                    <strong>User Account Deletion Policy:</strong> You may request the permanent deletion of your account, profile, and all associated peer coaching session records at any time by contacting us at{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                      {SUPPORT_EMAIL}
                    </a>
                    . Upon receipt of your deletion request, your account data will be permanently purged from our active databases within 30 days.
                  </li>
                  <li>
                    <strong>Revocation of Google Account Access:</strong> You can revoke Peer Coaching Network's access to your Google Account at any time via{' '}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}
                    >
                      Google Account Permissions
                    </a>
                    . Upon revocation, our platform immediately loses all ability to query or modify your Google Calendar.
                  </li>
                </ul>
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
                <strong>Account Deletion:</strong> You may request complete deletion of your account, profile, and all associated session logs by emailing our support team at <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>Send Deletion Request</a>. Upon receipt, we will permanently purge your account data within 30 days.
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
