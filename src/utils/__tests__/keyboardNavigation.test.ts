import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { activateOnEnterOrSpace, resolveTabNavigationIndex } from '../keyboardNavigation';

describe('resolveTabNavigationIndex', () => {
  const COUNT = 7;

  it('advances on ArrowRight', () => {
    expect(resolveTabNavigationIndex('ArrowRight', 0, COUNT)).toBe(1);
    expect(resolveTabNavigationIndex('ArrowRight', 5, COUNT)).toBe(6);
  });

  it('retreats on ArrowLeft', () => {
    expect(resolveTabNavigationIndex('ArrowLeft', 6, COUNT)).toBe(5);
    expect(resolveTabNavigationIndex('ArrowLeft', 1, COUNT)).toBe(0);
  });

  it('wraps around both ends', () => {
    expect(resolveTabNavigationIndex('ArrowRight', COUNT - 1, COUNT)).toBe(0);
    expect(resolveTabNavigationIndex('ArrowLeft', 0, COUNT)).toBe(COUNT - 1);
  });

  it('jumps to the first tab on Home and the last on End', () => {
    expect(resolveTabNavigationIndex('Home', 4, COUNT)).toBe(0);
    expect(resolveTabNavigationIndex('End', 4, COUNT)).toBe(COUNT - 1);
    expect(resolveTabNavigationIndex('Home', 0, COUNT)).toBe(0);
    expect(resolveTabNavigationIndex('End', COUNT - 1, COUNT)).toBe(COUNT - 1);
  });

  it('returns null for keys outside the tabs pattern', () => {
    for (const key of ['Enter', ' ', 'Tab', 'ArrowUp', 'ArrowDown', 'a', 'Escape']) {
      expect(resolveTabNavigationIndex(key, 3, COUNT)).toBeNull();
    }
  });

  it('stays put when there is only one tab', () => {
    expect(resolveTabNavigationIndex('ArrowRight', 0, 1)).toBe(0);
    expect(resolveTabNavigationIndex('ArrowLeft', 0, 1)).toBe(0);
    expect(resolveTabNavigationIndex('End', 0, 1)).toBe(0);
  });

  it('returns null rather than a negative index when there are no tabs', () => {
    expect(resolveTabNavigationIndex('ArrowRight', 0, 0)).toBeNull();
    expect(resolveTabNavigationIndex('End', 0, 0)).toBeNull();
    expect(resolveTabNavigationIndex('ArrowLeft', 0, -1)).toBeNull();
  });
});

describe('activateOnEnterOrSpace', () => {
  const card = {} as Element;

  // Minimal stand-in for React's synthetic keyboard event.
  const event = (key: string, target: Element = card) =>
    ({ key, target, currentTarget: card, preventDefault: vi.fn() }) as unknown as
      KeyboardEvent<Element> & { preventDefault: ReturnType<typeof vi.fn> };

  it('activates on Enter and Space, suppressing the default', () => {
    for (const key of ['Enter', ' ']) {
      const activate = vi.fn();
      const e = event(key);
      activateOnEnterOrSpace(activate)(e);
      expect(activate).toHaveBeenCalledOnce();
      expect(e.preventDefault).toHaveBeenCalledOnce();
    }
  });

  it('ignores every other key and leaves the default intact', () => {
    for (const key of ['Tab', 'Escape', 'a', 'ArrowDown', 'Spacebar']) {
      const activate = vi.fn();
      const e = event(key);
      activateOnEnterOrSpace(activate)(e);
      expect(activate).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
  });

  it('does not fire when the key came from a nested control', () => {
    // e.g. Enter on a button inside a clickable card must not also open the card.
    const activate = vi.fn();
    const e = event('Enter', {} as Element);
    activateOnEnterOrSpace(activate)(e);
    expect(activate).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
