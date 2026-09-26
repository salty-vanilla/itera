import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The theme set on <html data-theme>, updated when the toolbar changes it. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => 'light');
}
