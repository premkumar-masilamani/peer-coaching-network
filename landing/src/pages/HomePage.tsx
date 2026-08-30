import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  ShieldCheck,
  Users,
  Video,
  ArrowRight,
  GraduationCap,
  Award,
  Lock,
  ChevronDown,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const appUrl = import.meta.env.VITE_APP_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5173'
      : 'https://app.peercoachingnetwork.com'
  );

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'Who can join Peer Coaching Network?',
      a: 'Peer Coaching Network is open to both credentialed professional life coaches (such as ICF ACC, PCC, MCC) and trainee coaches currently enrolled in recognized coaching certification programs who need real coaching practice hours.'
    },
    {
      q: 'Is there any fee or subscription to use the platform?',
      a: 'No. Peer Coaching Network is built on a reciprocal peer-to-peer model. You earn coaching and feedback by coaching your fellow peers. There are no subscription fees or hidden costs.'
    },
    {
      q: 'Why does the app ask to connect my Google Calendar?',
      a: 'We connect with your Google Calendar exclusively to create coaching sessions and generate secure Google Meet video links when you and a peer confirm a session. We do not read your private emails, contacts, or unrelated calendar entries.'
    },
    {
      q: 'How does session scheduling work across different time zones?',
      a: 'You simply choose your available time windows in your local time zone. When a peer views your profile, the system automatically translates those times into their local time zone, making cross-border scheduling effortless.'
    },
    {
      q: 'Can I sell coaching packages or services to peers?',
      a: 'No. Peer Coaching Network is strictly a practice and mastery space. Commercial solicitation, sales pitches, and marketing funnels are strictly prohibited to ensure a safe, focused learning atmosphere.'
    }
  ];

  return (
    <div className="animate-fade-in">
      {/* ── HERO SECTION ───────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: '56px', paddingBottom: '72px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '860px' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9999px',
            background: 'hsl(var(--primary) / 0.08)',
            border: '1px solid hsl(var(--primary) / 0.2)',
            marginBottom: '28px',
            fontSize: '0.88rem',
            color: 'hsl(var(--primary))',
            fontWeight: 600
          }}>
            <Sparkles size={16} />
            <span>Dedicated Peer-to-Peer Life Coaching Network</span>
          </div>

          {/* Main Headline */}
          <h1 style={{
            fontSize: 'clamp(2.4rem, 5vw, 3.8rem)',
            lineHeight: 1.15,
            fontWeight: 800,
            color: 'hsl(var(--text-primary))',
            marginBottom: '24px',
            letterSpacing: '-0.03em',
          }}>
            A Trusted Space for Coaches & Trainees to Practice and Grow.
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
            color: 'hsl(var(--text-secondary))',
            lineHeight: 1.6,
            marginBottom: '36px',
            maxWidth: '720px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Connect with credentialed life coaches and trainee peers for reciprocal coaching sessions. Hone your core competencies, gain practical confidence, and log verified practice hours in a safe, non-commercial community.
          </p>

          {/* Primary CTAs */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}>
            <a
              href={appUrl}
              className="btn btn-primary"
              style={{ fontSize: '1.05rem', padding: '14px 32px' }}
            >
              <span>Launch App & Sign In</span>
              <ArrowRight size={18} />
            </a>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('how-it-works');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn btn-secondary"
              style={{ fontSize: '1.05rem', padding: '14px 28px' }}
            >
              How It Works
            </button>
          </div>

          {/* Trust Highlights Strip */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            fontSize: '0.9rem',
            color: 'hsl(var(--text-muted))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="hsl(var(--success))" />
              <span>For Trainees & Certified Coaches</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="hsl(var(--success))" />
              <span>Automated Google Meet Video Links</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="hsl(var(--success))" />
              <span>100% Free & Reciprocal</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 PILLARS OF TRUST ────────────────────────────────────────── */}
      <section id="trust-pillars" className="section" style={{
        background: 'hsl(var(--bg-surface))',
        borderTop: '1px solid var(--border-light)',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px auto' }}>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              Built on Trust, Practice, and Mutual Growth
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'hsl(var(--text-secondary))' }}>
              We believe the best way to master life coaching is through consistent, real-world practice with peers who understand the craft.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
          }}>
            {/* Pillar 1 */}
            <div className="landing-card" style={{ padding: '32px 24px' }}>
              <div style={{
                background: 'hsl(var(--primary) / 0.1)',
                color: 'hsl(var(--primary))',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <GraduationCap size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', fontWeight: 700 }}>
                Welcoming All Coaching Stages
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                Whether you are a trainee coach building your initial certification hours or an experienced coach maintaining sharp competencies, you have a welcoming space here.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="landing-card" style={{ padding: '32px 24px' }}>
              <div style={{
                background: 'hsl(var(--accent) / 0.1)',
                color: 'hsl(var(--accent))',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <ShieldCheck size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', fontWeight: 700 }}>
                Strictly Non-Commercial
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                A dedicated practice sanctuary. No sales pitches, courses, or marketing funnels. Every member is here to coach, be coached, and learn.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="landing-card" style={{ padding: '32px 24px' }}>
              <div style={{
                background: 'hsl(var(--success) / 0.1)',
                color: 'hsl(var(--success))',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <Calendar size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', fontWeight: 700 }}>
                Automated Calendar Sync
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                No manual back-and-forth emails. Connecting your Google Calendar automatically creates your coaching sessions and generates private Google Meet links.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="landing-card" style={{ padding: '32px 24px' }}>
              <div style={{
                background: 'hsl(var(--primary) / 0.1)',
                color: 'hsl(var(--primary))',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <Users size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', fontWeight: 700 }}>
                Safe & Reciprocal Learning
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                Experience both sides of the conversation: practice your coaching technique and receive insightful feedback in a confidential, supportive peer environment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section id="how-it-works" className="section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px auto' }}>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              How It Works
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'hsl(var(--text-secondary))' }}>
              Three simple steps to connect, practice, and sharpen your coaching skills.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '32px',
            position: 'relative',
          }}>
            {/* Step 1 */}
            <div style={{
              background: 'hsl(var(--bg-surface))',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '32px',
              position: 'relative',
            }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'hsl(var(--primary))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
              }}>
                Step 01
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{
                  background: 'hsl(var(--primary) / 0.1)',
                  color: 'hsl(var(--primary))',
                  padding: '10px',
                  borderRadius: '10px',
                  display: 'flex',
                }}>
                  <Clock size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Set Your Schedule</h3>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                Define when you are available for peer coaching in your local time zone. The platform takes care of time zone conversion for international matches.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{
              background: 'hsl(var(--bg-surface))',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '32px',
              position: 'relative',
            }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'hsl(var(--primary))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
              }}>
                Step 02
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{
                  background: 'hsl(var(--accent) / 0.1)',
                  color: 'hsl(var(--accent))',
                  padding: '10px',
                  borderRadius: '10px',
                  display: 'flex',
                }}>
                  <Users size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Discover & Book</h3>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                Browse verified coaches and fellow trainees by experience level, coaching topics, or language. Book an open slot with a single click.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{
              background: 'hsl(var(--bg-surface))',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '32px',
              position: 'relative',
            }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'hsl(var(--primary))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
              }}>
                Step 03
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{
                  background: 'hsl(var(--success) / 0.1)',
                  color: 'hsl(var(--success))',
                  padding: '10px',
                  borderRadius: '10px',
                  display: 'flex',
                }}>
                  <Video size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Meet, Coach & Log</h3>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
                Join the automatic Google Meet video call. Conduct your session, exchange constructive feedback, and log your hours toward credentialing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ────────────────────────────────────────────── */}
      <section id="who-it-is-for" className="section" style={{
        background: 'hsl(var(--bg-surface))',
        borderTop: '1px solid var(--border-light)',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px auto' }}>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              Designed for Every Step of Your Coaching Journey
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'hsl(var(--text-secondary))' }}>
              Whether you are completing your first 50 hours or have coached for decades, peer practice accelerates your mastery.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '32px',
          }}>
            {/* Trainee Coaches */}
            <div className="landing-card" style={{ padding: '36px', borderLeft: '4px solid hsl(var(--accent))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  background: 'hsl(var(--accent) / 0.1)',
                  color: 'hsl(var(--accent))',
                  padding: '8px',
                  borderRadius: '8px',
                }}>
                  <GraduationCap size={24} />
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>For Trainee Coaches</h3>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px', lineHeight: 1.6 }}>
                Gaining real practice hours outside the classroom can be daunting. Peer Coaching Network connects you with supportive peers so you can:
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem' }}>
                  <CheckCircle2 size={18} color="hsl(var(--accent))" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Safely practice core competencies without the pressure of paying clients.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem' }}>
                  <CheckCircle2 size={18} color="hsl(var(--accent))" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Accumulate verified practice hours needed for your coaching certification.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem' }}>
                  <CheckCircle2 size={18} color="hsl(var(--accent))" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Receive honest, constructive feedback from other coaches on the same journey.</span>
                </li>
              </ul>
            </div>

            {/* Credentialed Coaches */}
            <div className="landing-card" style={{ padding: '36px', borderLeft: '4px solid hsl(var(--primary))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  background: 'hsl(var(--primary) / 0.1)',
                  color: 'hsl(var(--primary))',
                  padding: '8px',
                  borderRadius: '8px',
                }}>
                  <Award size={24} />
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>For Credentialed Coaches</h3>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px', lineHeight: 1.6 }}>
                Mastery requires continuous sharpening. Seasoned coaches (ACC, PCC, MCC) use the network to:
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem' }}>
                  <CheckCircle2 size={18} color="hsl(var(--primary))" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Experiment with new coaching frameworks and deep questioning techniques.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem' }}>
                  <CheckCircle2 size={18} color="hsl(var(--primary))" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Engage in reciprocal peer supervision and calibration with fellow practitioners.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem' }}>
                  <CheckCircle2 size={18} color="hsl(var(--primary))" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Contribute back to the coaching community by peer-mentoring rising coaches.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SIMPLE CALENDAR TRANSPARENCY CARD ───────────────────────── */}
      <section className="section">
        <div className="container" style={{ maxWidth: '840px' }}>
          <div className="glass-panel" style={{ padding: '40px 36px', border: '1px solid hsl(var(--primary) / 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                background: 'hsl(var(--primary) / 0.1)',
                color: 'hsl(var(--primary))',
                padding: '10px',
                borderRadius: '10px',
                display: 'flex',
              }}>
                <Lock size={22} />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                Simple, Private Calendar Connection
              </h3>
            </div>
            <p style={{ fontSize: '1rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.6, marginBottom: '20px' }}>
              We understand the importance of schedule privacy. When you sign in with your Google account, our app connects with your Google Calendar for <strong>only one purpose</strong>: to add scheduled peer coaching sessions and automatically generate secure Google Meet video links.
            </p>
            <div style={{
              background: 'hsl(var(--bg-surface))',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '0.92rem',
              color: 'hsl(var(--text-secondary))',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" />
                <span>We never read your private emails, documents, or contacts.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" />
                <span>We never read or alter your unrelated personal calendar events.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="hsl(var(--success))" />
                <span>We never sell or share your information with advertisers.</span>
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => onNavigate('/privacy')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--primary))',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Read our full Privacy Policy →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ACCORDION ───────────────────────────────────────────── */}
      <section id="faq" className="section" style={{
        background: 'hsl(var(--bg-surface))',
        borderTop: '1px solid var(--border-light)',
      }}>
        <div className="container" style={{ maxWidth: '780px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '12px', letterSpacing: '-0.02em' }}>
              Frequently Asked Questions
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'hsl(var(--text-secondary))' }}>
              Everything you need to know about joining and practicing with the network.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  background: 'hsl(var(--bg-surface-elevated))',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: 'hsl(var(--text-primary))',
                  }}>
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={20}
                    style={{
                      transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                      color: 'hsl(var(--text-secondary))',
                    }}
                  />
                </button>
                {openFaq === idx && (
                  <div style={{
                    padding: '0 24px 20px 24px',
                    fontSize: '0.95rem',
                    color: 'hsl(var(--text-secondary))',
                    lineHeight: 1.6,
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '16px',
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA BANNER ────────────────────────────────────────── */}
      <section className="section" style={{ textAlign: 'center', paddingBottom: '96px' }}>
        <div className="container" style={{ maxWidth: '720px' }}>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '16px', letterSpacing: '-0.02em' }}>
            Ready to elevate your coaching practice?
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'hsl(var(--text-secondary))', marginBottom: '32px' }}>
            Join fellow credentialed coaches and trainees in a dedicated, supportive peer learning community.
          </p>
          <a
            href={appUrl}
            className="btn btn-primary"
            style={{ fontSize: '1.1rem', padding: '16px 36px' }}
          >
            <span>Launch Peer Coaching Network</span>
            <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </div>
  );
};
