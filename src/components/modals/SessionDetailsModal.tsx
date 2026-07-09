import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';

interface SessionDetailsModalProps {
  isOpen: boolean;
  coachName: string;
  clientName: string;
  topic: string;
  date: string;
  time: string;
  meetLink?: string | null;
  onClose: () => void;
}

export const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({
  isOpen,
  coachName,
  clientName,
  topic,
  date,
  time,
  meetLink,
  onClose
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Session Details"
      className="modal-content"
      style={{
        padding: '32px',
        maxWidth: '440px',
        width: '100%',
        border: '1px solid rgba(139, 92, 246, 0.3)'
      }}
    >
      {/* Close Button */}
      <button 
        onClick={onClose} 
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'transparent',
          border: 'none',
          color: 'hsl(var(--text-muted))',
          cursor: 'pointer'
        }}
      >
        <X size={18} />
      </button>

      <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '20px' }}>
        Session Details
      </h3>

      <div className="glass-panel" style={{ padding: '20px', background: 'var(--panel-hover-bg)', marginBottom: '24px' }}>
        <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
          <strong>Coach:</strong> {coachName}
        </p>
        <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
          <strong>Client:</strong> {clientName}
        </p>
        <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
          <strong>Topic:</strong> {topic}
        </p>
        <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
          <strong>Date:</strong> {date}
        </p>
        <p style={{ fontSize: '0.85rem', marginBottom: '0px' }}>
          <strong>Time:</strong> {time}
        </p>
        
        {meetLink && (
          <div style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '12px',
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem', width: '100%', gap: '6px' }}
            >
              Join Google Meet
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%' }}>
        Close Window
      </button>
    </Modal>
  );
};
