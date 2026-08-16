import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { logger } from '../utils/logger';
import { USER_MESSAGES } from '../config';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback rendered in place of the default error screen. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary. Catches render-time errors anywhere in the tree and
 * renders a fallback UI instead of letting React unmount the whole app to a
 * blank page. There is intentionally no way to recover in-place beyond a full
 * reload — the tree that threw is discarded.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('Uncaught render error:', error, errorInfo.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div className="bg-gradient-radial" />
        <div
          style={{
            background: 'hsl(var(--primary))',
            width: '50px',
            height: '50px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px var(--primary-glow)',
          }}
        >
          <AlertTriangle size={24} color="#fff" />
        </div>
        <h1
          style={{
            fontSize: '1.25rem',
            color: 'var(--text-primary)',
            fontWeight: 700,
            margin: 0,
          }}
        >
          {USER_MESSAGES.SYSTEM.SOMETHING_WENT_WRONG}
        </h1>
        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            maxWidth: '480px',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {USER_MESSAGES.SYSTEM.UNEXPECTED_ERROR_RELOAD}
        </p>
        <button
          onClick={this.handleReload}
          style={{
            background: 'hsl(var(--primary))',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 20px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: '4px',
          }}
        >
          {USER_MESSAGES.SYSTEM.RELOAD_BUTTON}
        </button>
      </div>
    );
  }
}
