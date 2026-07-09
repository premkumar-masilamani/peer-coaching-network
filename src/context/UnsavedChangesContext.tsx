/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ReviewChangesModal } from '../components/modals/ReviewChangesModal';

type SaveFunction = () => Promise<boolean>;

interface UnsavedChangesContextType {
  setPageDirtyState: (isDirty: boolean, changes: string[], onSave: SaveFunction) => void;
  requestExplicitSave: () => void;
  navigateWithConfirmation: (tab: string, performNavigation: () => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export const UnsavedChangesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDirty, setIsDirty] = useState(false);
  const [changes, setChanges] = useState<string[]>([]);
  const [onSave, setOnSave] = useState<SaveFunction | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'save' | 'navigate';
    navigateAction?: () => void;
  }>({
    isOpen: false,
    mode: 'save'
  });

  React.useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const setPageDirtyState = useCallback((dirty: boolean, newChanges: string[], saveFn: SaveFunction) => {
    setIsDirty(dirty);
    setChanges(newChanges);
    setOnSave(() => saveFn);
  }, []);

  const requestExplicitSave = useCallback(() => {
    if (isDirty) {
      setModalState({ isOpen: true, mode: 'save' });
    } else if (onSave) {
      onSave();
    }
  }, [isDirty, onSave]);

  const navigateWithConfirmation = useCallback((_tab: string, performNavigation: () => void) => {
    if (isDirty) {
      setModalState({ isOpen: true, mode: 'navigate', navigateAction: performNavigation });
    } else {
      performNavigation();
    }
  }, [isDirty]);

  const handleClose = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = async () => {
    if (onSave) {
      const success = await onSave();
      if (success) {
        setIsDirty(false);
        setChanges([]);
        const action = modalState.navigateAction;
        setModalState(prev => ({ ...prev, isOpen: false }));
        if (modalState.mode === 'navigate' && action) {
          action();
        }
      } else {
        setModalState(prev => ({ ...prev, isOpen: false }));
      }
    }
  };

  const handleDiscard = () => {
    setIsDirty(false);
    setChanges([]);
    const action = modalState.navigateAction;
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (modalState.mode === 'navigate' && action) {
      action();
    }
  };

  return (
    <UnsavedChangesContext.Provider value={{ setPageDirtyState, requestExplicitSave, navigateWithConfirmation }}>
      {children}
      <ReviewChangesModal
        isOpen={modalState.isOpen}
        title={modalState.mode === 'navigate' ? 'You have unsaved changes' : 'Review changes'}
        changes={changes}
        confirmText={modalState.mode === 'navigate' ? 'Save & Continue' : 'Confirm Save'}
        cancelText={modalState.mode === 'navigate' ? 'Stay on Page' : 'Cancel'}
        discardText={modalState.mode === 'navigate' ? 'Discard Changes' : undefined}
        onConfirm={handleConfirm}
        onDiscard={modalState.mode === 'navigate' ? handleDiscard : undefined}
        onClose={handleClose}
      />
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
};
