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
