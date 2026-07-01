import React, { useState, useEffect, useCallback } from 'react';
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
import { ReviewChangesModal } from './modals/ReviewChangesModal';
import { useUnsavedChanges } from '../context/UnsavedChangesContext';
import { sanitizeImageUrl, sanitizeMeetLink } from '../utils/url';
import {
  Search,
  UserCheck,
  Info,
  Video,
  ExternalLink
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { CalendarEvent } from '../services/googleCalendar';
import { getCredentialBadgeClass } from '../utils/credentials';
import { type Qualification, type UserRole, type UserStatus, USER_ROLE, USER_STATUS, BOOKING_STATUS, EVENT_TYPE, COLLECTIONS, ICF_DIRECTORY_URL } from '../config';
import { getDisplayCredentials, mapIcfLevelToQualification } from '../utils/credentialHelpers';
import { verifyIcfCredential } from '../services/icfService';
import { updateVerifiedCredentials } from '../services/firebaseService';

interface UserManagementProps {
  initialFilter?: 'all' | UserStatus | UserRole;
  setInitialFilter?: (filter: 'all' | UserStatus | UserRole) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ initialFilter = 'all', setInitialFilter }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserStatus | UserRole>(initialFilter);
  const [selectedCoachUid, setSelectedCoachUid] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyErrorId, setVerifyErrorId] = useState<string | null>(null);
  const [approvalModalData, setApprovalModalData] = useState<{
    uid: string;
    userName: string;
    changes: string[];
    roleToSave: UserRole;
    statusToSave: UserStatus;
  } | null>(null);
  const [coachMeetings, setCoachMeetings] = useState<CalendarEvent[]>([]);

  // Mirror parent-driven filter changes using the adjust-during-render pattern
  // (no effect, no setTimeout hack).
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
        // Query by stable userId, not email.
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

              const coachFirstName = coachProfile ? (coachProfile.firstName || (formatDisplayName(coachProfile) || 'Coach').split(' ')[0]) : 'Coach';
              const clientFirstName = clientProfile ? (clientProfile.firstName || (formatDisplayName(clientProfile) || 'Peer').split(' ')[0]) : 'Peer';

              meetings.push({
                id: data.bookingId,
                summary: `${coachFirstName} / ${clientFirstName} - Peer Coaching Session`,
                description: `Topic: ${data.topic}`,
                start: { dateTime: startStr },
                end: { dateTime: endStr },
                meetLink: data.googleMeetLink,
                type: EVENT_TYPE.PEER_COACHING,
                attendees: [
                  { email: coachProfile?.email || '', displayName: coachProfile ? formatDisplayName(coachProfile) : '' },
                  { email: clientProfile?.email || '', displayName: clientProfile ? formatDisplayName(clientProfile) : '' }
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



  // Canonical role/status resolution lives in the service layer.
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
        statusToSave: getUserStatus(userToSave)
      });
      return;
    }

    const roleToSave = draft.userRole || getUserRole(userToSave);
    const statusToSave = draft.userStatus || getUserStatus(userToSave);

    const changes: string[] = [];
    if (draft.userRole && draft.userRole !== getUserRole(userToSave)) {
      changes.push(`System Role: "${getUserRole(userToSave)}" → "${draft.userRole}"`);
    }
    if (draft.userStatus && draft.userStatus !== getUserStatus(userToSave)) {
      changes.push(`Status: "${getUserStatus(userToSave)}" → "${draft.userStatus}"`);
    }

    setApprovalModalData({
      uid,
      userName: formatDisplayName(userToSave),
      changes,
      roleToSave,
      statusToSave
    });
  };

  const executeApproval = useCallback(async (
    uid: string,
    roleToSave: UserRole,
    statusToSave: UserStatus
  ) => {
    setSavingId(uid);
    try {
      const userToSave = users.find(u => u.userId === uid);
      const originalStatus = userToSave ? getUserStatus(userToSave) : undefined;
      const originalRole = userToSave ? getUserRole(userToSave) : undefined;

      await updateProfile(uid, {
        userRole: roleToSave,
        userStatus: statusToSave
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
  }, [users]);

  const { setPageDirtyState } = useUnsavedChanges();

  useEffect(() => {
    const draftKeys = Object.keys(drafts);
    const isDirty = draftKeys.length > 0;
    const newChanges: string[] = [];
    
    draftKeys.forEach(uid => {
      const userToSave = users.find(u => u.userId === uid);
      if (userToSave) {
        newChanges.push(`Unsaved permissions for: ${formatDisplayName(userToSave)}`);
      }
    });

    const saveHandler = async (): Promise<boolean> => {
      try {
        for (const uid of draftKeys) {
          const userToSave = users.find(u => u.userId === uid);
          if (!userToSave) continue;
          
          const draft = drafts[uid];
          const roleToSave = draft.userRole || getUserRole(userToSave);
          const statusToSave = draft.userStatus || getUserStatus(userToSave);
          
          await executeApproval(uid, roleToSave, statusToSave);
        }
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    };

    setPageDirtyState(isDirty, newChanges, saveHandler);
  }, [drafts, users, setPageDirtyState, executeApproval]);

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
  // the previous unconditional setState-in-render.
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
                {(() => {
                  const validCreds = getDisplayCredentials(coach.icfCredentials);
                  if (validCreds.length > 0) {
                    return validCreds.map((validCred, idx) => {
                      const qual = mapIcfLevelToQualification(validCred.level) || validCred.level;
                      return (
                        <span key={idx} className={`badge ${getCredentialBadgeClass(qual as Qualification)}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                          {qual as string}
                        </span>
                      );
                    });
                  }
                  return <span className="badge" style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--panel-bg)', color: 'hsl(var(--text-muted))', border: '1px solid var(--border-light)' }}>Trainee Coach</span>;
                })()}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(() => {
                               const validCreds = getDisplayCredentials(u.icfCredentials);
                               if (validCreds.length > 0) {
                                 return validCreds.map((validCred, idx) => {
                                   const qual = mapIcfLevelToQualification(validCred.level) || validCred.level;
                                   return (
                                     <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                       <span className={`badge ${getCredentialBadgeClass(qual as Qualification)}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                                         {qual as string}
                                       </span>
                                       <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>
                                         Expires: {validCred.expiryDate.toDate().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                       </span>
                                     </div>
                                   );
                                 });
                               }
                               return <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Trainee Coach</span>;
                             })()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                             <button
                               onClick={async (e) => {
                                 e.stopPropagation();
                                 setVerifyingId(u.userId);
                                 setVerifyErrorId(null);
                                 try {
                                   const creds = await verifyIcfCredential(u.firstName, u.lastName);
                                   if (creds && creds.length > 0) {
                                     const newQuals = creds.map(c => mapIcfLevelToQualification(c.level)).filter(Boolean) as Qualification[];
                                     await updateVerifiedCredentials(u.userId, creds, newQuals);
                                   } else {
                                     setVerifyErrorId(u.userId);
                                   }
                                 } catch (err) {
                                   console.error('Verification error:', err);
                                   setVerifyErrorId(u.userId);
                                 } finally {
                                   setVerifyingId(null);
                                 }
                               }}
                               className="btn btn-secondary"
                               style={{ fontSize: '0.7rem', padding: '4px 8px', alignSelf: 'flex-start' }}
                               disabled={verifyingId === u.userId}
                             >
                               {verifyingId === u.userId ? 'Verifying...' : 'Verify with ICF Directory'}
                             </button>
                             <a 
                               href={ICF_DIRECTORY_URL.replace('{firstName}', encodeURIComponent(u.firstName || '')).replace('{lastName}', encodeURIComponent(u.lastName || ''))}
                               target="_blank" 
                               rel="noopener noreferrer"
                               onClick={(e) => e.stopPropagation()}
                               style={{ fontSize: '0.7rem', color: 'hsl(var(--primary))', textDecoration: 'none' }}
                             >
                               Search ICF Directory for {u.firstName} {u.lastName} <ExternalLink size={10} style={{ display: 'inline' }} />
                             </a>
                             {verifyErrorId === u.userId && (
                               <span style={{ fontSize: '0.7rem', color: 'hsl(var(--error))' }}>
                                 Error verifying credentials. Please contact admin.
                               </span>
                             )}
                          </div>
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
      {/* Custom React Approval Modal */}
      <ReviewChangesModal
        isOpen={!!approvalModalData}
        userName={approvalModalData?.userName || ''}
        changes={approvalModalData?.changes || []}
        onClose={() => setApprovalModalData(null)}
        onConfirm={async () => {
          if (!approvalModalData) return;
          const { uid, roleToSave, statusToSave } = approvalModalData;
          setApprovalModalData(null);
          await executeApproval(uid, roleToSave, statusToSave);
        }}
      />
    </div>
  );
};
