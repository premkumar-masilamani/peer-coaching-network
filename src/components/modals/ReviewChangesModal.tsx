import React from 'react';
import { X } from 'lucide-react';

interface ReviewChangesModalProps {
  isOpen: boolean;
  userName: string;
  changes: string[];
  onConfirm: () => void;
  onClose: () => void;
}

export const ReviewChangesModal: React.FC<ReviewChangesModalProps> = ({
  isOpen,
  userName,
  changes,
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ pointerEvents: 'auto' }} onClick={onClose}>
      <div className="glass-panel modal-content" style={{ padding: '32px', position: 'relative', border: '1px solid rgba(139, 92, 246, 0.3)' }} onClick={(e) => e.stopPropagation()}>
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

        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>Review changes</h3>
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>
          <strong>{userName}</strong>:
        </p>

        {changes.length === 0 ? (
          <div className="glass-panel" style={{ padding: '16px', background: 'var(--panel-hover-bg)', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))' }}>No modifications detected in draft.</p>
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
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            Confirm Approval
          </button>
        </div>
      </div>
    </div>
  );
};
