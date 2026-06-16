import React from 'react';
import type { UserProfile } from '../services/firebaseService';
import { formatDisplayName } from '../services/firebaseService';
import { getShortCredential, getCredentialBadgeClass } from '../utils/credentials';
import { sanitizeImageUrl } from '../utils/url';
import { MapPin, Calendar, Award } from 'lucide-react';

interface CoachCardProps {
  coach: UserProfile;
  onSchedule: (coach: UserProfile) => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({ coach, onSchedule }) => {
  // Truncate biography for card layouts
  const truncateBio = (text?: string, limit = 110) => {
    if (!text) return 'No biography provided yet.';
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '...';
  };

  return (
    <div className="glass-panel glass-panel-interactive animate-fade-in" style={{
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Top Background Radial Accent for Premium Feeling */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '120px',
        height: '120px',
        background: coach.qualifications?.some(q => getShortCredential(q) === 'MCC') 
          ? 'radial-gradient(circle, rgba(45, 212, 191, 0.08) 0%, rgba(0,0,0,0) 70%)'
          : coach.qualifications?.some(q => getShortCredential(q) === 'PCC')
          ? 'radial-gradient(circle, rgba(148, 163, 184, 0.08) 0%, rgba(0,0,0,0) 70%)'
          : 'radial-gradient(circle, rgba(217, 119, 6, 0.08) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(20px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div>
        {/* Profile Avatar and Name */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', zIndex: 1, position: 'relative' }}>
          <img
            src={sanitizeImageUrl(coach.photoURL)}
            alt={formatDisplayName(coach) || 'Coach'}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: coach.qualifications?.some(q => getShortCredential(q) === 'MCC')
                ? '2px solid hsl(var(--mcc-platinum))'
                : coach.qualifications?.some(q => getShortCredential(q) === 'PCC')
                ? '2px solid hsl(var(--pcc-silver))'
                : coach.qualifications?.some(q => getShortCredential(q) === 'ACC')
                ? '2px solid hsl(var(--acc-gold))'
                : '2px solid var(--border-light)'
            }}
          />
          <div style={{ overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatDisplayName(coach)}
            </h3>
            
            {/* Location Tag */}
            {coach.country ? (
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'hsl(var(--text-secondary))', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                marginTop: '2px'
              }}>
                <MapPin size={11} color="hsl(var(--primary))" />
                {coach.country}
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Remote Coach</span>
            )}
          </div>
        </div>

        {/* Qualifications Badges */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {coach.qualifications && coach.qualifications.length > 0 ? (
            coach.qualifications.map((q) => {
              const shortCode = getShortCredential(q);
              const cls = getCredentialBadgeClass(q);
              return (
                <span key={q} className={`badge ${cls}`} style={{ fontSize: '0.65rem' }}>
                  <Award size={10} style={{ marginRight: '4px' }} />
                  {shortCode}
                </span>
              );
            })
          ) : (
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
              Pending credential sync
            </span>
          )}
          
          {/* Gender badge */}
          {coach.gender && (
            <span className="badge badge-secondary" style={{ 
              fontSize: '0.65rem', 
              background: 'var(--panel-hover-bg)', 
              color: 'hsl(var(--text-secondary))',
              border: '1px solid var(--border-light)',
              textTransform: 'none'
            }}>
              {coach.gender}
            </span>
          )}
        </div>

        {/* Bio Summary */}
        <p style={{
          fontSize: '0.85rem',
          color: 'hsl(var(--text-secondary))',
          lineHeight: '1.5',
          marginBottom: '20px',
          minHeight: '45px'
        }}>
          {truncateBio(coach.bio)}
        </p>
      </div>

      {/* Action Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        borderTop: '1px solid var(--border-light)',
        paddingTop: '16px',
        marginTop: 'auto'
      }}>
        {/* Action Button */}
        <button 
          onClick={() => onSchedule(coach)}
          className="btn btn-primary"
          style={{
            padding: '8px 14px',
            fontSize: '0.8rem',
            borderRadius: '8px',
            height: '34px',
            boxShadow: 'none'
          }}
        >
          <Calendar size={13} />
          Book Peer
        </button>
      </div>
    </div>
  );
};
