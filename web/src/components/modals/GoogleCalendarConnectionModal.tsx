import React from 'react';
import { Calendar } from 'lucide-react';
import { Modal } from './Modal';
import { USER_MESSAGES } from '../../config';

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
        {USER_MESSAGES.MODALS.CALENDAR_CONNECTION.TITLE}
      </h3>

      <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '24px', lineHeight: 1.5, textAlign: 'center' }}>
        {USER_MESSAGES.MODALS.CALENDAR_CONNECTION.DESCRIPTION}
      </p>

      <div style={{ display: 'grid' }}>
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnecting}
          className="btn btn-primary"
        >
          {isConnecting ? USER_MESSAGES.MODALS.CALENDAR_CONNECTION.CONNECTING : USER_MESSAGES.MODALS.CALENDAR_CONNECTION.CONNECT}
        </button>
      </div>
    </Modal>
  );
};
