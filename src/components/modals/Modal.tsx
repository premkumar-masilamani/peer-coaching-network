import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  style,
  className = '',
  ariaLabel
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={ariaLabel}
      className={`modal-dialog-native ${className}`}
      style={{
        background: 'hsl(var(--bg-surface))',
        color: 'hsl(var(--text-primary))',
        border: '1.5px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        borderRadius: '16px',
        padding: 0,
        margin: 'auto',
        outline: 'none',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        maxWidth: style?.maxWidth || '500px',
        width: 'calc(100% - 32px)',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        ...style
      }}
    >
      {children}
    </dialog>
  );
};
