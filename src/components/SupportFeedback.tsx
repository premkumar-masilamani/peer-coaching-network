import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  getSupportRequestsForUser, 
  createSupportRequest, 
  addMessageToSupportRequest, 
  type SupportRequest 
} from '../services/firebaseService';
import { SUPPORT_CATEGORIES, type SupportCategory } from '../config';
import { MessageSquare, Plus, RefreshCw, Send, ChevronLeft, LifeBuoy } from 'lucide-react';

export const SupportFeedback: React.FC = () => {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
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

  const handleSendReply = async () => {
    if (!profile || !selectedTicket || !replyText.trim()) return;
    setSubmitting(true);
    try {
      await addMessageToSupportRequest(
        selectedTicket.id,
        profile.userId,
        profile.displayName,
        'user',
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
          {view === 'detail' && <><MessageSquare size={24} /> Request Detail</>}
        </h2>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {view !== 'list' && (
            <button 
              className="btn btn-secondary" 
              onClick={() => { setView('list'); setSelectedTicket(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
        <form onSubmit={handleCreateRequest} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="form-label">Category</label>
            <select 
              className="form-select" 
              value={category} 
              onChange={e => setCategory(e.target.value as SupportCategory)}
            >
              {SUPPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="form-label">Subject</label>
            <input 
              className="form-input" 
              placeholder="Briefly describe your issue or request" 
              value={subject} 
              onChange={e => setSubject(e.target.value)} 
              required
            />
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="form-label">Message Details</label>
            <textarea 
              className="form-input" 
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
          {/* Thread Header */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>{selectedTicket.subject}</h3>
              <span className={`status-badge ${selectedTicket.status}`} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', background: selectedTicket.status === 'open' ? 'var(--success-bg, #dcfce7)' : 'var(--border-color)', color: selectedTicket.status === 'open' ? 'var(--success, #166534)' : 'var(--text-secondary)' }}>
                {selectedTicket.status === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <strong>Category:</strong> {selectedTicket.category} &nbsp;|&nbsp; 
              <strong> Created:</strong> {new Date(selectedTicket.createdAt).toLocaleDateString()}
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
                  background: isMe ? 'var(--primary-light, #eff6ff)' : (isAdmin ? 'var(--warning-light, #fef3c7)' : 'var(--card-bg)'),
                  border: `1px solid ${isMe ? 'var(--primary, #3b82f6)' : 'var(--border-color)'}`,
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
              className="form-input" 
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
          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              <LifeBuoy size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ margin: 0 }}>You haven't submitted any support requests yet.</p>
            </div>
          ) : (
            tickets.map(ticket => (
              <div 
                key={ticket.id} 
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
                onClick={() => { setSelectedTicket(ticket); setView('detail'); }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`status-badge ${ticket.status}`} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', background: ticket.status === 'open' ? 'var(--success-bg, #dcfce7)' : 'var(--border-color)', color: ticket.status === 'open' ? 'var(--success, #166534)' : 'var(--text-secondary)' }}>
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
