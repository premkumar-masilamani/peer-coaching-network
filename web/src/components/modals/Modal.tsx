import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  borderStyle?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '440px',
  borderStyle = '1px solid rgba(139, 92, 246, 0.3)',
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        previousActiveElementRef.current = document.activeElement as HTMLElement;
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
        }
      }
    }

    return () => {
      // If the component is unmounted while the dialog is still open, restore focus
      if (dialog.open) {
        dialog.close();
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
        }
      }
    };
  }, [isOpen]);

  // Handle native ESC key cancellations via the cancel event
  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    onClose();
  };

  // Handle click on backdrop to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Backdrop click handler is a mouse convenience; keyboard users dismiss via close button or Escape key */
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className="modal-dialog-native"
      style={{
        padding: 0,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        maxWidth: maxWidth,
        width: '100%',
        margin: 'auto',
      }}
    >
      <div
        className="glass-panel modal-content"
        style={{
          padding: '32px',
          position: 'relative',
          width: '100%',
          border: borderStyle,
          background: 'hsl(var(--bg-surface))',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'hsl(var(--text-muted))',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {title && (
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '20px' }}>
            {title}
          </h3>
        )}

        {children}
      </div>
    </dialog>
  );
};
