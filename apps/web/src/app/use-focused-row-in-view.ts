import { useEffect, type RefObject } from 'react';

/**
 * The title of a Task row draws the focus ring round the whole row
 * (components/task/task-row.tsx), but the browser scrolls only the title into
 * view. When the focus comes by the keyboard, the row is scrolled in as well,
 * so that its ring is not left under a bar stuck to the bottom or the top of
 * `main` (#152); the row's scroll margin keeps it clear of the bars
 * (styles/globals.css).
 */
export function useFocusedRowInView(mainRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const main = mainRef.current;
    if (main === null) return;
    const reveal = (event: FocusEvent) => {
      const { target } = event;
      if (
        !(target instanceof HTMLElement) ||
        !target.hasAttribute('data-row-focus') ||
        !target.matches(':focus-visible')
      ) {
        return;
      }
      target
        .closest('[data-slot="task-row"]')
        ?.scrollIntoView?.({ block: 'nearest' });
    };
    main.addEventListener('focusin', reveal);
    return () => main.removeEventListener('focusin', reveal);
  }, [mainRef]);
}
