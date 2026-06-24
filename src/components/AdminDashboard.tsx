import React, { useState, useEffect } from 'react';
import {
  subscribeToAllUsers,
  updateProfile,
  formatDisplayName,
  formatMemberSince,
  getEffectiveRole,
  getEffectiveStatus,
  db,
  logAnalyticsEvent
} from '../services/firebaseService';
import type { UserProfile } from '../services/firebaseService';
import { sanitizeImageUrl, sanitizeMeetLink } from '../utils/url';
import {
  Search,
  UserCheck,
  Info,
  Video,
  ExternalLink,
  X
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { CalendarEvent } from '../services/googleCalendar';
import { getShortCredential, getCredentialBadgeClass } from '../utils/credentials';
import { type Qualification, type UserRole, type UserStatus, QUALIFICATION_OPTIONS, USER_ROLE, USER_STATUS, BOOKING_STATUS, EVENT_TYPE, COLLECTIONS } from '../config';

interface AdminDashboardProps {
  initialFilter?: 'all' | UserStatus | UserRole;
  setInitialFilter?: (filter: 'all' | UserStatus | UserRole) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialFilter = 'all', setInitialFilter }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserStatus | UserRole>(initialFilter);
  const [selectedCoachUid, setSelectedCoachUid] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [approvalModalData, setApprovalModalData] = useState<{
    uid: string;
    userName: string;
    changes: string[];
    roleToSave: UserRole;
    statusToSave: UserStatus;
    qualificationsToSave: Qualification[];
  } | null>(null);
  const [coachMeetings, setCoachMeetings] = useState<CalendarEvent[]>([]);

  // Mirror parent-driven filter changes using the adjust-during-render pattern
  // (no effect, no setTimeout hack). See BUG-015.
  const [prevInitialFilter, setPrevInitialFilter] = useState(initialFilter);
  if (initialFilter !== prevInitialFilter) {
    setPrevInitialFilter(initialFilter);
    setRoleFilter(initialFilter);
  }

  // Fetch coach meetings when a coach profile is opened
  useEffect(() => {
    const coach = selectedCoachUid && users ? users.find(u => u.userId === selectedCoachUid) : undefined;

    const fetchMeetings = async () => {
      if (!coach || !db) {
        setCoachMeetings([]);
        return;
      }
      try {
        // Query by stable userId, not email. See BUG-019.
        const qClient = query(collection(db, COLLECTIONS.BOOKINGS), where('clientUid', '==', coach.userId));
        const snapClient = await getDocs(qClient);

        const qHost = query(collection(db, COLLECTIONS.BOOKINGS), where('coachUid', '==', coach.userId));
        const snapHost = await getDocs(qHost);

        const meetings: CalendarEvent[] = [];
        const seenIds = new Set<string>();

        const profileCache = new Map<string, UserProfile>();
        const getProfile = async (uid: string): Promise<UserProfile | null> => {
          if (profileCache.has(uid)) return profileCache.get(uid)!;
          const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
          if (userSnap.exists()) {
            const profile = userSnap.data() as UserProfile;
            profileCache.set(uid, profile);
            return profile;
          }
          return null;
        };

        const processSnap = async (snap: QuerySnapshot<DocumentData>) => {
          for (const docSnap of snap.docs) {
            const data = docSnap.data();
            if (data.status === BOOKING_STATUS.CANCELLED) continue;
            if (!seenIds.has(data.bookingId)) {
              seenIds.add(data.bookingId);
              
              const startStr: string = data.startTime && typeof data.startTime.toDate === 'function'
                ? data.startTime.toDate().toISOString()
                : (data.startTime?.dateTime || data.startTime || '');
              const endStr: string = data.endTime && typeof data.endTime.toDate === 'function'
                ? data.endTime.toDate().toISOString()
                : (data.endTime?.dateTime || data.endTime || '');

              const coachProfile = await getProfile(data.coachUid);
              const clientProfile = await getProfile(data.clientUid);

              const coachFirstName = coachProfile ? coachProfile.displayName.split(' ')[0] : 'Coach';
              const clientFirstName = clientProfile ? clientProfile.displayName.split(' ')[0] : 'Peer';

              meetings.push({
                id: data.bookingId,
                summary: `${coachFirstName} / ${clientFirstName} - Peer Coaching Session`,
                description: `Topic: ${data.topic}`,
                start: { dateTime: startStr },
                end: { dateTime: endStr },
                meetLink: data.googleMeetLink,
                type: EVENT_TYPE.PEER_COACHING,
                attendees: [
                  { email: coachProfile?.email || '', displayName: coachProfile?.displayName || '' },
                  { email: clientProfile?.email || '', displayName: clientProfile?.displayName || '' }
                ]
              });
            }
          }
        };

        await processSnap(snapClient);
        await processSnap(snapHost);

        meetings.sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
        setCoachMeetings(meetings);
      } catch (err) {
        console.error('Error fetching coach meetings:', err);
      }
    };

    fetchMeetings();
  }, [selectedCoachUid, users]);

  const handleTabChange = (filter: 'all' | UserStatus | UserRole) => {
    setRoleFilter(filter);
    if (setInitialFilter) {
      setInitialFilter(filter);
    }
  };

  // Local state for tracking uncommitted dropdown and checkbox modifications
  const [drafts, setDrafts] = useState<Record<
    string,
    {
      userRole?: UserRole;
      userStatus?: UserStatus;
      gender?: string;
      country?: string;
      qualifications?: Qualification[];
    }
  >>({});

  // Subscribe to all user records
  useEffect(() => {
    const unsub = subscribeToAllUsers((usersList) => {
      setUsers(usersList);
      setLoading(false);
    });
    return () => unsub();
  }, []);


  // Canonical role/status resolution lives in the service layer. See BUG-012.
  const getUserRole = (u: UserProfile): UserRole => getEffectiveRole(u);
  const getUserStatus = (u: UserProfile): UserStatus => getEffectiveStatus(u);

  const triggerApprove = (uid: string) => {
    const userToSave = users.find(u => u.userId === uid);
    if (!userToSave) return;

    const draft = drafts[uid];
    if (!draft || Object.keys(draft).length === 0) {
      setApprovalModalData({
        uid,
        userName: formatDisplayName(userToSave),
        changes: [],
        roleToSave: getUserRole(userToSave),
        statusToSave: getUserStatus(userToSave),
        qualificationsToSave: userToSave.qualifications || []
      });
      return;
    }

    const roleToSave = draft.userRole || getUserRole(userToSave);
    const statusToSave = draft.userStatus || getUserStatus(userToSave);
    const qualificationsToSave = draft.qualifications !== undefined ? draft.qualifications : (userToSave.qualifications || []);

    const changes: string[] = [];
    if (draft.userRole && draft.userRole !== getUserRole(userToSave)) {
      changes.push(`System Role: "${getUserRole(userToSave)}" → "${draft.userRole}"`);
    }
    if (draft.userStatus && draft.userStatus !== getUserStatus(userToSave)) {
      changes.push(`Status: "${getUserStatus(userToSave)}" → "${draft.userStatus}"`);
    }
    if (draft.qualifications) {
      const oldQuals = (userToSave.qualifications || []).map(getShortCredential).join(', ') || 'None';
      const newQuals = draft.qualifications.map(getShortCredential).join(', ') || 'None';
      if (oldQuals !== newQuals) {
        changes.push(`Credentials: "${oldQuals}" → "${newQuals}"`);
      }
    }

    setApprovalModalData({
      uid,
      userName: formatDisplayName(userToSave),
      changes,
      roleToSave,
      statusToSave,
      qualificationsToSave
    });
  };

  const executeApproval = async (
    uid: string,
    roleToSave: UserRole,
    statusToSave: UserStatus,
    qualificationsToSave: Qualification[]
  ) => {
    setSavingId(uid);
    try {
      const userToSave = users.find(u => u.userId === uid);
      const originalStatus = userToSave ? getUserStatus(userToSave) : undefined;
      const originalRole = userToSave ? getUserRole(userToSave) : undefined;
      const originalQuals = userToSave?.qualifications || [];

      await updateProfile(uid, {
        userRole: roleToSave,
        userStatus: statusToSave,
        qualifications: qualificationsToSave
      });

      // Log analytics events for changes
      if (originalStatus !== statusToSave) {
        if (statusToSave === USER_STATUS.ACTIVE) {
          logAnalyticsEvent('admin_approve_user', { targetUid: uid });
        } else {
          logAnalyticsEvent('admin_deactivate_user', { targetUid: uid });
        }
      }
      if (originalRole && originalRole !== roleToSave) {
        logAnalyticsEvent('admin_update_role', { targetUid: uid, role: roleToSave });
      }
      const qualsChanged = originalQuals.length !== qualificationsToSave.length ||
        !originalQuals.every(q => qualificationsToSave.includes(q)) ||
        !qualificationsToSave.every(q => originalQuals.includes(q));
      if (qualsChanged) {
        logAnalyticsEvent('admin_update_qualifications', { targetUid: uid, qualifications: qualificationsToSave });
      }

      setDrafts(prev => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    } catch (e) {
      console.error('Error approving user changes:', e);
    } finally {
      setSavingId(null);
    }
  };

  // Filter logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.displayName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(search.toLowerCase());

    const matchesRole =
      roleFilter === 'all' ? true :
        roleFilter === USER_STATUS.INACTIVE ? getUserStatus(u) === USER_STATUS.INACTIVE :
          roleFilter === USER_ROLE.USER ? (getUserRole(u) === USER_ROLE.USER && getUserStatus(u) === USER_STATUS.ACTIVE) :
            roleFilter === USER_ROLE.ADMIN ? (getUserRole(u) === USER_ROLE.ADMIN && getUserStatus(u) === USER_STATUS.ACTIVE) : true;

    return matchesSearch && matchesRole;
  });

  const pendingCount = users.filter(u => getUserStatus(u) === USER_STATUS.INACTIVE).length;

  // If the selected coach vanished from the list, drop back to the list view.
  // Adjust-during-render (converges once selectedCoachUid is cleared) — avoids
  // the previous unconditional setState-in-render. See BUG-015.
  if (selectedCoachUid && !loading && users.length > 0 && !users.find(u => u.userId === selectedCoachUid)) {
    setSelectedCoachUid(null);
  }

  // Render Premium Coach Profile Page View
  if (selectedCoachUid) {
    const coach = users.find(u => u.userId === selectedCoachUid);
    if (!coach) {
      return null;
    }

    // coachMeetings are loaded from Firestore dynamically via useEffect

    return (
      <div className="animate-fade-in" style={{ width: '100%' }}>
        {/* Back Button */}
        <button
          onClick={() => setSelectedCoachUid(null)}
          className="btn btn-secondary"
          style={{ marginBottom: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>←</span>
          Back to User List
        </button>

        {/* Coach Profile Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', width: '100%' }} className="coach-profile-grid">
          {/* CSS responsive breakdown helper */}
          <style>{`
            @media (max-width: 900px) {
              .coach-profile-grid {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>

          {/* Left Column: Avatar & Quick Info */}
          <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', alignSelf: 'start' }}>
            <img
              src={sanitizeImageUrl(coach.photoURL)}
              alt={formatDisplayName(coach) || 'Coach'}
              style={{ width: '120px', height: '120px', borderRadius: '50%', border: '3px solid hsl(var(--primary))', marginBottom: '20px' }}
            />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>
              {formatDisplayName(coach)}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: coach.createdAt ? '4px' : '16px' }}>
              {coach.email}
            </p>
            {coach.createdAt && (
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginBottom: '16px' }}>
                Member since {formatMemberSince(coach.createdAt)}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
              <span className={`badge ${getUserStatus(coach) === USER_STATUS.ACTIVE ? 'badge-user' : 'badge-pending'}`}>
                {getUserStatus(coach) === USER_STATUS.ACTIVE ? 'Active' : 'Inactive'}
              </span>
              <span className="badge badge-admin" style={{ textTransform: 'capitalize' }}>
                {getUserRole(coach)}
              </span>
            </div>

            {/* Coach Qualifications display */}
            <div style={{ width: '100%', borderTop: '1px solid var(--border-light)', paddingTop: '20px', textAlign: 'left' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '12px' }}>
                Credentials
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {coach.qualifications && coach.qualifications.length > 0 ? (
                  coach.qualifications.map((q) => {
                    const shortCode = getShortCredential(q);
                    const cls = getCredentialBadgeClass(q);
                    return (
                      <span key={q} className={`badge ${cls}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                        {shortCode}
                      </span>
                    );
                  })
                ) : (
                  <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>No credentials listed</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Profile details & scheduled meetings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Biography & Attributes */}
            <div className="glass-panel" style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', color: 'hsl(var(--text-primary))' }}>
                Profile Overview
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '6px' }}>
                    Gender
                  </h5>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{coach.gender || 'Not specified'}</p>
                </div>
                <div>
                  <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '6px' }}>
                    Location
                  </h5>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{coach.country || 'Not specified'}</p>
                </div>
                <div>
                  <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '6px' }}>
                    Timezone
                  </h5>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{coach.timezone || 'Not specified'}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '10px' }}>
                  Biography
                </h4>
                <p style={{ fontSize: '0.925rem', lineHeight: '1.6', color: 'hsl(var(--text-secondary))', whiteSpace: 'pre-line' }}>
                  {coach.bio || 'This user has not written a biography yet.'}
                </p>
              </div>
            </div>

            {/* Scheduled Meetings List */}
            <div className="glass-panel" style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', color: 'hsl(var(--text-primary))' }}>
                Upcoming Scheduled Sessions
              </h3>

              {coachMeetings.length === 0 ? (
                <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '24px 0' }}>
                  No upcoming peer coaching sessions scheduled for this coach.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {coachMeetings.map((ev: CalendarEvent) => {
                    const start = new Date(ev.start.dateTime);
                    const timeString = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateString = start.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
                    const safeMeetLink = sanitizeMeetLink(ev.meetLink);

                    return (
                      <div key={ev.id} className="glass-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', borderColor: 'var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{ev.summary}</h4>
                          <span className="badge badge-user" style={{ fontSize: '0.65rem' }}>Active Session</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                          {dateString} at {timeString}
                        </p>
                        {safeMeetLink && (
                          <div style={{ marginTop: '12px' }}>
                            <a
                              href={safeMeetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Video size={12} color="#34d399" />
                              Join Google Meet
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Inline styles for interactive table states */}
      <style>{`
        .hover-row {
          transition: background-color 0.2s ease;
        }
        .hover-row:hover {
          background-color: var(--panel-hover-bg) !important;
        }
        .admin-table td {
          vertical-align: middle;
        }
      `}</style>

      {/* Top statistics / information cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid hsl(var(--primary))' }}>
          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Registered Users
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px' }}>{users.length}</h2>
        </div>

        <div className="glass-panel" style={{
          padding: '20px',
          borderLeft: pendingCount > 0 ? '4px solid hsl(var(--warning))' : '4px solid var(--border-light)'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 600, textTransform: 'uppercase' }}>
            Pending Review
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', color: pendingCount > 0 ? 'hsl(var(--warning))' : 'hsl(var(--text-primary))' }}>
            {pendingCount}
          </h2>
        </div>
      </div>

      {/* Control panel (search and tabs) */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['all', USER_STATUS.INACTIVE, USER_ROLE.USER, USER_ROLE.ADMIN] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => handleTabChange(filter)}
                className={`btn ${roleFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px' }}
              >
                {filter === USER_STATUS.INACTIVE ? 'Pending Approval' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                {filter === USER_STATUS.INACTIVE && pendingCount > 0 && (
                  <span style={{
                    background: 'hsl(var(--warning))',
                    color: 'black',
                    borderRadius: '50%',
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    marginLeft: '4px'
                  }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-muted))'
            }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '38px', height: '36px', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={{ padding: '8px' }}>
        {loading ? (
          <p style={{ padding: '24px', color: 'hsl(var(--text-muted))', textAlign: 'center' }}>Loading user profiles...</p>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <Info size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p>No matching users found.</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Coach Details</th>
                  <th>Credentials</th>
                  <th>System Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const currentRole = drafts[u.userId]?.userRole || getUserRole(u);
                  const currentStatus = drafts[u.userId]?.userStatus || getUserStatus(u);
                  const currentQuals: Qualification[] = (drafts[u.userId]?.qualifications || u.qualifications || []) as Qualification[];

                  return (
                    <tr
                      key={u.userId}
                      onClick={() => setSelectedCoachUid(u.userId)}
                      style={{ cursor: 'pointer' }}
                      className="hover-row"
                    >
                      {/* Coach Avatar, Name & Email */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={sanitizeImageUrl(u.photoURL)}
                            alt={formatDisplayName(u) || 'Coach'}
                            style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--border-light)' }}
                          />
                          <div>
                            <p style={{ fontWeight: 700, fontSize: '0.925rem' }}>{formatDisplayName(u) || 'No Name'}</p>
                            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Credentials Column */}
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                          {QUALIFICATION_OPTIONS.map((q) => {
                            const isActive = currentQuals.includes(q);
                            const shortCode = getShortCredential(q);
                            const cls = getCredentialBadgeClass(q);

                            const toggleQual = () => {
                              const nextQuals = isActive
                                ? currentQuals.filter(item => item !== q)
                                : [...currentQuals, q];
                              setDrafts(prev => ({
                                ...prev,
                                [u.userId]: {
                                  ...prev[u.userId],
                                  qualifications: nextQuals
                                }
                              }));
                            };

                            return (
                              <button
                                key={q}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleQual();
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  padding: '4px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  readOnly
                                  style={{
                                    accentColor: 'hsl(var(--primary))',
                                    cursor: 'pointer',
                                    width: '14px',
                                    height: '14px'
                                  }}
                                />
                                <span className={`badge ${cls}`} style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '4px' }}>
                                  {shortCode}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* System Role Column */}
                      <td>
                        <select
                          value={currentRole}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const newRole = e.target.value as UserRole;
                            setDrafts(prev => ({
                              ...prev,
                              [u.userId]: {
                                ...prev[u.userId],
                                userRole: newRole
                              }
                            }));
                          }}
                          className="input-field"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.825rem',
                            width: '100px',
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            background: 'var(--input-bg)'
                          }}
                        >
                          <option value={USER_ROLE.USER}>User</option>
                          <option value={USER_ROLE.ADMIN}>Admin</option>
                        </select>
                      </td>

                      {/* Status Column */}
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={currentStatus === USER_STATUS.ACTIVE}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const newStatus = e.target.checked ? USER_STATUS.ACTIVE : USER_STATUS.INACTIVE;
                              setDrafts(prev => ({
                                ...prev,
                                [u.userId]: {
                                  ...prev[u.userId],
                                  userStatus: newStatus
                                }
                              }));
                            }}
                            style={{
                              accentColor: 'hsl(var(--primary))',
                              width: '16px',
                              height: '16px',
                              cursor: 'pointer'
                            }}
                          />
                          <span className={`badge ${currentStatus === USER_STATUS.ACTIVE ? 'badge-user' : 'badge-pending'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                            {currentStatus === USER_STATUS.ACTIVE ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      </td>

                      {/* Quick Approve Action Column */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerApprove(u.userId);
                          }}
                          disabled={savingId !== null}
                          className="btn btn-primary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            height: '34px',
                            gap: '4px',
                            background: '#10b981',
                            color: '#ffffff',
                            fontWeight: 700
                          }}
                        >
                          <UserCheck size={12} />
                          Approve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom React Approval Modal */}
      {approvalModalData && (
        <div className="modal-overlay" style={{ pointerEvents: 'auto' }} onClick={() => setApprovalModalData(null)}>
          <div className="glass-panel modal-content" style={{ padding: '32px', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.3)' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setApprovalModalData(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                color: 'hsl(var(--text-muted))',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>Review changes</h3>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
              <strong>{approvalModalData.userName}</strong>:
            </p>

            {approvalModalData.changes.length === 0 ? (
              <div className="glass-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>No modifications detected in draft.</p>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px' }}>
                <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {approvalModalData.changes.map((chg, idx) => (
                    <li key={idx} style={{ color: 'hsl(var(--text-secondary))' }}>
                      {chg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setApprovalModalData(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { uid, roleToSave, statusToSave, qualificationsToSave } = approvalModalData;
                  setApprovalModalData(null);
                  await executeApproval(uid, roleToSave, statusToSave, qualificationsToSave);
                }}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
