import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllSupportRequests, 
  addMessageToSupportRequest, 
  updateSupportRequestStatus,
  deleteSupportRequest,
  type SupportRequest 
} from '../services/firebaseService';
import { MessageSquare, RefreshCw, Send, ChevronLeft, Trash2, CheckCircle, Circle } from 'lucide-react';

type FilterType = 'all' | 'open' | 'closed';

export const SupportDesk: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadRequests = async () => {
    try {
      const data = await getAllSupportRequests();
      setRequests(data);
      if (selectedRequest) {
        const updated = data.find(t => t.id === selectedRequest.id);
        if (updated) setSelectedRequest(updated);
        else {
          setSelectedRequest(null);
          setView('list');
        }
      }
    } catch (err) {
      console.error('Failed to load support requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadRequests();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const handleSendReply = async () => {
    if (!profile || !selectedRequest || !replyText.trim()) return;
    setSubmitting(true);
    try {
      await addMessageToSupportRequest(
        selectedRequest.id,
        profile.userId,
        profile.displayName,
        'admin',
        replyText.trim()
      );
      setReplyText('');
      await loadRequests();
    } catch (err) {
      console.error('Failed to send reply', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    const newStatus = selectedRequest.status === 'open' ? 'closed' : 'open';
    try {
      await updateSupportRequestStatus(selectedRequest.id, newStatus);
      await loadRequests();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRequest) return;
    if (!window.confirm('Are you sure you want to permanently delete this support conversation? This cannot be undone.')) {
      return;
    }
    setSubmitting(true);
    try {
      await deleteSupportRequest(selectedRequest.id);
      setSelectedRequest(null);
      setView('list');
      await loadRequests();
    } catch (err) {
      console.error('Failed to delete request', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>
        Loading network support requests...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={24} /> {view === 'list' ? 'Support Desk' : 'Request Thread'}
        </h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {view === 'list' && (
            <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {(['all', 'open', 'closed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    background: filter === f ? 'var(--primary)' : 'transparent',
                    color: filter === f ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {view !== 'list' && (
            <button 
              className="btn btn-secondary" 
              onClick={() => { setView('list'); setSelectedRequest(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ChevronLeft size={16} /> Back to Desk
            </button>
          )}
          {view === 'list' && (
            <button 
              className="btn btn-secondary" 
              onClick={() => { setLoading(true); loadRequests(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* Detail Thread View */}
      {view === 'detail' && selectedRequest && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Admin Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button 
              onClick={handleToggleStatus}
              disabled={submitting}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {selectedRequest.status === 'open' ? <CheckCircle size={16} color="var(--success, #166534)" /> : <Circle size={16} />}
              {selectedRequest.status === 'open' ? 'Mark as Closed' : 'Reopen Request'}
            </button>
            <button 
              onClick={handleDelete}
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--danger-bg, #fee2e2)', color: 'var(--danger, #991b1b)', border: '1px solid var(--danger, #991b1b)', cursor: 'pointer', fontWeight: 600 }}
            >
              <Trash2 size={16} /> Delete Conversation
            </button>
          </div>

          {/* Thread Header */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>{selectedRequest.subject}</h3>
              <span className={`status-badge ${selectedRequest.status}`} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', background: selectedRequest.status === 'open' ? 'var(--success-bg, #dcfce7)' : 'var(--border-color)', color: selectedRequest.status === 'open' ? 'var(--success, #166534)' : 'var(--text-secondary)' }}>
                {selectedRequest.status === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>Coach:</strong> {selectedRequest.userDisplayName} ({selectedRequest.userEmail})</div>
              <div><strong>Category:</strong> {selectedRequest.category} &nbsp;|&nbsp; <strong> Created:</strong> {new Date(selectedRequest.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
          
          {/* Messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {selectedRequest.messages.map((msg) => {
              const isAdmin = msg.senderRole === 'admin';
              return (
                <div key={msg.id} style={{ 
                  alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: isAdmin ? 'var(--primary-bg)' : 'var(--card-bg)',
                  border: `1px solid ${isAdmin ? 'var(--primary-border)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <strong>{isAdmin ? 'You (Admin)' : msg.senderName}</strong>
                    <span>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply Box */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea 
              className="form-input" 
              placeholder="Type a reply to the coach..." 
              rows={4}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedRequest.status === 'closed' && "Replying will automatically reopen this ticket."}
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleSendReply}
                disabled={submitting || !replyText.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                <Send size={16} /> {submitting ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ margin: 0 }}>No support requests found.</p>
            </div>
          ) : (
            filteredRequests.map(req => (
              <div 
                key={req.id} 
                style={{ 
                  background: 'var(--card-bg)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px', 
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'border-color 0.2s ease'
                }}
                onClick={() => { setSelectedRequest(req); setView('detail'); }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`status-badge ${req.status}`} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', background: req.status === 'open' ? 'var(--success-bg, #dcfce7)' : 'var(--border-color)', color: req.status === 'open' ? 'var(--success, #166534)' : 'var(--text-secondary)' }}>
                      {req.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>{req.subject}</h4>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <strong>{req.userDisplayName}</strong> &nbsp;·&nbsp; {req.category} &nbsp;·&nbsp; Updated {new Date(req.updatedAt).toLocaleString()}
                  </div>
                </div>
                <ChevronLeft size={20} color="var(--text-muted)" style={{ transform: 'rotate(180deg)' }} />
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};
