import { useEffect } from 'react';

/**
 * A hook that registers a listener for the window focus event
 * and executes the provided callback when focus is regained.
 * 
 * @param callback The function to execute on window focus
 */
export const useFocusRefresh = (callback: () => void) => {
  useEffect(() => {
    const handleFocus = () => {
      callback();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [callback]);
};
