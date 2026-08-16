import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { USER_MESSAGES } from '../../config';

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  coachName: string;
  clientName: string;
  topic: string;
  date: string;
  time: string;
  isCancelling?: boolean;
}

export const CancelModal: React.FC<CancelModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  coachName,
  clientName,
  topic,
  date,
  time,
  isCancelling = false
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      borderStyle="1px solid rgba(239, 68, 68, 0.3)"
      maxWidth="440px"
    >
      {/* Warning Icon */}
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f87171',
        margin: '0 auto 20px auto'
      }}>
        <AlertTriangle size={32} />
      </div>

      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', textAlign: 'center' }}>
        {USER_MESSAGES.MODALS.CANCEL_SESSION.TITLE}
      </h3>

      <div className="glass-panel" style={{ padding: '20px', background: 'var(--panel-hover-bg)', marginBottom: '20px' }}>
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
      </div>
      
      <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '24px', lineHeight: 1.4, textAlign: 'center' }}>
        {USER_MESSAGES.MODALS.CANCEL_SESSION.DESCRIPTION}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={onConfirm}
          disabled={isCancelling}
          className="btn btn-danger"
          style={{
            width: '100%',
            fontWeight: 600
          }}
        >
          {isCancelling ? USER_MESSAGES.MODALS.CANCEL_SESSION.CANCELLING : USER_MESSAGES.MODALS.CANCEL_SESSION.CONFIRM}
        </button>
        <button
          onClick={onClose}
          disabled={isCancelling}
          className="btn btn-secondary"
          style={{ width: '100%' }}
        >
          {USER_MESSAGES.MODALS.CANCEL_SESSION.CANCEL}
        </button>
      </div>
    </Modal>
  );
};
