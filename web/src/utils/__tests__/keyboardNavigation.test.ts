// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type React from 'react';
import { activateOnEnterOrSpace, resolveTabNavigationIndex } from '../keyboardNavigation';

describe('keyboardNavigation', () => {
  describe('activateOnEnterOrSpace', () => {
    it('calls activate on Enter and Space keys when target equals currentTarget', () => {
      const mockActivate = vi.fn();
      const handler = activateOnEnterOrSpace(mockActivate);

      const targetEl = document.createElement('div');
      const enterEvent = {
        key: 'Enter',
        target: targetEl,
        currentTarget: targetEl,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>;

      handler(enterEvent);
      expect(mockActivate).toHaveBeenCalledTimes(1);
      expect(enterEvent.preventDefault).toHaveBeenCalled();

      const spaceEvent = {
        key: ' ',
        target: targetEl,
        currentTarget: targetEl,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>;

      handler(spaceEvent);
      expect(mockActivate).toHaveBeenCalledTimes(2);
    });

    it('does nothing on other keys or if event target is child element', () => {
      const mockActivate = vi.fn();
      const handler = activateOnEnterOrSpace(mockActivate);

      const parentEl = document.createElement('div');
      const childEl = document.createElement('button');

      const childEvent = {
        key: 'Enter',
        target: childEl,
        currentTarget: parentEl,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>;

      handler(childEvent);
      expect(mockActivate).not.toHaveBeenCalled();

      const arrowEvent = {
        key: 'ArrowDown',
        target: parentEl,
        currentTarget: parentEl,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>;

      handler(arrowEvent);
      expect(mockActivate).not.toHaveBeenCalled();
    });
  });

  describe('resolveTabNavigationIndex', () => {
    it('navigates next and previous with wrapping', () => {
      expect(resolveTabNavigationIndex('ArrowRight', 0, 3)).toBe(1);
      expect(resolveTabNavigationIndex('ArrowRight', 2, 3)).toBe(0);
      expect(resolveTabNavigationIndex('ArrowLeft', 0, 3)).toBe(2);
      expect(resolveTabNavigationIndex('ArrowLeft', 2, 3)).toBe(1);
    });

    it('handles Home and End keys', () => {
      expect(resolveTabNavigationIndex('Home', 2, 5)).toBe(0);
      expect(resolveTabNavigationIndex('End', 1, 5)).toBe(4);
    });

    it('returns null for unrelated keys or empty count', () => {
      expect(resolveTabNavigationIndex('Tab', 0, 3)).toBeNull();
      expect(resolveTabNavigationIndex('ArrowRight', 0, 0)).toBeNull();
    });
  });
});
