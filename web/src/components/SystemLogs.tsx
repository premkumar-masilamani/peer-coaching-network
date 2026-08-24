/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { getLogsPage, getSystemLogsByUser, type SystemLogEntry } from '../services/adminService';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Terminal,
  TriangleAlert,
  User,
  Eye,
  EyeOff
} from 'lucide-react';

import { type LogSeverity, LOG_SEVERITY } from '../config';

// LogSeverity is imported from config — 'error' | 'warn' | 'info'

type SystemLog = SystemLogEntry;

const SEVERITY_OPTIONS: { value: LogSeverity; label: string }[] = [
  { value: LOG_SEVERITY.ERROR, label: 'Errors' },
  { value: LOG_SEVERITY.WARN,  label: 'Warnings' },
];

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  // Multi-select: empty array means "show all"
  const [selectedSeverities, setSelectedSeverities] = useState<LogSeverity[]>([]);
  
  // Pagination State
  const [pageIndex, setPageIndex] = useState(0);
  const pageCursorsRef = useRef<(any | null)[]>([null]);
  const [hasNext, setHasNext] = useState(false);
  
  // Row Expansion & Trace State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [userLogsCache, setUserLogsCache] = useState<Record<string, SystemLogEntry[]>>({});
  const [loadingUserLogs, setLoadingUserLogs] = useState<Record<string, boolean>>({});

  // Toggle a severity in/out of the selected set
  const handleSeverityToggle = (sev: LogSeverity) => {
    setSelectedSeverities(prev => {
      const next = prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev];
      return next;
    });
    setPageIndex(0);
    pageCursorsRef.current = [null];
    setExpandedLogId(null);
    setLoading(true);
  };

  const handleNextPage = () => {
    setPageIndex(prev => prev + 1);
    setLoading(true);
  };

  const handlePrevPage = () => {
    setPageIndex(prev => Math.max(0, prev - 1));
    setLoading(true);
  };

  const handleToggleExpand = async (log: SystemLog) => {
    const nextExpandedId = expandedLogId === log.id ? null : log.id;
    setExpandedLogId(nextExpandedId);

    if (nextExpandedId && log.userId && !userLogsCache[log.userId] && !loadingUserLogs[log.userId]) {
      setLoadingUserLogs(prev => ({ ...prev, [log.userId!]: true }));
      try {
        const userLogs = await getSystemLogsByUser(log.userId, 20);
        setUserLogsCache(prev => ({ ...prev, [log.userId!]: userLogs }));
      } catch (err) {
        console.error('Error fetching user activity logs:', err);
      } finally {
        setLoadingUserLogs(prev => ({ ...prev, [log.userId!]: false }));
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Service owns the database access and pagination look-ahead; the cursor
        // it returns is opaque and stored for the next page.
        const { logs: fetchedLogs, nextCursor, hasMore } = await getLogsPage({
          severities: selectedSeverities,
          pageCursor: pageCursorsRef.current[pageIndex],
        });
        if (cancelled) return;

        if (hasMore && nextCursor) {
          pageCursorsRef.current[pageIndex + 1] = nextCursor;
        }

        setHasNext(hasMore);
        setLogs(fetchedLogs);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading system logs:', error);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pageIndex, selectedSeverities]);



  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Pending...';
    // Handle Firestore Timestamp object
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  };

  const getSeverityBadgeStyle = (type: LogSeverity) => {
    switch (type) {
      case LOG_SEVERITY.ERROR:
        return {
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          icon: <AlertCircle size={14} style={{ marginRight: '6px' }} />
        };
      case LOG_SEVERITY.WARN:
      default:
        return {
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          icon: <TriangleAlert size={14} style={{ marginRight: '6px' }} />
        };
    }
  };

  const getSeverityChipStyle = (sev: LogSeverity, active: boolean) => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 14px',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: 600,
      fontFamily: 'inherit',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      userSelect: 'none',
      border: '1px solid transparent',
    };

    if (!active) {
      return {
        ...base,
        background: 'var(--bg-surface-elevated)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-light)',
      };
    }

    switch (sev) {
      case LOG_SEVERITY.ERROR:
        return { ...base, background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' };
      case LOG_SEVERITY.WARN:
      default:
        return { ...base, background: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' };
    }
  };

  const severityChipIcons: Record<LogSeverity, React.ReactNode> = {
    [LOG_SEVERITY.ERROR]: <AlertCircle size={13} />,
    [LOG_SEVERITY.WARN]:  <TriangleAlert size={13} />,
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Header and Filter Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={24} color="hsl(var(--primary))" />
            System Logs
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Monitor system events and exceptions.
          </p>
        </div>

        {/* Multi-select Severity Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Filter Severity
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* "All" chip — active when nothing else is selected */}
            <button
              type="button"
              aria-pressed={selectedSeverities.length === 0}
              onClick={() => {
                setSelectedSeverities([]);
                setPageIndex(0);
                pageCursorsRef.current = [null];
                setExpandedLogId(null);
                setLoading(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                userSelect: 'none',
                background: selectedSeverities.length === 0
                  ? 'hsl(var(--primary) / 0.18)'
                  : 'var(--bg-surface-elevated)',
                color: selectedSeverities.length === 0
                  ? 'hsl(var(--primary))'
                  : 'var(--text-secondary)',
                border: selectedSeverities.length === 0
                  ? '1px solid hsl(var(--primary) / 0.4)'
                  : '1px solid var(--border-light)',
              }}
            >
              All
            </button>

            {SEVERITY_OPTIONS.map(({ value, label }) => {
              const active = selectedSeverities.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSeverityToggle(value)}
                  style={getSeverityChipStyle(value, active)}
                >
                  {severityChipIcons[value]}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel" style={{ padding: '8px', marginBottom: '20px' }}>
        {loading && logs.length === 0 ? (
          <p style={{ padding: '48px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Loading system logs...
          </p>
        ) : logs.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Terminal size={40} style={{ marginBottom: '16px', opacity: 0.4 }} />
            <p style={{ fontSize: '1rem', margin: 0 }}>No logs found matching selection.</p>
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Timestamp</th>
                  <th style={{ width: '130px' }}>Severity</th>
                  <th>Event Type</th>
                  <th>User Email</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const badge = getSeverityBadgeStyle(log.type);
                  const isExpanded = expandedLogId === log.id;
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => handleToggleExpand(log)}
                        style={{ cursor: 'pointer' }}
                        className="hover-row"
                      >
                        {/* Timestamp */}
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                          {formatTimestamp(log.timestamp)}
                        </td>
                        
                        {/* Severity Badge */}
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            ...badge
                          }}>
                            {badge.icon}
                            {log.type}
                          </span>
                        </td>
                        
                        {/* Event Name */}
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.event}
                        </td>
                        
                        {/* User Email / ID */}
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {log.userEmail ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <User size={12} />
                              {log.userEmail}
                            </span>
                          ) : log.userId ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <User size={12} />
                              {log.userId}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>System / Guest</span>
                          )}
                        </td>
                        
                        {/* Actions Toggle */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(log);
                            }}
                            style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem' }}
                            title={isExpanded ? 'Hide Details' : 'View Details'}
                          >
                            {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Section */}
                      {isExpanded && (
                        <tr style={{ background: 'rgba(0, 0, 0, 0.15)' }}>
                          <td colSpan={5} style={{ padding: '20px 24px', borderBottom: '1px solid var(--table-border-1)' }}>
                            {log.userId ? (
                              loadingUserLogs[log.userId] ? (
                                <p style={{ margin: 0, padding: '12px', color: 'hsl(var(--text-muted))', textAlign: 'center' }}>
                                  Loading activity trace for user...
                                </p>
                              ) : (
                                <div>
                                  <div style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                                    Activity Trace for User: <span style={{ fontFamily: 'monospace', color: 'hsl(var(--primary))' }}>{log.userId}</span> {userLogsCache[log.userId] ? `(${userLogsCache[log.userId].length} events, newest first)` : ''}
                                  </div>
                                  <pre style={{
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-light)',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    color: 'hsl(var(--text-secondary))',
                                    overflowX: 'auto',
                                    margin: 0,
                                    fontFamily: 'monospace',
                                    maxHeight: '350px'
                                  }}>
                                    {JSON.stringify((userLogsCache[log.userId] || [log]).map((entry) => ({
                                      id: entry.id,
                                      type: entry.type,
                                      event: entry.event,
                                      userId: entry.userId,
                                      userEmail: entry.userEmail,
                                      errorMessage: entry.errorMessage,
                                      timestamp: entry.timestamp
                                    })), null, 2)}
                                  </pre>
                                </div>
                              )
                            ) : (
                              <div>
                                <div style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                                  System / Guest Event Details:
                                </div>
                                <pre style={{
                                  background: 'var(--bg-surface)',
                                  border: '1px solid var(--border-light)',
                                  padding: '16px',
                                  borderRadius: '8px',
                                  fontSize: '0.85rem',
                                  color: 'hsl(var(--text-secondary))',
                                  overflowX: 'auto',
                                  margin: 0,
                                  fontFamily: 'monospace',
                                  maxHeight: '350px'
                                }}>
                                  {JSON.stringify({
                                    id: log.id,
                                    type: log.type,
                                    event: log.event,
                                    userId: log.userId,
                                    userEmail: log.userEmail,
                                    errorMessage: log.errorMessage,
                                    timestamp: log.timestamp
                                  }, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {logs.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 24px',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          boxShadow: 'var(--glass-shadow)',
          backdropFilter: 'var(--glass-blur)'
        }}>
          {/* Newer Logs (Goes to newer logs) */}
          <button
            onClick={handlePrevPage}
            disabled={pageIndex === 0}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px' }}
          >
            <ChevronLeft size={16} />
            Newer Logs
          </button>
          
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Page {pageIndex + 1}
          </span>
          
          {/* Older Logs (Goes to older logs) */}
          <button
            onClick={handleNextPage}
            disabled={!hasNext}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px' }}
          >
            Older Logs
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
