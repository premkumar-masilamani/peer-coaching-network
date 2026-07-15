import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { ConfigErrorScreen } from '../ConfigErrorScreen';

// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is not typed on globalThis
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ConfigErrorScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders an alert with the configuration-error heading', () => {
    act(() => root.render(<ConfigErrorScreen />));

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(container.textContent).toContain('Configuration error');
  });

  it('renders the provided detail message', () => {
    act(() => root.render(<ConfigErrorScreen message="Missing VITE_FIREBASE_API_KEY" />));

    expect(container.textContent).toContain('Missing VITE_FIREBASE_API_KEY');
  });
});
