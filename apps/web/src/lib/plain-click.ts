import type { MouseEvent } from 'react';

/** A plain left click; others (a new tab, a download) stay with the browser. */
export function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
