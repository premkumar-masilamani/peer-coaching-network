import React from 'react';
import { Calendar } from 'lucide-react';
import { Modal } from './Modal';

interface GoogleCalendarConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  isConnecting?: boolean;
}

export const GoogleCalendarConnectionModal: React.FC<GoogleCalendarConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isConnecting = false,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="440px"
    >
      <div style={{
        background: 'hsl(var(--primary) / 0.1)',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'hsl(var(--primary))',
        margin: '0 auto 20px auto'
      }}>
        <Calendar size={32} />
      </div>

      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', textAlign: 'center' }}>
        Google Calendar Connection Required
      </h3>

      <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '24px', lineHeight: 1.5, textAlign: 'center' }}>
        To manage or book peer coaching sessions, you must connect your Google Calendar. This allows the platform to sync availability and automatically schedule meetings.
      </p>

      <div style={{ display: 'grid' }}>
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnecting}
          className="btn btn-primary"
        >
          {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
      </div>
    </Modal>
  );
};
