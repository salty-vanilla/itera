import { useRouter } from '@tanstack/react-router';
import { useEffect, type RefObject } from 'react';

/**
 * Puts the focus on the screen's heading (#154), the start of what the screen
 * decides. A heading takes the focus without joining the Tab order. The
 * `main` itself never takes it: a key pressed there would miss the screens'
 * shortcuts, which listen on the body and on their own content (Planning N).
 * Gives back the heading, or `undefined` when the screen has none yet.
 */
export function focusScreenHeading(
  main: HTMLElement | null,
  { preventScroll = false }: { preventScroll?: boolean } = {},
): HTMLElement | undefined {
  const heading = main?.querySelector<HTMLElement>('h1');
  if (heading === null || heading === undefined) return undefined;
  heading.tabIndex = -1;
  heading.focus({ preventScroll });
  return heading;
}

/**
 * WCAG 2.4.3 (#154): moving to another screen, from the navigation or with
 * the browser's back and forward, puts the focus on the new screen's heading,
 * so the keyboard starts there and a screen reader reads where it landed.
 * Only the screen counts: a filter, a day or a detail changes the search and
 * keeps the focus where it is. The first screen opened keeps the browser's
 * start, where the first Tab reaches the skip link.
 *
 * A screen whose records are still being read may have no heading yet, or
 * make it anew when they arrive (the screens on the contract, ADR 0005):
 * the focus then goes to the heading that is there, as long as it has not
 * been moved elsewhere in the meantime.
 */
export function useScreenFocus(mainRef: RefObject<HTMLElement | null>) {
  const router = useRouter();

  // After the render, not on the location: the location changes while the
  // previous screen is still shown, and its heading would take the focus.
  useEffect(() => {
    let watch: MutationObserver | undefined;
    const unsubscribe = router.subscribe('onRendered', (event) => {
      if (event.fromLocation === undefined || !event.pathChanged) return;
      watch?.disconnect();
      const main = mainRef.current;
      if (main === null) return;
      // The router places the scroll: the top of a new screen, or where
      // the entry was on back and forward (router.tsx, #111).
      let heading = focusScreenHeading(main, { preventScroll: true });
      const observer = new MutationObserver(() => {
        const moved = document.activeElement;
        if (heading?.isConnected === true) {
          // Still there: leave it, until the focus is taken elsewhere.
          if (moved !== heading) observer.disconnect();
          return;
        }
        // Gone, or not made yet. The focus has fallen to the page, or is
        // elsewhere (then it stays).
        if (moved !== document.body) observer.disconnect();
        else heading = focusScreenHeading(main, { preventScroll: true });
      });
      observer.observe(main, { childList: true, subtree: true });
      watch = observer;
    });
    return () => {
      unsubscribe();
      watch?.disconnect();
    };
  }, [router, mainRef]);
}
