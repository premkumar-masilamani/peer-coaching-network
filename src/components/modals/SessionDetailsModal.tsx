import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import { sanitizeMeetLink } from '../../utils/url';

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
  if (!isOpen) return null;

  const sanitizedMeetLink = sanitizeMeetLink(meetLink);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Session Details"
      maxWidth="440px"
    >
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
        
        {!sanitizedMeetLink ? (
          <div style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '12px',
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'hsl(var(--text-secondary))',
            fontSize: '0.85rem'
          }}>
            <span>Google Meet link pending...</span>
          </div>
        ) : (
          <div style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '12px',
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <a
              href={sanitizedMeetLink}
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
