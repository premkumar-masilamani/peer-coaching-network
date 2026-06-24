/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebaseService';
import { 
  collection, 
  query, 
  orderBy, 
  where, 
  limit, 
  startAfter, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  Terminal, 
  TriangleAlert, 
  User, 
  Copy, 
  Check, 
  Eye, 
  EyeOff 
} from 'lucide-react';

import { type LogSeverity, LOG_SEVERITY, COLLECTIONS } from '../config';

// LogSeverity is imported from config — 'error' | 'warn' | 'info'

interface SystemLog {
  id: string;
  type: LogSeverity;
  event: string;
  userId: string | null;
  details: Record<string, any>;
  timestamp: any;
  expireAt: any;
  doc: any; // Storing the document snapshot for pagination
}

const SEVERITY_OPTIONS: { value: LogSeverity; label: string }[] = [
  { value: LOG_SEVERITY.ERROR, label: 'Errors' },
  { value: LOG_SEVERITY.WARN,  label: 'Warnings' },
  { value: LOG_SEVERITY.INFO,  label: 'Info' },
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
  
  // Row Expansion State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!db) return;

    let q = query(
      collection(db, COLLECTIONS.SYSTEM_LOGS),
      orderBy('timestamp', 'desc')
    );

    if (selectedSeverities.length === 1) {
      // Exact match is more efficient for a single value
      q = query(q, where('type', '==', selectedSeverities[0]));
    } else if (selectedSeverities.length === 2) {
      // Firestore `in` query supports up to 30 values
      q = query(q, where('type', 'in', selectedSeverities));
    }
    // If 0 or 3 selected — show all (no where clause needed)

    const cursor = pageCursorsRef.current[pageIndex];
    if (cursor) {
      q = query(q, startAfter(cursor));
    }

    // Request 101 docs to check if there is a next page
    q = query(q, limit(101));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs: SystemLog[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedLogs.push({
            id: docSnap.id,
            type: data.type,
            event: data.event,
            userId: data.userId,
            details: data.details || {},
            timestamp: data.timestamp,
            expireAt: data.expireAt,
            doc: docSnap
          } as SystemLog);
        });

        const hasMore = fetchedLogs.length > 100;
        if (hasMore) {
          fetchedLogs.pop(); // Remove the 101st item
          const nextCursor = fetchedLogs[fetchedLogs.length - 1].doc;
          pageCursorsRef.current[pageIndex + 1] = nextCursor;
        }
        
        setHasNext(hasMore);
        setLogs(fetchedLogs);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to system logs:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [pageIndex, selectedSeverities]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
        return {
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          icon: <TriangleAlert size={14} style={{ marginRight: '6px' }} />
        };
      case LOG_SEVERITY.INFO:
      default:
        return {
          background: 'rgba(13, 148, 136, 0.12)',
          color: '#2dd4bf',
          border: '1px solid rgba(13, 148, 136, 0.2)',
          icon: <Info size={14} style={{ marginRight: '6px' }} />
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
        return { ...base, background: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' };
      case LOG_SEVERITY.INFO:
      default:
        return { ...base, background: 'rgba(13, 148, 136, 0.18)', color: '#2dd4bf', border: '1px solid rgba(13, 148, 136, 0.4)' };
    }
  };

  const severityChipIcons: Record<LogSeverity, React.ReactNode> = {
    [LOG_SEVERITY.ERROR]: <AlertCircle size={13} />,
    [LOG_SEVERITY.WARN]:  <TriangleAlert size={13} />,
    [LOG_SEVERITY.INFO]:  <Info size={13} />,
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
            Monitor real-time system events and exceptions.
          </p>
        </div>

        {/* Multi-select Severity Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Filter Severity
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* "All" chip — active when nothing else is selected */}
            <span
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
            </span>

            {SEVERITY_OPTIONS.map(({ value, label }) => {
              const active = selectedSeverities.includes(value);
              return (
                <span
                  key={value}
                  onClick={() => handleSeverityToggle(value)}
                  style={getSeverityChipStyle(value, active)}
                >
                  {severityChipIcons[value]}
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel" style={{ padding: '8px', marginBottom: '20px' }}>
        {loading && logs.length === 0 ? (
          <p style={{ padding: '48px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Subscribing to system logs...
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
                  <th>Actor ID</th>
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
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
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
                        
                        {/* User ID */}
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {log.userId ? (
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
                            className="btn btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedLogId(isExpanded ? null : log.id);
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              
                              {/* Quick Copyable IDs Section */}
                              <div style={{ 
                                display: 'flex', 
                                gap: '12px', 
                                flexWrap: 'wrap',
                                fontSize: '0.85rem'
                              }}>
                                {/* Log ID */}
                                <div style={{ 
                                  background: 'var(--bg-surface-elevated)', 
                                  padding: '6px 12px', 
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  border: '1px solid var(--border-light)'
                                }}>
                                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Log ID:</span>
                                  <code style={{ color: 'var(--text-primary)' }}>{log.id}</code>
                                  <button 
                                    onClick={() => handleCopy(log.id, `log-${log.id}`)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                                    title="Copy Log ID"
                                  >
                                    {copiedId === `log-${log.id}` ? <Check size={14} color="hsl(var(--success))" /> : <Copy size={14} />}
                                  </button>
                                </div>

                                {/* User ID */}
                                {log.userId && (
                                  <div style={{ 
                                    background: 'var(--bg-surface-elevated)', 
                                    padding: '6px 12px', 
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    border: '1px solid var(--border-light)'
                                  }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>User ID:</span>
                                    <code style={{ color: 'var(--text-primary)' }}>{log.userId}</code>
                                    <button 
                                      onClick={() => handleCopy(log.userId!, `user-${log.id}`)}
                                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                                      title="Copy User ID"
                                    >
                                      {copiedId === `user-${log.id}` ? <Check size={14} color="hsl(var(--success))" /> : <Copy size={14} />}
                                    </button>
                                  </div>
                                )}

                                {/* Booking ID */}
                                {log.details.bookingId && (
                                  <div style={{ 
                                    background: 'var(--bg-surface-elevated)', 
                                    padding: '6px 12px', 
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    border: '1px solid var(--border-light)'
                                  }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Booking ID:</span>
                                    <code style={{ color: 'var(--text-primary)' }}>{log.details.bookingId}</code>
                                    <button 
                                      onClick={() => handleCopy(log.details.bookingId, `booking-${log.id}`)}
                                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                                      title="Copy Booking ID"
                                    >
                                      {copiedId === `booking-${log.id}` ? <Check size={14} color="hsl(var(--success))" /> : <Copy size={14} />}
                                    </button>
                                  </div>
                                )}

                                {/* Client Booking Cache ID */}
                                {log.details.clientBookingCacheId && (
                                  <div style={{ 
                                    background: 'var(--bg-surface-elevated)', 
                                    padding: '6px 12px', 
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    border: '1px solid var(--border-light)'
                                  }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Cache ID:</span>
                                    <code style={{ color: 'var(--text-primary)' }}>{log.details.clientBookingCacheId}</code>
                                    <button 
                                      onClick={() => handleCopy(log.details.clientBookingCacheId, `cache-${log.id}`)}
                                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                                      title="Copy Cache ID"
                                    >
                                      {copiedId === `cache-${log.id}` ? <Check size={14} color="hsl(var(--success))" /> : <Copy size={14} />}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Textual Summary of error/issue if present */}
                              {(log.details.errorMessage || log.details.error) && (
                                <div style={{ 
                                  padding: '12px 16px', 
                                  background: 'rgba(239, 68, 68, 0.08)', 
                                  borderLeft: '4px solid #ef4444', 
                                  borderRadius: '4px' 
                                }}>
                                  {log.details.errorCode && (
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', display: 'block', marginBottom: '4px' }}>
                                      ERROR CODE: {log.details.errorCode}
                                    </span>
                                  )}
                                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {log.details.errorMessage || 'System Error Exception'}
                                  </p>
                                  {log.details.error && (
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                      Reason: {log.details.error}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Structured Metadata JSON Block */}
                              <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                  STRUCTURED TELEMETRY METADATA
                                </span>
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
                                  maxHeight: '300px'
                                }}>
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                              
                            </div>
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
