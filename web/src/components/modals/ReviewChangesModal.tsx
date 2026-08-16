import React from 'react';
import { Modal } from './Modal';
import { USER_MESSAGES } from '../../config';

interface ReviewChangesModalProps {
  isOpen: boolean;
  userName?: string;
  title?: string;
  confirmText?: string;
  discardText?: string;
  cancelText?: string;
  changes: string[];
  onConfirm: () => void;
  onDiscard?: () => void;
  onClose: () => void;
}

export const ReviewChangesModal: React.FC<ReviewChangesModalProps> = ({
  isOpen,
  userName,
  title = USER_MESSAGES.MODALS.REVIEW_CHANGES.TITLE,
  confirmText = USER_MESSAGES.MODALS.REVIEW_CHANGES.CONFIRM,
  discardText = USER_MESSAGES.MODALS.REVIEW_CHANGES.DISCARD,
  cancelText = USER_MESSAGES.MODALS.REVIEW_CHANGES.CANCEL,
  changes,
  onConfirm,
  onDiscard,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      {userName && (
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
          <strong>{userName}</strong>:
        </p>
      )}
      {!userName && <div style={{ height: '20px' }} />}

      {changes.length === 0 ? (
        <div className="glass-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>{USER_MESSAGES.MODALS.REVIEW_CHANGES.NO_CHANGES}</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px' }}>
          <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {changes.map((chg, idx) => (
              <li key={idx} style={{ color: 'hsl(var(--text-secondary))' }}>
                {chg}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          {cancelText}
        </button>
        {onDiscard && (
          <button
            onClick={onDiscard}
            className="btn btn-secondary"
            style={{ flex: 1, borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
          >
            {discardText}
          </button>
        )}
        <button
          onClick={onConfirm}
          className="btn btn-primary"
          style={{ flex: onDiscard ? 1.5 : 1 }}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};
