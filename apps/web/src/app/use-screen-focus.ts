import { useRouter } from '@tanstack/react-router';
import { useEffect, type RefObject } from 'react';

/**
 * WCAG 2.4.3 (#154): moving to another screen, from the navigation or with
 * the browser's back and forward, puts the focus on the new screen's heading,
 * so the keyboard starts there and a screen reader reads where it landed.
 * Only the screen counts: a filter, a day or a detail changes the search and
 * keeps the focus where it is. The first screen opened keeps the browser's
 * start, where the first Tab reaches the skip link.
 */
export function useScreenFocus(mainRef: RefObject<HTMLElement | null>) {
  const router = useRouter();

  // After the render, not on the location: the location changes while the
  // previous screen is still shown, and its heading would take the focus.
  useEffect(
    () =>
      router.subscribe('onRendered', (event) => {
        if (event.fromLocation === undefined || !event.pathChanged) return;
        const heading = mainRef.current?.querySelector<HTMLElement>('h1');
        if (heading === null || heading === undefined) return;
        // A heading takes the focus without joining the Tab order.
        heading.tabIndex = -1;
        // The router opens the screen from the top (router.tsx).
        heading.focus({ preventScroll: true });
      }),
    [router, mainRef],
  );
}
