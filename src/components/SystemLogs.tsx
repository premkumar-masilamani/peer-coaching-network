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

interface SystemLog {
  id: string;
  type: 'info' | 'warn' | 'error';
  event: string;
  userId: string | null;
  details: Record<string, any>;
  timestamp: any;
  expireAt: any;
  doc: any; // Storing the document snapshot for pagination
}

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  
  // Pagination State
  const [pageIndex, setPageIndex] = useState(0);
  const pageCursorsRef = useRef<(any | null)[]>([null]);
  const [hasNext, setHasNext] = useState(false);
  
  // Row Expansion State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reset pagination when filter changes
  const handleFilterChange = (filter: 'all' | 'error' | 'warn' | 'info') => {
    setTypeFilter(filter);
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
      collection(db, 'systemLogs'),
      orderBy('timestamp', 'desc')
    );

    if (typeFilter !== 'all') {
      q = query(q, where('type', '==', typeFilter));
    }

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
  }, [pageIndex, typeFilter]);

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

  const getSeverityBadgeStyle = (type: 'info' | 'warn' | 'error') => {
    switch (type) {
      case 'error':
        return {
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          icon: <AlertCircle size={14} style={{ marginRight: '6px' }} />
        };
      case 'warn':
        return {
          background: 'rgba(245, 158, 11, 0.12)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          icon: <TriangleAlert size={14} style={{ marginRight: '6px' }} />
        };
      case 'info':
      default:
        return {
          background: 'rgba(13, 148, 136, 0.12)',
          color: '#2dd4bf',
          border: '1px solid rgba(13, 148, 136, 0.2)',
          icon: <Info size={14} style={{ marginRight: '6px' }} />
        };
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Header and Filter Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
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
            Monitor real-time system events, exceptions, and API logging.
          </p>
        </div>

        {/* Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter Severity:</label>
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(e.target.value as any)}
            className="input-field"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              width: '160px'
            }}
          >
            <option value="all">All Severities</option>
            <option value="error">Errors Only</option>
            <option value="warn">Warnings Only</option>
            <option value="info">Info Only</option>
          </select>
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
