import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  MapPin,
  BookOpen,
  Globe,
  LogOut,
  Mail,
  Calendar,
  Award,
  FileText
} from 'lucide-react';
import { getCredentialBadgeClass, buildDisplayCredentials } from '../utils/credentials';
import { formatDisplayName, formatMemberSince } from '../services/profileService';
import { Avatar } from './Avatar';
import { type Qualification } from '../config';

export const VerificationNotice: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const displayCredentials = buildDisplayCredentials(profile || {});

  return (
    <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
      {/* Pending Banner */}
      <div className="glass-panel" style={{
        padding: '32px',
        borderLeft: '4px solid hsl(var(--warning))',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            padding: '12px',
            borderRadius: '12px',
            color: 'hsl(var(--warning))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={28} className="animate-pulse" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>
              Application Under Review
            </h2>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'hsl(var(--text-secondary))' }}>
              Welcome, {formatDisplayName(profile || user)}! <br />An administrator will provide access once the review process is complete.
            </p>
          </div>
        </div>
      </div>

      {/* Read-Only Profile Card (similar to public profile view) */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={20} style={{ color: 'hsl(var(--primary))' }} />
          Your Submitted Profile
        </h3>

        {/* Profile Header */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar
            src={profile?.photoURL || user?.photoURL}
            name={formatDisplayName(profile || user)}
            email={profile?.email || user?.email}
            size="lg"
            border="2px solid hsl(var(--primary))"
          />
          <div>
            <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {formatDisplayName(profile || user)}
            </h4>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Mail size={14} style={{ color: 'hsl(var(--primary))' }} />
              {profile?.email || user?.email}
            </p>
            {profile?.createdAt && (
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} />
                Member since {formatMemberSince(profile.createdAt)}
              </p>
            )}
          </div>
        </div>

        {/* Credentials and Gender Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {displayCredentials.length > 0 ? (
            displayCredentials.map((qual, idx) => (
              <span key={idx} className={`badge ${getCredentialBadgeClass(qual as Qualification)}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                <Award size={12} style={{ marginRight: '4px' }} />
                {qual}
              </span>
            ))
          ) : null}

          {profile?.gender && (
            <span className="badge badge-secondary" style={{
              fontSize: '0.75rem',
              padding: '4px 10px',
              background: 'var(--panel-hover-bg)',
              color: 'hsl(var(--text-secondary))',
              border: '1px solid var(--border-light)',
              textTransform: 'none'
            }}>
              {profile.gender}
            </span>
          )}
        </div>

        {/* Professional Biography */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} style={{ color: 'hsl(var(--primary))' }} />
            Professional Biography
          </h4>
          <p style={{ fontSize: '0.925rem', lineHeight: '1.6', color: 'hsl(var(--text-secondary))', whiteSpace: 'pre-line' }}>
            {profile?.bio || 'No biography submitted.'}
          </p>
        </div>

        {/* Geography & Timezone */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={13} style={{ color: 'hsl(var(--primary))' }} />
              Country
            </h4>
            <p style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {profile?.country || 'Not specified'}
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={13} style={{ color: 'hsl(var(--primary))' }} />
              Timezone
            </h4>
            <p style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {profile?.timezone || 'Not specified'}
            </p>
          </div>
        </div>

        {/* Coaching Credentials */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={14} style={{ color: 'hsl(var(--primary))' }} />
            Coaching Credentials
          </h4>
          <p style={{ fontSize: '0.925rem', lineHeight: '1.6', color: 'hsl(var(--text-secondary))', whiteSpace: 'pre-line' }}>
            {profile?.credentialDetails || 'No coaching credentials submitted.'}
          </p>
        </div>

        {/* Action Button: Sign Out */}
        <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
          <button
            type="button"
            onClick={logout}
            className="btn btn-outline-danger"
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
