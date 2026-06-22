import React, { useState, useEffect } from 'react';
import { 
  createInvitation, 
  subscribeToInvitations, 
  revokeInvitation, 
  type InvitedUserCache 
} from '../services/firebaseService';
import { 
  Mail, 
  Shield, 
  Trash2, 
  UserPlus, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  Users
} from 'lucide-react';
import { type UserRole, USER_ROLE } from '../config';

export const InviteCoaches: React.FC = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(USER_ROLE.USER);
  const [invitations, setInvitations] = useState<InvitedUserCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);
  
  // Feedback messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Subscribe to invitations
  useEffect(() => {
    const unsubscribe = subscribeToInvitations((invitesList) => {
      setInvitations(invitesList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await createInvitation(cleanEmail, role);
      setSuccess(`Successfully invited ${cleanEmail} as ${role}!`);
      setEmail('');
      setRole(USER_ROLE.USER);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (emailToRevoke: string) => {
    if (!window.confirm(`Are you sure you want to revoke the invitation for ${emailToRevoke}?`)) {
      return;
    }

    setRevokingEmail(emailToRevoke);
    setError(null);
    setSuccess(null);

    try {
      await revokeInvitation(emailToRevoke);
      setSuccess(`Invitation for ${emailToRevoke} has been revoked.`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to revoke invitation.');
      }
    } finally {
      setRevokingEmail(null);
    }
  };

  const getDaysRemaining = (expiresAt: InvitedUserCache['expiresAt']) => {
    const diffMs = expiresAt.toMillis() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return 'Expires today';
    return `Expires in ${diffDays} days`;
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Title Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={28} style={{ color: 'hsl(var(--primary))' }} />
          Invite Coaches
        </h2>
        <p style={{ fontSize: '0.925rem', color: 'hsl(var(--text-secondary))', marginTop: '6px', lineHeight: 1.5 }}>
          Pre-create active user accounts. Once invited, a coach can log in with their Google account to instantly access the platform with their pre-assigned role. Invitations automatically expire after 7 days.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="glass-panel" style={{ 
          padding: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.1), hsl(var(--destructive) / 0.05))',
          border: '1px solid hsl(var(--destructive) / 0.35)', 
          borderLeft: '4px solid hsl(var(--destructive))',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} color="hsl(var(--destructive))" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>{error}</p>
        </div>
      )}

      {success && (
        <div className="glass-panel" style={{ 
          padding: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          background: 'linear-gradient(135deg, #10b9811a, #10b9810d)',
          border: '1px solid #10b98159', 
          borderLeft: '4px solid #10b981',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>{success}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }} className="invite-layout-grid">
        <style>{`
          @media (max-width: 900px) {
            .invite-layout-grid {
              grid-template-columns: 1fr !important;
            }
          }
          .invite-table td {
            vertical-align: middle;
          }
        `}</style>

        {/* Left Side: Invitation Form */}
        <div className="glass-panel" style={{ padding: '32px', alignSelf: 'start' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} style={{ color: 'hsl(var(--primary))' }} />
            Send New Invitation
          </h3>

          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Email Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>
                Email Address
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="coach@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Role Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>
                System Role
              </label>
              <select
                className="input-field"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                style={{ width: '100%' }}
              >
                <option value={USER_ROLE.USER}>User (Standard Coach)</option>
                <option value={USER_ROLE.ADMIN}>Admin (Platform Administrator)</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px', height: '42px', fontSize: '0.95rem' }}
            >
              {submitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>

        {/* Right Side: Active Invitations List */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: 'hsl(var(--primary))' }} />
            Active Invitations
          </h3>

          {loading ? (
            <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '24px 0' }}>
              Loading active invitations...
            </p>
          ) : invitations.length === 0 ? (
            <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '48px 0', fontSize: '0.9rem' }}>
              No active invitations found.
            </p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table invite-table">
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Expiration</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invite) => (
                    <tr key={invite.email}>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{invite.email}</span>
                      </td>
                      <td>
                        <span className={`badge ${invite.userRole === USER_ROLE.ADMIN ? 'badge-admin' : 'badge-user'}`} style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
                          {invite.userRole}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={12} />
                          {getDaysRemaining(invite.expiresAt)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleRevoke(invite.email)}
                          disabled={revokingEmail === invite.email}
                          className="btn btn-secondary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            height: '32px',
                            gap: '6px',
                            borderColor: 'hsl(var(--destructive) / 0.3)',
                            color: 'hsl(var(--destructive))',
                            background: 'transparent'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'hsl(var(--destructive) / 0.1)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Trash2 size={12} />
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
