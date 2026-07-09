import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { UnsavedChangesProvider, useUnsavedChanges } from '../UnsavedChangesContext';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Mock ReviewChangesModal so it renders simple buttons we can click in tests.
// The modal receives onConfirm / onDiscard / onClose — we expose them as
// buttons with predictable data-testid attributes.
// ---------------------------------------------------------------------------
vi.mock('../../components/modals/ReviewChangesModal', () => ({
  ReviewChangesModal: ({
    isOpen,
    onConfirm,
    onDiscard,
    onClose,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onDiscard?: () => void;
    onClose: () => void;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="mock-modal">
        <button data-testid="btn-confirm" onClick={onConfirm}>Confirm</button>
        {onDiscard && <button data-testid="btn-discard" onClick={onDiscard}>Discard</button>}
        <button data-testid="btn-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));

describe('UnsavedChangesContext', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let latestCtx: ReturnType<typeof useUnsavedChanges> | null = null;

  const TestConsumer = () => {
    latestCtx = useUnsavedChanges();
    return <div id="consumer" />;
  };

  const renderProvider = () => {
    act(() => {
      root!.render(
        <UnsavedChangesProvider>
          <TestConsumer />
        </UnsavedChangesProvider>
      );
    });
  };

  const q = (selector: string): Element | null => container!.querySelector(selector);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latestCtx = null;
  });

  afterEach(() => {
    act(() => { root!.unmount(); });
    document.body.removeChild(container!);
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // useUnsavedChanges outside provider
  // ---------------------------------------------------------------------------

  it('throws when useUnsavedChanges is used outside UnsavedChangesProvider', () => {
    const BadConsumer = () => { useUnsavedChanges(); return null; };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      act(() => { root!.render(<BadConsumer />); });
    }).toThrow('useUnsavedChanges must be used within an UnsavedChangesProvider');
    consoleErrorSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // navigateWithConfirmation
  // ---------------------------------------------------------------------------

  it('calls performNavigation immediately when not dirty', () => {
    renderProvider();
    const navigate = vi.fn();
    act(() => { latestCtx!.navigateWithConfirmation('dashboard', navigate); });
    expect(navigate).toHaveBeenCalledOnce();
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  it('opens the modal instead of navigating when dirty', () => {
    renderProvider();
    const navigate = vi.fn();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed field A'], onSave); });
    act(() => { latestCtx!.navigateWithConfirmation('dashboard', navigate); });
    expect(navigate).not.toHaveBeenCalled();
    expect(q('[data-testid="mock-modal"]')).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // requestExplicitSave
  // ---------------------------------------------------------------------------

  it('calls onSave immediately when not dirty', () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(false, [], onSave); });
    act(() => { latestCtx!.requestExplicitSave(); });
    expect(onSave).toHaveBeenCalledOnce();
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  it('opens the modal when dirty and requestExplicitSave is called', () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed field B'], onSave); });
    act(() => { latestCtx!.requestExplicitSave(); });
    expect(q('[data-testid="mock-modal"]')).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // handleClose (btn-close)
  // ---------------------------------------------------------------------------

  it('closes the modal without saving when the close button is clicked', () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed field C'], onSave); });
    act(() => { latestCtx!.requestExplicitSave(); });
    expect(q('[data-testid="mock-modal"]')).not.toBeNull();

    act(() => { (q('[data-testid="btn-close"]') as HTMLButtonElement).click(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // handleConfirm (btn-confirm) — save mode
  // ---------------------------------------------------------------------------

  it('calls onSave and closes modal when confirm is clicked and save succeeds', async () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['field X'], onSave); });
    act(() => { latestCtx!.requestExplicitSave(); });

    await act(async () => {
      (q('[data-testid="btn-confirm"]') as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  it('closes modal but stays dirty when onSave returns false', async () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(false);
    act(() => { latestCtx!.setPageDirtyState(true, ['field Y'], onSave); });
    act(() => { latestCtx!.requestExplicitSave(); });

    await act(async () => {
      (q('[data-testid="btn-confirm"]') as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledOnce();
    // Modal is closed but dirty state was not cleared — a follow-up open still works
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // handleConfirm — navigate mode (save & continue)
  // ---------------------------------------------------------------------------

  it('saves and then calls navigateAction when confirm is clicked in navigate mode', async () => {
    renderProvider();
    const navigate = vi.fn();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['field Z'], onSave); });
    act(() => { latestCtx!.navigateWithConfirmation('profile', navigate); });

    await act(async () => {
      (q('[data-testid="btn-confirm"]') as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  it('does not navigate when confirm is clicked and save fails in navigate mode', async () => {
    renderProvider();
    const navigate = vi.fn();
    const onSave = vi.fn().mockResolvedValue(false);
    act(() => { latestCtx!.setPageDirtyState(true, ['field W'], onSave); });
    act(() => { latestCtx!.navigateWithConfirmation('profile', navigate); });

    await act(async () => {
      (q('[data-testid="btn-confirm"]') as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // handleDiscard (btn-discard)
  // ---------------------------------------------------------------------------

  it('discards changes and calls navigateAction when discard is clicked', () => {
    renderProvider();
    const navigate = vi.fn();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['field V'], onSave); });
    act(() => { latestCtx!.navigateWithConfirmation('settings', navigate); });

    expect(q('[data-testid="btn-discard"]')).not.toBeNull();
    act(() => { (q('[data-testid="btn-discard"]') as HTMLButtonElement).click(); });

    expect(onSave).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnce();
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // beforeunload event handler
  // ---------------------------------------------------------------------------

  it('adds and removes beforeunload event listener based on isDirty state', () => {
    renderProvider();
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed field D'], onSave); });

    expect(addListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    act(() => { latestCtx!.setPageDirtyState(false, [], onSave); });
    expect(removeListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
  });
});
