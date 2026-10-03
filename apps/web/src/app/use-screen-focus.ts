import { useRouter } from '@tanstack/react-router';
import { useEffect, type RefObject } from 'react';

/**
 * Puts the focus on the screen's heading (#154), the start of what the screen
 * decides. A heading takes the focus without joining the Tab order. The
 * `main` itself never takes it: a key pressed there would miss the screens'
 * shortcuts, which listen on the body and on their own content (Planning N).
 */
export function focusScreenHeading(
  main: HTMLElement | null,
  { preventScroll = false }: { preventScroll?: boolean } = {},
) {
  const heading = main?.querySelector<HTMLElement>('h1');
  if (main === null || heading === null || heading === undefined) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll });
  keepOnHeading(main, heading, preventScroll);
}

/**
 * A screen whose records are still being read shows a heading of its own,
 * and the one it has once they are in replaces it. The focus on the first
 * would be lost with it, so it moves to the second, if nothing else has
 * taken the focus meanwhile (the person pressing or clicking anywhere
 * leaves it be).
 */
function keepOnHeading(
  main: HTMLElement,
  heading: HTMLElement,
  preventScroll: boolean,
) {
  const stop = () => {
    observer.disconnect();
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('pointerdown', stop, true);
    document.removeEventListener('keydown', stop, true);
    window.clearTimeout(timer);
  };
  const observer = new MutationObserver(() => {
    if (heading.isConnected) return;
    stop();
    // Focus lost with the heading: it is on the body again.
    if (document.activeElement !== document.body) return;
    const next = main.querySelector<HTMLElement>('h1');
    if (next === null) return;
    next.tabIndex = -1;
    next.focus({ preventScroll });
  });
  const onFocusIn = (event: FocusEvent) => {
    if (event.target !== heading) stop();
  };
  const timer = window.setTimeout(stop, 10_000);
  observer.observe(main, { childList: true, subtree: true });
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('pointerdown', stop, true);
  document.addEventListener('keydown', stop, true);
}

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
        // The router places the scroll: the top of a new screen, or where
        // the entry was on back and forward (router.tsx, #111).
        focusScreenHeading(mainRef.current, { preventScroll: true });
      }),
    [router, mainRef],
  );
}
