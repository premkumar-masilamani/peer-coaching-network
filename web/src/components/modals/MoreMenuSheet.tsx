import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TABS, type TabKey, USER_ROLE } from '../../config';
import { formatDisplayName, formatMemberSince, isApproved, getPendingUsersCount } from '../../services/firebaseService';
import { sanitizeImageUrl } from '../../utils/url';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { LifeBuoy, Shield, LogOut, X } from 'lucide-react';

interface MoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: TabKey;
  setCurrentTab: (tab: TabKey) => void;
}

export const MoreMenuSheet: React.FC<MoreMenuSheetProps> = ({
  isOpen,
  onClose,
  currentTab,
  setCurrentTab,
}) => {
  const { user, profile, role, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const isAdmin = role === USER_ROLE.ADMIN && isApproved(profile);

  const refreshPendingCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const count = await getPendingUsersCount();
      setPendingCount(count);
    } catch (e) {
      console.error('Error loading pending users count in MoreMenuSheet:', e);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    let active = true;
    getPendingUsersCount()
      .then((count) => {
        if (active) setPendingCount(count);
      })
      .catch((e) => {
        console.error('Error loading pending users count in MoreMenuSheet:', e);
      });
    return () => {
      active = false;
    };
  }, [isOpen, isAdmin]);

  useFocusRefresh(refreshPendingCount);

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
      if (dialog.open) {
        dialog.close();
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
        }
      }
    };
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleNavigate = (tab: TabKey) => {
    setCurrentTab(tab);
    onClose();
  };

  const handleSignOut = async () => {
    onClose();
    await logout();
  };

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Backdrop click handler is a mouse convenience; keyboard users dismiss via close button or Escape key */
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className="modal-dialog-native modal-bottom-sheet"
      aria-labelledby={titleId}
      aria-modal="true"
    >
      <div className="glass-panel modal-content more-menu-content">
        <div className="modal-grab-handle" />

        <div className="more-menu-header">
          <h3 id={titleId} className="more-menu-title">Account & More</h3>
          <button
            type="button"
            className="action-icon-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Identity Section */}
        {user && (
          <div className="more-menu-user-card">
            <img
              src={sanitizeImageUrl(profile?.photoURL || user.photoURL)}
              alt={formatDisplayName(profile || user) || 'User'}
              className="more-menu-avatar"
            />
            <div className="more-menu-user-details">
              <span className="more-menu-user-name">
                {formatDisplayName(profile || user) || 'Coaching Peer'}
              </span>
              <span className="more-menu-user-email">
                {profile?.email || user.email}
              </span>
              {profile?.createdAt && (
                <span className="more-menu-user-date">
                  Member since {formatMemberSince(profile.createdAt)}
                </span>
              )}
            </div>
            {isAdmin && (
              <span className="badge badge-admin">Admin</span>
            )}
          </div>
        )}

        {/* Navigation Actions */}
        <div className="more-menu-actions">
          <button
            type="button"
            className={`more-menu-item ${currentTab === TABS.SUPPORT ? 'active' : ''}`}
            onClick={() => handleNavigate(TABS.SUPPORT)}
          >
            <span className="more-menu-icon">
              <LifeBuoy size={20} />
            </span>
            <span className="more-menu-text">Get Support</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`more-menu-item ${currentTab === TABS.ADMIN ? 'active' : ''}`}
              onClick={() => handleNavigate(TABS.ADMIN)}
            >
              <span className="more-menu-icon">
                <Shield size={20} />
              </span>
              <span className="more-menu-text">Admin Dashboard</span>
              {pendingCount > 0 && (
                <span className="more-menu-badge">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          <div className="more-menu-divider" />

          <button
            type="button"
            className="more-menu-item sign-out-item"
            onClick={handleSignOut}
          >
            <span className="more-menu-icon">
              <LogOut size={20} />
            </span>
            <span className="more-menu-text">Sign Out</span>
          </button>
        </div>
      </div>
    </dialog>
  );
};
