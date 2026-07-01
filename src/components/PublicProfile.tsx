import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Award,
  Globe,
  FileText,
  Mail,
  Calendar,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';
import { 
  type UserProfile, 
  formatDisplayName, 
  formatMemberSince, 
  subscribeToProfile 
} from '../services/firebaseService';
import { 
  getCredentialBadgeClass, 
  getCredentialDescription 
} from '../utils/credentials';
import { sanitizeImageUrl } from '../utils/url';
import { getDisplayCredentials, mapIcfLevelToQualification } from '../utils/credentialHelpers';
import type { Qualification } from '../config';

interface PublicProfileProps {
  uid: string;
  onClose: () => void;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ uid, onClose }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [prevUid, setPrevUid] = useState(uid);

  // Adjust state during render when uid prop changes to avoid synchronous setState inside useEffect.
  if (uid !== prevUid) {
    setPrevUid(uid);
    setProfile(null);
    setLoading(true);
  }

  useEffect(() => {
    const unsubscribe = subscribeToProfile(uid, (data) => {
      setProfile(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);

  const handleCopyLink = async () => {
    const profileLink = `${window.location.origin}${window.location.pathname}?profile=${uid}`;
    try {
      await navigator.clipboard.writeText(profileLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '64px 32px',
        width: '100%',
        minHeight: '400px'
      }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '16px' }} />
        <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>Loading profile details...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '24px' }}>
        <div className="glass-panel" style={{ padding: '32px', width: '100%', maxWidth: '640px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px', color: 'hsl(var(--text-primary))' }}>
            Profile Not Found
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
            The requested coaching profile does not exist or you do not have permission to view it.
          </p>
          <button onClick={onClose} className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Border mapping based on highest qualification
  let borderCol = 'var(--border-light)';
  const displayCredentials = getDisplayCredentials(profile.icfCredentials);
  const hasMCC = displayCredentials.some(c => mapIcfLevelToQualification(c.level) === 'ICF MCC');
  const hasPCC = displayCredentials.some(c => mapIcfLevelToQualification(c.level) === 'ICF PCC');
  const hasACC = displayCredentials.some(c => mapIcfLevelToQualification(c.level) === 'ICF ACC');
  
  if (hasMCC) borderCol = 'hsl(var(--mcc-platinum))';
  else if (hasPCC) borderCol = 'hsl(var(--pcc-silver))';
  else if (hasACC) borderCol = 'hsl(var(--acc-gold))';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '32px' }}>
      <div style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Navigation & Sharing Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <button
            onClick={handleCopyLink}
            className="btn btn-secondary"
            style={copied ? {
              borderColor: 'hsl(var(--success))',
              color: 'hsl(var(--success))',
              background: 'hsl(var(--success) / 0.05)'
            } : undefined}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Link Copied!' : 'Copy Profile Link'}
          </button>
        </div>

        {/* Profile Card Header (Glass Panel with radial background highlight) */}
        <div className="glass-panel" style={{ 
          padding: '32px', 
          position: 'relative', 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          {/* Top Background Radial Accent */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '150px',
            height: '150px',
            background: hasMCC 
              ? 'radial-gradient(circle, rgba(45, 212, 191, 0.08) 0%, rgba(0,0,0,0) 70%)'
              : hasPCC
              ? 'radial-gradient(circle, rgba(148, 163, 184, 0.08) 0%, rgba(0,0,0,0) 70%)'
              : 'radial-gradient(circle, rgba(217, 119, 6, 0.08) 0%, rgba(0,0,0,0) 70%)',
            filter: 'blur(20px)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />

          {/* Large Avatar */}
          <img
            src={sanitizeImageUrl(profile.photoURL)}
            alt={formatDisplayName(profile) || 'Coach'}
            style={{ 
              width: '96px', 
              height: '96px', 
              borderRadius: '50%', 
              border: `3px solid ${borderCol}`,
              marginBottom: '20px',
              objectFit: 'cover',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
            }}
          />

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
            {formatDisplayName(profile) || 'Peer Coach'}
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Mail size={14} style={{ color: 'hsl(var(--primary))' }} />
            {profile.email}
          </p>

          {profile.createdAt && (
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              Member since {formatMemberSince(profile.createdAt)}
            </p>
          )}

          {/* Qualifications Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px', justifyContent: 'center' }}>
            {displayCredentials.length > 0 ? (
              displayCredentials.map((cred, idx) => {
                const qual = mapIcfLevelToQualification(cred.level) || cred.level;
                return (
                  <span key={idx} className={`badge ${getCredentialBadgeClass(qual as Qualification)}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                    <Award size={12} style={{ marginRight: '4px' }} />
                    {qual as string}
                  </span>
                );
              })
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                Trainee Coach
              </span>
            )}

            {profile.gender && (
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
        </div>

        {/* Credentials and Certifications Descriptions */}
        {displayCredentials.length > 0 && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={16} style={{ color: 'hsl(var(--primary))' }} />
              Verified Credentials
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {displayCredentials.map((cred, idx) => {
                const qual = mapIcfLevelToQualification(cred.level) || cred.level;
                // Don't show if expiry is before today
                if (cred.expiryDate.toDate() < new Date()) return null;
                
                return (
                  <div key={idx} style={{ 
                    padding: '16px', 
                    background: 'var(--panel-hover-bg)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', fontSize: '0.95rem' }}>
                        {getCredentialDescription(qual as Qualification)}
                      </span>
                      <span className={`badge ${getCredentialBadgeClass(qual as Qualification)}`} style={{ fontSize: '0.7rem' }}>
                        {qual as string}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                      International Coaching Federation (ICF)
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
                      Valid through: {cred.expiryDate.toDate().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Biography Section */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: 'hsl(var(--primary))' }} />
            Professional Biography
          </h3>
          <p style={{ 
            fontSize: '0.9rem', 
            color: 'hsl(var(--text-secondary))', 
            lineHeight: '1.6', 
            whiteSpace: 'pre-wrap' 
          }}>
            {profile.bio || 'This coach hasn\'t written a biography yet.'}
          </p>
        </div>

        {/* Geography & Timezone Section */}
        <div className="glass-panel" style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* CSS responsive breakdown helper */}
          <style>{`
            @media (max-width: 520px) {
              .geo-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
          
          <div className="geo-grid" style={{ display: 'contents' }}>
            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={13} style={{ color: 'hsl(var(--primary))' }} />
                Country
              </h4>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile.country || 'Not specified'}
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={13} style={{ color: 'hsl(var(--primary))' }} />
                Timezone
              </h4>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile.timezone || 'Not specified'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
