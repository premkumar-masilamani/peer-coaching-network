import type { KeyboardEvent } from 'react';

/**
 * Enter/Space activation for elements that must carry `role="button"` because
 * their content is flow content and cannot legally live inside a `<button>`
 * (e.g. a clickable card containing a heading). Prefer a real `<button>`.
 *
 * Space is activated on keyup by native buttons, but keydown is the common
 * approximation; preventDefault stops Space from scrolling the page.
 */
export const activateOnEnterOrSpace =
  <T extends Element>(activate: () => void) =>
  (e: KeyboardEvent<T>): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // Let inner controls (buttons, links, inputs) handle their own keys.
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    activate();
  };

/**
 * Index math for the WAI-ARIA tabs keyboard pattern.
 *
 * Arrow keys wrap around both ends; Home/End jump to the first/last tab.
 * Returns `null` when the key is not part of the pattern, so callers know
 * not to preventDefault.
 */
export const resolveTabNavigationIndex = (
  key: string,
  currentIndex: number,
  count: number
): number | null => {
  if (count <= 0) return null;

  switch (key) {
    case 'ArrowRight':
      return (currentIndex + 1) % count;
    case 'ArrowLeft':
      return (currentIndex - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
};
