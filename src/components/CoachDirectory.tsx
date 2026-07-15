import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, MapPin, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getActiveCoaches, formatDisplayName } from '../services/profileService';
import { useNavigateToProfile } from '../context/UnsavedChangesContext';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { sanitizeImageUrl } from '../utils/url';
import { getCredentialBadgeClass, buildDisplayCredentials } from '../utils/credentials';
import { type Qualification, QUALIFICATION } from '../config';
import type { UserProfile } from '../services/types';

type SortField = 'name' | 'credential' | 'country';
type SortDirection = 'asc' | 'desc';

export const CoachDirectory: React.FC = () => {
  const navigateProfile = useNavigateToProfile();
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [credentialFilter, setCredentialFilter] = useState<'all' | 'Trainee' | 'ACC' | 'PCC' | 'MCC'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fetchCoaches = useCallback(async () => {
    setLoading(true);
    try {
      const activeList = await getActiveCoaches();
      setCoaches(activeList);
    } catch (err) {
      console.error('Error fetching active coaches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCoaches();
    });
  }, [fetchCoaches]);

  useFocusRefresh(fetchCoaches);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCoaches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = coaches.filter(coach => {
      // 1. Search Query Filter (Prefix matching on first/last or full name)
      const firstName = (coach.firstName || '').toLowerCase();
      const lastName = (coach.lastName || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const matchesSearch = !query ||
        fullName.startsWith(query) ||
        firstName.startsWith(query) ||
        lastName.startsWith(query);

      if (!matchesSearch) return false;

      // 2. Credential Filter
      if (credentialFilter === 'Trainee') {
        return !coach.icf_mcc && !coach.icf_pcc && !coach.icf_acc;
      }
      if (credentialFilter === 'ACC') {
        return !!coach.icf_acc;
      }
      if (credentialFilter === 'PCC') {
        return !!coach.icf_pcc;
      }
      if (credentialFilter === 'MCC') {
        return !!coach.icf_mcc;
      }

      return true; // 'all'
    });

    // 3. Sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
        const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'credential') {
        const getRank = (c: UserProfile) => {
          if (c.icf_mcc) return 4;
          if (c.icf_pcc) return 3;
          if (c.icf_acc) return 2;
          return 1; // Trainee / Uncertified
        };
        comparison = getRank(a) - getRank(b);
      } else if (sortField === 'country') {
        const countryA = (a.country || 'Remote').toLowerCase();
        const countryB = (b.country || 'Remote').toLowerCase();
        comparison = countryA.localeCompare(countryB);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [coaches, searchQuery, credentialFilter, sortField, sortDirection]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} style={{ marginLeft: '6px', opacity: 0.5 }} />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp size={14} style={{ marginLeft: '6px', color: 'hsl(var(--primary))' }} /> : 
      <ArrowDown size={14} style={{ marginLeft: '6px', color: 'hsl(var(--primary))' }} />;
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Search and Filters */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Search bar */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              <Search size={18} style={{ color: 'hsl(var(--text-muted))' }} />
            </span>
            <input
              type="text"
              placeholder="Search coaches by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{
                width: '100%',
                paddingLeft: '40px',
                height: '42px',
                fontSize: '0.9rem',
                borderRadius: '10px'
              }}
            />
          </div>

          {/* Credential Filter Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, marginRight: '4px' }}>
              Credential Tier:
            </span>
            {(['all', 'Trainee', 'ACC', 'PCC', 'MCC'] as const).map((tier) => {
              const isActive = credentialFilter === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setCredentialFilter(tier)}
                  className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.75rem',
                    borderRadius: '16px',
                    height: '28px',
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}
                >
                  {tier === 'all' ? 'All' : tier}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Table view */}
      {loading ? (
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '64px 32px' }}>
          <div className="animate-spin" style={{
            width: '24px',
            height: '24px',
            border: '2.5px solid hsl(var(--primary))',
            borderTopColor: 'transparent',
            borderRadius: '50%'
          }} />
        </div>
      ) : sortedCoaches.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', borderRadius: '16px' }}>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>No coaches match your filters / search.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    Coach {renderSortIcon('name')}
                  </div>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('credential')}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    Credential {renderSortIcon('credential')}
                  </div>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('country')}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    Country {renderSortIcon('country')}
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedCoaches.map((coach) => {
                const borderCol = coach.icf_mcc ? 'hsl(var(--mcc-platinum))' : 
                                  coach.icf_pcc ? 'hsl(var(--pcc-silver))' : 
                                  coach.icf_acc ? 'hsl(var(--acc-gold))' : 
                                  'var(--border-light)';
                const displayCredentials = buildDisplayCredentials(coach);

                return (
                  <tr key={coach.userId} className="hover-row">
                    {/* Coach details */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          type="button"
                          className="mini-coach-avatar-button"
                          tabIndex={-1}
                          aria-hidden="true"
                          onClick={() => navigateProfile(coach.userId)}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            cursor: 'pointer'
                          }}
                        >
                          <img
                            src={sanitizeImageUrl(coach.photoURL)}
                            alt=""
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              border: `1.5px solid ${borderCol}`
                            }}
                          />
                        </button>
                        <div>
                          <button
                            type="button"
                            className="mini-coach-name"
                            onClick={() => navigateProfile(coach.userId)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              fontFamily: 'inherit',
                              color: 'inherit',
                              fontSize: '0.925rem',
                              fontWeight: 700,
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            {formatDisplayName(coach)}
                          </button>
                          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', margin: 0 }}>
                            {coach.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Credentials column */}
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {displayCredentials.length > 0 ? (
                          displayCredentials.map((qual, idx) => (
                            <span
                              key={idx}
                              className={`badge ${getCredentialBadgeClass(qual as Qualification)}`}
                              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                            >
                              {qual}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                            {QUALIFICATION.UNCERTIFIED}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Country column */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <MapPin size={14} color="hsl(var(--primary))" />
                        <span>{coach.country || 'Remote'}</span>
                      </div>
                    </td>

                    {/* Action column */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => navigateProfile(coach.userId)}
                        className="btn btn-primary"
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.8rem',
                          borderRadius: '8px',
                          height: '32px',
                          fontWeight: 700
                        }}
                      >
                        Book Session
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
  );
};
