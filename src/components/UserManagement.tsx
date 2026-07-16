import React, { useState, useEffect, useCallback, useRef } from 'react';
import { logAnalyticsEvent } from '../services/firebaseApp';
import {
  getUsersPage,
  getPendingUsers,
  getUserBookingStats,
  type CalendarEvent
} from '../services/adminService';
import {
  updateProfile,
  formatDisplayName,
  formatMemberSince,
  getEffectiveRole,
  getEffectiveStatus
} from '../services/profileService';
import type { UserProfile } from '../services/types';
import { ReviewChangesModal } from './modals/ReviewChangesModal';
import { useUnsavedChanges } from '../context/UnsavedChangesContext';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { sanitizeImageUrl, sanitizeMeetLink } from '../utils/url';
import {
  Search,
  UserCheck,
  Info,
  Video,
  ExternalLink
} from 'lucide-react';
import { getCredentialBadgeClass } from '../utils/credentials';
import { type Qualification, type UserRole, type UserStatus, USER_ROLE, USER_STATUS } from '../config';

interface UserManagementProps {
  initialFilter?: 'all' | UserStatus | UserRole;
  setInitialFilter?: (filter: 'all' | UserStatus | UserRole) => void;
}

// Roster page size. The first paint loads only this many user documents instead
// of the whole users collection; "Load more" appends further pages.
const USERS_PAGE_SIZE = 25;

