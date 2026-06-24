import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getSupportRequestsForUser, 
  createSupportRequest, 
  addMessageToSupportRequest, 
  updateSupportRequestStatus,
  type SupportRequest 
} from '../services/firebaseService';
import { SUPPORT_CATEGORIES, type SupportCategory } from '../config';
import { MessageSquare, Plus, RefreshCw, Send, ChevronLeft, LifeBuoy, Tag, Type, AlignLeft, CheckCircle, Circle } from 'lucide-react';

export const SupportFeedback: React.FC = () => {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  
  const [view, setView] = useState<'list' | 'detail' | 'new'>('list');
  const [selectedTicket, setSelectedTicket] = useState<SupportRequest | null>(null);

  // New Request Form State
  const [category, setCategory] = useState<SupportCategory>(SUPPORT_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  
  // Reply State
  const [replyText, setReplyText] = useState('');

  const loadTickets = async () => {
    if (!profile) return;
    try {
      const data = await getSupportRequestsForUser(profile.userId);
      setTickets(data);
      if (selectedTicket) {
        const updated = data.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch (err) {
      console.error('Failed to load support requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadTickets();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    const handleTabReclick = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail === 'support') {
        setView('list');
        setSelectedTicket(null);
      }
    };
    window.addEventListener('tab-reclick', handleTabReclick);
    return () => window.removeEventListener('tab-reclick', handleTabReclick);
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !subject.trim() || !message.trim()) return;
    
    setSubmitting(true);
    try {
      await createSupportRequest(
        profile.userId,
        profile.displayName,
        profile.email,
        category,
        subject.trim(),
        message.trim()
      );
      setSubject('');
      setMessage('');
      setView('list');
      await loadTickets();
    } catch (err) {
      console.error('Failed to create request', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedTicket) return;
    setSubmitting(true);
    try {
      const newStatus = selectedTicket.status === 'open' ? 'closed' : 'open';
      await updateSupportRequestStatus(selectedTicket.id, newStatus);
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
      await loadTickets();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter === 'all') return true;
    return ticket.status === filter;
  });

  const handleSendReply = async () => {
    if (!profile || !selectedTicket || !replyText.trim()) return;
    setSubmitting(true);
    try {
      await addMessageToSupportRequest(
        selectedTicket.id,
        profile.userId,
        profile.displayName,
        false,
        replyText.trim()
      );
      setReplyText('');
      await loadTickets();
    } catch (err) {
      console.error('Failed to send reply', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && tickets.length === 0) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>
        Loading support requests...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {view === 'list' && <><LifeBuoy size={24} /> Get Support</>}
          {view === 'new' && <><Plus size={24} /> New Support Request</>}
          {view === 'detail' && selectedTicket && <><MessageSquare size={24} /> {selectedTicket.subject}</>}
        </h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {view === 'list' && (
            <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginRight: '8px' }}>
              {(['all', 'open', 'closed'] as const).map(f => (
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
              onClick={() => { setView('list'); setSelectedTicket(null); }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {view === 'list' && (
            <>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setLoading(true); loadTickets(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => setView('new')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> New Request
              </button>
            </>
          )}
        </div>
      </div>

      {/* New Request Form */}
      {view === 'new' && (
        <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="support-category">
              <Tag size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Category
            </label>
            <select 
              id="support-category"
              className="input-field" 
              value={category} 
              onChange={e => setCategory(e.target.value as SupportCategory)}
            >
              {SUPPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="support-subject">
              <Type size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Subject
            </label>
            <input 
              id="support-subject"
              className="input-field" 
              placeholder="Briefly describe your issue or request" 
              value={subject} 
              onChange={e => setSubject(e.target.value)} 
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="support-message">
              <AlignLeft size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Message Details
            </label>
            <textarea 
              id="support-message"
              className="input-field" 
              placeholder="Provide as much detail as possible..." 
              rows={6}
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting || !subject.trim() || !message.trim()}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {/* Detail Thread View */}
      {view === 'detail' && selectedTicket && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* User Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button 
              onClick={handleToggleStatus}
              disabled={submitting}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {selectedTicket.status === 'open' ? <CheckCircle size={16} color="var(--success, #166534)" /> : <Circle size={16} />}
              {selectedTicket.status === 'open' ? 'Mark as Closed' : 'Reopen Request'}
            </button>
          </div>
          
          {/* Thread Header */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <strong>Category:</strong> {selectedTicket.category} &nbsp;|&nbsp; 
              <strong>Status:</strong> {selectedTicket.status === 'open' ? 'Open' : 'Closed'} &nbsp;|&nbsp; 
              <strong>Created:</strong> {new Date(selectedTicket.createdAt).toLocaleDateString()}
            </div>
          </div>
          
          {/* Messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {selectedTicket.messages.map((msg) => {
              const isMe = msg.senderId === profile?.userId;
              const isAdmin = msg.senderRole === 'admin';
              return (
                <div key={msg.id} style={{ 
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
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
                    <strong>{isMe ? 'You' : msg.senderName} {isAdmin && '(Admin)'}</strong>
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
            {selectedTicket.status === 'closed' && (
              <div style={{ fontSize: '0.875rem', color: 'var(--warning)', fontWeight: 600, marginBottom: '4px' }}>
                This ticket is marked as Closed. Sending a reply will automatically reopen it.
              </div>
            )}
            <textarea 
              className="input-field" 
              placeholder="Type a reply..." 
              rows={4}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSendReply}
                disabled={submitting || !replyText.trim()}
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
          {filteredTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              <LifeBuoy size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ margin: 0 }}>No support requests found.</p>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <div 
                key={ticket.id} 
                className="glass-panel glass-panel-interactive"
                style={{ 
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => { setSelectedTicket(ticket); setView('detail'); }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge badge-${ticket.status}`} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                      {ticket.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>{ticket.subject}</h4>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {ticket.category} &nbsp;·&nbsp; Updated {new Date(ticket.updatedAt).toLocaleString()}
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
