import { useSyncExternalStore } from 'react';

// Matches a media query and follows its changes. Where matchMedia does not
// exist (jsdom, server rendering) it returns `fallback`.
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {};
      }
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () =>
      typeof window === 'undefined' || !window.matchMedia
        ? fallback
        : window.matchMedia(query).matches,
    () => fallback,
  );
}

// DESIGN.md Layout › Responsive: compact is under `bp-medium` (768px at the
// default font size). The `medium:` variant of styles/globals.css (#433).
export const MEDIUM_UP = '(width >= 48em)';

// Text enlarged by the browser's font size: the `enlarged:` variant of
// styles/globals.css (em follows the browser's font size, so this is under
// 320px at the default and under 640px at 200%, #393).
export const ENLARGED = '(width < 20em)';
