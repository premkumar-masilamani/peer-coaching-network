import React from 'react';
import { X } from 'lucide-react';

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
  title = "Review changes",
  confirmText = "Confirm Approval",
  discardText = "Discard",
  cancelText = "Cancel",
  changes,
  onConfirm,
  onDiscard,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ pointerEvents: 'auto', zIndex: 9999 }} onClick={onClose}>
      <div className="structural-panel modal-content" style={{ padding: '32px', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.3)' }} onClick={(e) => e.stopPropagation()}>
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

        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>{title}</h3>
        {userName && (
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
            <strong>{userName}</strong>:
          </p>
        )}
        {!userName && <div style={{ height: '20px' }} />}

        {changes.length === 0 ? (
          <div className="structural-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>No modifications detected in draft.</p>
          </div>
        ) : (
          <div className="structural-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px' }}>
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
      </div>
    </div>
  );
};
