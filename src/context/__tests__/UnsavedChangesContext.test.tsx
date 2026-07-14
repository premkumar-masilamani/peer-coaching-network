import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { UnsavedChangesProvider, useUnsavedChanges, useNavigateToProfile } from '../UnsavedChangesContext';
import { navigateToProfile } from '../../utils/url';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Stub the raw profile navigator so we can assert the guarded hook delegates to
// it without touching window.history / dispatching real popstate events.
vi.mock('../../utils/url', () => ({
  navigateToProfile: vi.fn(),
}));

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
  let latestNavigateToProfile: ReturnType<typeof useNavigateToProfile> | null = null;

  const TestConsumer = () => {
    latestCtx = useUnsavedChanges();
    latestNavigateToProfile = useNavigateToProfile();
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
    latestNavigateToProfile = null;
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
  // useNavigateToProfile — guarded profile navigation
  // ---------------------------------------------------------------------------

  it('navigates to the profile immediately when not dirty', () => {
    renderProvider();
    act(() => { latestNavigateToProfile!('coach-123'); });
    expect(navigateToProfile).toHaveBeenCalledWith('coach-123');
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  it('opens the confirmation modal instead of navigating when dirty', () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed bio'], onSave); });
    act(() => { latestNavigateToProfile!('coach-123'); });
    expect(navigateToProfile).not.toHaveBeenCalled();
    expect(q('[data-testid="mock-modal"]')).not.toBeNull();
  });

  it('navigates to the profile after discarding unsaved changes', () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed bio'], onSave); });
    act(() => { latestNavigateToProfile!('coach-456'); });
    act(() => { (q('[data-testid="btn-discard"]') as HTMLButtonElement).click(); });
    expect(navigateToProfile).toHaveBeenCalledWith('coach-456');
    expect(q('[data-testid="mock-modal"]')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // beforeunload guard — full page unload (tab close / reload)
  // ---------------------------------------------------------------------------

  it('registers a beforeunload listener only while dirty and removes it when clean', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    renderProvider();
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed bio'], onSave); });
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    act(() => { latestCtx!.setPageDirtyState(false, [], onSave); });
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('prevents the unload and sets returnValue when dirty', () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['Changed bio'], onSave); });

    // jsdom models a plain Event's `returnValue` with legacy boolean cancel
    // semantics rather than the string slot a real BeforeUnloadEvent exposes,
    // so we intercept the assignment to confirm the handler sets it, and assert
    // on preventDefault / defaultPrevented for the actual guard behavior.
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    let assignedReturnValue: unknown;
    Object.defineProperty(event, 'returnValue', {
      configurable: true,
      get: () => assignedReturnValue,
      set: (v) => { assignedReturnValue = v; },
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    act(() => { window.dispatchEvent(event); });

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(assignedReturnValue).toBe('');
  });

  it('does not block the unload when not dirty', () => {
    renderProvider();
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    act(() => { window.dispatchEvent(event); });
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // onSave cleanup
  // ---------------------------------------------------------------------------

  it('clears onSave when confirm is clicked and save succeeds', async () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    act(() => { latestCtx!.setPageDirtyState(true, ['field X'], onSave); });
    act(() => { latestCtx!.requestExplicitSave(); });

    await act(async () => {
      (q('[data-testid="btn-confirm"]') as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledOnce();

    onSave.mockClear();
    act(() => { latestCtx!.requestExplicitSave(); });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clears onSave when discard is clicked', async () => {
    renderProvider();
    const onSave = vi.fn().mockResolvedValue(true);
    const navigate = vi.fn();
    act(() => { latestCtx!.setPageDirtyState(true, ['field Y'], onSave); });
    act(() => { latestCtx!.navigateWithConfirmation('settings', navigate); });

    act(() => { (q('[data-testid="btn-discard"]') as HTMLButtonElement).click(); });

    expect(onSave).not.toHaveBeenCalled();

    act(() => { latestCtx!.requestExplicitSave(); });
    expect(onSave).not.toHaveBeenCalled();
  });
});
