// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UnsavedChangesProvider, useUnsavedChanges } from '../UnsavedChangesContext';

// @ts-expect-error React act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TestDirtyComponent = ({ onSaveMock }: { onSaveMock: () => Promise<boolean> }) => {
  const { setPageDirtyState, navigateWithConfirmation, requestExplicitSave } = useUnsavedChanges();

  return (
    <div>
      <button
        type="button"
        onClick={() => setPageDirtyState(true, ['Changed Bio', 'Changed Timezone'], onSaveMock)}
      >
        Make Dirty
      </button>
      <button
        type="button"
        onClick={() => setPageDirtyState(false, [], onSaveMock)}
      >
        Clear Dirty
      </button>
      <button
        type="button"
        onClick={() => navigateWithConfirmation('dashboard', () => {
          const el = document.getElementById('navigated-flag');
          if (el) el.textContent = 'Navigated';
        })}
      >
        Navigate To Dashboard
      </button>
      <button type="button" onClick={() => requestExplicitSave()}>
        Explicit Save
      </button>
      <span id="navigated-flag">Idle</span>
    </div>
  );
};

describe('UnsavedChangesContext', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const mockSave = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  it('allows navigation directly when not dirty', async () => {
    await act(async () => {
      root!.render(
        <UnsavedChangesProvider>
          <TestDirtyComponent onSaveMock={mockSave} />
        </UnsavedChangesProvider>
      );
    });

    const navBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Navigate To Dashboard')
    );

    await act(async () => {
      navBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.querySelector('#navigated-flag')?.textContent).toBe('Navigated');
  });

  it('intercepts navigation and opens ReviewChangesModal when dirty', async () => {
    await act(async () => {
      root!.render(
        <UnsavedChangesProvider>
          <TestDirtyComponent onSaveMock={mockSave} />
        </UnsavedChangesProvider>
      );
    });

    const makeDirtyBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Make Dirty')
    );
    const navBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Navigate To Dashboard')
    );

    await act(async () => {
      makeDirtyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      navBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.textContent).toContain('You have unsaved changes');
    expect(container?.textContent).toContain('Changed Bio');
    expect(container?.textContent).toContain('Changed Timezone');
    expect(container?.querySelector('#navigated-flag')?.textContent).toBe('Idle');

    const discardBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Discard Changes')
    );

    await act(async () => {
      discardBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container?.querySelector('#navigated-flag')?.textContent).toBe('Navigated');
  });

  it('intercepts beforeunload event when dirty', async () => {
    await act(async () => {
      root!.render(
        <UnsavedChangesProvider>
          <TestDirtyComponent onSaveMock={mockSave} />
        </UnsavedChangesProvider>
      );
    });

    const makeDirtyBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Make Dirty')
    );

    await act(async () => {
      makeDirtyBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnloadEvent);

    expect(beforeUnloadEvent.defaultPrevented).toBe(true);
  });
});
