import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import { 
  getAllSupportRequests, 
  addMessageToSupportRequest, 
  updateSupportRequestStatus,
  deleteSupportRequest,
  type SupportRequest 
} from '../services/firebaseService';
import { formatDisplayName } from '../services/firebaseService';
import { MessageSquare, Send, ChevronLeft, Trash2, CheckCircle, Circle } from 'lucide-react';
import { INPUT_LIMITS, SUPPORT_STATUS, type SupportStatus } from '../config';
import { activateOnEnterOrSpace } from '../utils/keyboardNavigation';

type FilterType = 'all' | SupportStatus;

export const SupportDesk: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<FilterType>(SUPPORT_STATUS.OPEN);
  
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadRequests = useCallback(async () => {
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
  }, [selectedRequest]);

  useFocusRefresh(useCallback(() => {
    if (profile?.userRole === 'admin') {
      loadRequests();
    }
  }, [loadRequests, profile?.userRole]));

  useEffect(() => {
    (async () => {
      if (profile?.userRole === 'admin') {
        await loadRequests();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.userRole]);

  useEffect(() => {
    const handleTabReclick = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail === 'support-desk') {
        setView('list');
        setSelectedRequest(null);
      }
    };
    window.addEventListener('tab-reclick', handleTabReclick);
    return () => window.removeEventListener('tab-reclick', handleTabReclick);
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
        formatDisplayName(profile),
        true,
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
    const newStatus = selectedRequest.status === SUPPORT_STATUS.OPEN ? SUPPORT_STATUS.CLOSED : SUPPORT_STATUS.OPEN;
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
          <MessageSquare size={24} /> {view === 'list' ? 'Support Desk' : (selectedRequest?.subject || 'Request Thread')}
        </h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {view === 'list' && (
            <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {(['all', SUPPORT_STATUS.OPEN, SUPPORT_STATUS.CLOSED] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    background: filter === f ? 'hsl(var(--primary))' : 'transparent',
                    color: filter === f ? '#fff' : 'hsl(var(--text-secondary))',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    borderRadius: '6px'
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
            >
              <ChevronLeft size={16} /> Back
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
              {selectedRequest.status === SUPPORT_STATUS.OPEN ? <CheckCircle size={16} color="var(--success, #166534)" /> : <Circle size={16} />}
              {selectedRequest.status === SUPPORT_STATUS.OPEN ? 'Mark as Closed' : 'Reopen Request'}
            </button>
            <button 
              className="btn"
              onClick={handleDelete}
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #991b1b', cursor: 'pointer', fontWeight: 600 }}
            >
              <Trash2 size={16} /> Delete Conversation
            </button>
          </div>

          {/* Thread Header */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <strong>Category:</strong> {selectedRequest.category} &nbsp;|&nbsp; 
              <strong>Status:</strong> {selectedRequest.status === SUPPORT_STATUS.OPEN ? 'Open' : 'Closed'} &nbsp;|&nbsp; 
              <strong>Created:</strong> {new Date(selectedRequest.createdAt).toLocaleDateString()}
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
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <strong>{isAdmin ? 'You (Admin)' : `${msg.senderName} (${selectedRequest.userEmail})`}</strong>
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
              className="input-field" 
              placeholder="Type a reply to the coach..." 
              rows={4}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              maxLength={INPUT_LIMITS.SUPPORT_MESSAGE}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                  {replyText.length} / {INPUT_LIMITS.SUPPORT_MESSAGE} characters
                </span>
                {selectedRequest.status === SUPPORT_STATUS.CLOSED && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Replying will automatically reopen this ticket.
                  </div>
                )}
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleSendReply}
                disabled={submitting || !replyText.trim() || replyText.length > INPUT_LIMITS.SUPPORT_MESSAGE}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
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
            filteredRequests.map(req => {
              const openRequest = () => { setSelectedRequest(req); setView('detail'); };
              return (
              // role="button" rather than a real <button>: the card contains an
              // <h4>, which is not valid inside a button.
              <div
                key={req.id}
                className="glass-panel glass-panel-interactive"
                role="button"
                tabIndex={0}
                style={{
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={openRequest}
                onKeyDown={activateOnEnterOrSpace(openRequest)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge badge-${req.status}`} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                      {req.status === SUPPORT_STATUS.OPEN ? 'Open' : 'Closed'}
                    </span>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>{req.subject}</h4>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <strong>{req.userDisplayName}</strong> &nbsp;·&nbsp; {req.category} &nbsp;·&nbsp; Updated {new Date(req.updatedAt).toLocaleString()}
                  </div>
                </div>
                <ChevronLeft size={20} color="var(--text-muted)" style={{ transform: 'rotate(180deg)' }} />
              </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