export const UserManagement: React.FC<UserManagementProps> = ({ initialFilter = 'all', setInitialFilter }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  // Full pending (inactive) set, fetched independently of roster pagination so
  // the pending badge/count and the "Pending Approval" filter stay complete.
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Opaque cursor for the next page (a Firestore snapshot); null once exhausted.
  const nextCursorRef = useRef<unknown | null>(null);
  const [search, setSearch] = useState('');

  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  const [roleFilter, setRoleFilter] = useState<'all' | UserStatus | UserRole>(initialFilter);
  const [selectedCoachUid, setSelectedCoachUid] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [approvalModalData, setApprovalModalData] = useState<{
    uid: string;
    userName: string;
    changes: string[];
    roleToSave: UserRole;
    statusToSave: UserStatus;
    credentialsToSave?: {
      icf_acc?: boolean;
      icf_pcc?: boolean;
      icf_mcc?: boolean;
      icf_actc?: boolean;
    };
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
    let cancelled = false;

    const fetchMeetings = async () => {
      const coach = selectedCoachUid && usersRef.current ? usersRef.current.find(u => u.userId === selectedCoachUid) : undefined;
      if (!coach) {
        if (!cancelled) {
          setCoachMeetings([]);
        }
        return;
      }
      try {
        // Firestore access + enrichment live in the service layer; the component
        // only asks for this coach's sessions and renders them.
        const meetings = await getUserBookingStats(coach.userId);
        if (!cancelled) {
          setCoachMeetings(meetings);
        }
      } catch (err) {
        console.error('Error fetching coach meetings:', err);
      }
    };

    fetchMeetings();

    return () => {
      cancelled = true;
    };
  }, [selectedCoachUid]);

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
      icf_acc?: boolean;
      icf_pcc?: boolean;
      icf_mcc?: boolean;
      icf_actc?: boolean;
    }
  >>({});

  // Load the first page of user records (bounded read), resetting the cursor.
  // Refreshed on window focus in lieu of a live subscription. Note: because the
  // roster is now paginated, the search box filters over loaded pages only —
  // load more to widen the searchable set.
  const loadUsers = useCallback(async () => {
    try {
      const [{ users: page, nextCursor, hasMore: more }, pending] = await Promise.all([
        getUsersPage({ pageSize: USERS_PAGE_SIZE }),
        getPendingUsers(),
      ]);
      setUsers(page);
      nextCursorRef.current = nextCursor;
      setHasMore(more);
      setPendingUsers(pending);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Append the next page of user records to the currently-loaded set.
  const loadMoreUsers = useCallback(async () => {
    if (!nextCursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { users: page, nextCursor, hasMore: more } = await getUsersPage({
        pageSize: USERS_PAGE_SIZE,
        pageCursor: nextCursorRef.current,
      });
      setUsers(prev => [...prev, ...page]);
      nextCursorRef.current = nextCursor;
      setHasMore(more);
    } catch (e) {
      console.error('Error loading more users:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  useFocusRefresh(loadUsers);

  useEffect(() => {
    (async () => {
      await loadUsers();
    })();
  }, [loadUsers]);



  // Canonical role/status resolution lives in the service layer.
  const getUserRole = (u: UserProfile): UserRole => getEffectiveRole(u);
  const getUserStatus = (u: UserProfile): UserStatus => getEffectiveStatus(u);

  const triggerApprove = (uid: string) => {
    const userToSave = users.find(u => u.userId === uid);
    if (!userToSave) return;

    const draft = drafts[uid];
    const hasRoleChange = draft?.userRole !== undefined && draft.userRole !== getUserRole(userToSave);
    const hasStatusChange = draft?.userStatus !== undefined && draft.userStatus !== getUserStatus(userToSave);
    const hasAccChange = draft?.icf_acc !== undefined && draft.icf_acc !== (userToSave.icf_acc || false);
    const hasPccChange = draft?.icf_pcc !== undefined && draft.icf_pcc !== (userToSave.icf_pcc || false);
    const hasMccChange = draft?.icf_mcc !== undefined && draft.icf_mcc !== (userToSave.icf_mcc || false);
    const hasActcChange = draft?.icf_actc !== undefined && draft.icf_actc !== (userToSave.icf_actc || false);

    const hasChanges = hasRoleChange || hasStatusChange || hasAccChange || hasPccChange || hasMccChange || hasActcChange;

    if (!draft || !hasChanges) {
      setApprovalModalData({
        uid,
        userName: formatDisplayName(userToSave),
        changes: [],
        roleToSave: getUserRole(userToSave),
        statusToSave: getUserStatus(userToSave),
        credentialsToSave: {
          icf_acc: Boolean(userToSave.icf_acc),
          icf_pcc: Boolean(userToSave.icf_pcc),
          icf_mcc: Boolean(userToSave.icf_mcc),
          icf_actc: Boolean(userToSave.icf_actc)
        }
      });
      return;
    }

    const roleToSave = draft.userRole || getUserRole(userToSave);
    const statusToSave = draft.userStatus || getUserStatus(userToSave);
    const credentialsToSave = {
      icf_acc: draft.icf_acc !== undefined ? draft.icf_acc : Boolean(userToSave.icf_acc),
      icf_pcc: draft.icf_pcc !== undefined ? draft.icf_pcc : Boolean(userToSave.icf_pcc),
      icf_mcc: draft.icf_mcc !== undefined ? draft.icf_mcc : Boolean(userToSave.icf_mcc),
      icf_actc: draft.icf_actc !== undefined ? draft.icf_actc : Boolean(userToSave.icf_actc)
    };

    const changes: string[] = [];
    if (hasRoleChange) {
      changes.push(`System Role: "${getUserRole(userToSave)}" → "${draft.userRole}"`);
    }
    if (hasStatusChange) {
      changes.push(`Status: "${getUserStatus(userToSave)}" → "${draft.userStatus}"`);
    }
    if (hasAccChange) {
      changes.push(`ACC Badge: "${userToSave.icf_acc ? 'Verified' : 'Unverified'}" → "${draft.icf_acc ? 'Verified' : 'Unverified'}"`);
    }
    if (hasPccChange) {
      changes.push(`PCC Badge: "${userToSave.icf_pcc ? 'Verified' : 'Unverified'}" → "${draft.icf_pcc ? 'Verified' : 'Unverified'}"`);
    }
    if (hasMccChange) {
      changes.push(`MCC Badge: "${userToSave.icf_mcc ? 'Verified' : 'Unverified'}" → "${draft.icf_mcc ? 'Verified' : 'Unverified'}"`);
    }
    if (hasActcChange) {
      changes.push(`ACTC Badge: "${userToSave.icf_actc ? 'Verified' : 'Unverified'}" → "${draft.icf_actc ? 'Verified' : 'Unverified'}"`);
    }

    setApprovalModalData({
      uid,
      userName: formatDisplayName(userToSave),
      changes,
      roleToSave,
      statusToSave,
      credentialsToSave
    });
  };

  const executeApproval = useCallback(async (
    uid: string,
    roleToSave: UserRole,
    statusToSave: UserStatus,
    credentialsToSave?: {
      icf_acc?: boolean;
      icf_pcc?: boolean;
      icf_mcc?: boolean;
      icf_actc?: boolean;
    }
  ) => {
    setSavingId(uid);
    try {
      const userToSave = users.find(u => u.userId === uid);
      const originalStatus = userToSave ? getUserStatus(userToSave) : undefined;
      const originalRole = userToSave ? getUserRole(userToSave) : undefined;

      const profileUpdates: Partial<UserProfile> = {
        userRole: roleToSave,
        userStatus: statusToSave
      };

      if (credentialsToSave) {
        profileUpdates.icf_acc = credentialsToSave.icf_acc;
        profileUpdates.icf_pcc = credentialsToSave.icf_pcc;
        profileUpdates.icf_mcc = credentialsToSave.icf_mcc;
        profileUpdates.icf_actc = credentialsToSave.icf_actc;
      }

      await updateProfile(uid, profileUpdates);

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

      // Patch the mutated record in place so the change reflects immediately
      setUsers(prev =>
        prev.map(u =>
          u.userId === uid
            ? {
                ...u,
                userRole: roleToSave,
                userStatus: statusToSave,
                ...(credentialsToSave || {})
              }
            : u
        )
      );
      // Keep the pending set accurate: a user activated leaves it, a user
      // deactivated joins it. Refetch the (small) pending list to stay in sync.
      try {
        setPendingUsers(await getPendingUsers());
      } catch (pendingErr) {
        console.error('Error refreshing pending users:', pendingErr);
      }
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
          const credentialsToSave = {
            icf_acc: draft.icf_acc !== undefined ? draft.icf_acc : !!userToSave.icf_acc,
            icf_pcc: draft.icf_pcc !== undefined ? draft.icf_pcc : !!userToSave.icf_pcc,
            icf_mcc: draft.icf_mcc !== undefined ? draft.icf_mcc : !!userToSave.icf_mcc,
            icf_actc: draft.icf_actc !== undefined ? draft.icf_actc : !!userToSave.icf_actc
          };

          await executeApproval(uid, roleToSave, statusToSave, credentialsToSave);
        }
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    };

    setPageDirtyState(isDirty, newChanges, saveHandler);

    return () => {
      setPageDirtyState(false, [], async () => true);
    };
  }, [drafts, users, setPageDirtyState, executeApproval]);

  // Filter logic
  // The "Pending Approval" filter draws from the complete pending set (not the
  // paginated roster) so no pending user is hidden on an unloaded page. Other
  // filters operate over the loaded roster pages.
  const isPendingView = roleFilter === USER_STATUS.INACTIVE;
  const listSource = isPendingView ? pendingUsers : users;

  const filteredUsers = listSource.filter((u) => {
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

  // Accurate count of pending users, independent of roster pagination.
  const pendingCount = pendingUsers.length;

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(['ICF ACC', 'ICF PCC', 'ICF MCC', 'ICF ACTC'] as Qualification[]).map((qual) => {
                  const key = qual === 'ICF ACC' ? 'icf_acc' :
                              qual === 'ICF PCC' ? 'icf_pcc' :
                              qual === 'ICF MCC' ? 'icf_mcc' :
                              'icf_actc';
                  const hasQual = drafts[coach.userId]?.[key] !== undefined ? drafts[coach.userId][key] : !!coach[key];
                  return (
                    <label key={qual} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={hasQual}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDrafts(prev => ({
                            ...prev,
                            [coach.userId]: {
                              ...prev[coach.userId],
                              [key]: checked
                            }
                          }));
                        }}
                        style={{ accentColor: 'hsl(var(--primary))', width: '14px', height: '14px' }}
                      />
                      <span className={`badge ${getCredentialBadgeClass(qual)}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                        {qual}
                      </span>
                    </label>
                  );
                })}
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

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: '10px' }}>
                  Coaching Credentials
                </h4>
                <p style={{ fontSize: '0.925rem', lineHeight: '1.6', color: 'hsl(var(--text-secondary))', whiteSpace: 'pre-line' }}>
                  {coach.credentialDetails || 'No coaching credentials submitted.'}
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
                        {safeMeetLink ? (
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
                        ) : (
                          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                            <Video size={12} />
                            <span>Google Meet link pending...</span>
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
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stopPropagation guard so toggling credentials doesn't trigger row click/drawer opening; keyboard navigation is unaffected as interactive checkboxes are natively focusable and triggerable via spacebar */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}
                        >
                          {([
                            { key: 'icf_acc', label: 'ACC' },
                            { key: 'icf_pcc', label: 'PCC' },
                            { key: 'icf_mcc', label: 'MCC' },
                            { key: 'icf_actc', label: 'ACTC' }
                          ] as const).map(({ key, label }) => {
                            const isChecked = drafts[u.userId]?.[key] !== undefined ? drafts[u.userId][key] : !!u[key];
                            return (
                              <label
                                key={key}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  userSelect: 'none'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setDrafts(prev => ({
                                      ...prev,
                                      [u.userId]: {
                                        ...prev[u.userId],
                                        [key]: checked
                                      }
                                    }));
                                  }}
                                  style={{ accentColor: 'hsl(var(--primary))', width: '14px', height: '14px' }}
                                />
                                {label}
                              </label>
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
                        {/* Same guard. Keyboard activation is handled by the
                            wrapped checkbox, which this label is associated with. */}
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
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

        {!loading && !isPendingView && hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadMoreUsers}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more users'}
            </button>
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
          const { uid, roleToSave, statusToSave, credentialsToSave } = approvalModalData;
          setApprovalModalData(null);
          await executeApproval(uid, roleToSave, statusToSave, credentialsToSave);
        }}
      />
    </div>
  );
};
