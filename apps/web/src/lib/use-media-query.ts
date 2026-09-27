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

// DESIGN.md Layout › Responsive: compact is under `bp-medium` (768px).
export const MEDIUM_UP = '(min-width: 768px)';
