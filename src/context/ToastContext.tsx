/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useState, useRef, useEffect, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import '../components/Toast.css';

export type ToastType = 'error' | 'success';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  /** Show a toast. Defaults to an error toast, the most common failure case. */
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Auto-dismiss delay. Errors linger a little longer so the user can read them.
const AUTO_DISMISS_MS: Record<ToastType, number> = {
  error: 6000,
  success: 4000,
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // Track pending timers so they can be cleared on unmount / manual dismiss.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'error') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS[type]);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  // Clear any outstanding timers when the provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pcn-toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.type === 'error' ? AlertCircle : CheckCircle;
          return (
            <div key={toast.id} className={`pcn-toast pcn-toast--${toast.type}`} role="alert">
              <Icon size={18} className="pcn-toast__icon" aria-hidden="true" />
              <span className="pcn-toast__message">{toast.message}</span>
              <button
                type="button"
                className="pcn-toast__close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(toast.id)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
