import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  scrollClearOfToasts,
  toastBox,
  useToasts,
} from '@/components/ui/toast';

/** A Toast follows the press that caused it within this time. */
const REACT_MS = 1000;

/** Text and controls that reach under the Toasts' columns (not scroll-bound). */
const CONTENT =
  'button, a, input, [role="checkbox"], li, p, h1, h2, h3, td, th';

/** Whether anything in `main` lies in the columns the Toasts are over. */
function underToasts(main: HTMLElement, toasts: DOMRect): boolean {
  return [...main.querySelectorAll(CONTENT)].some((el) => {
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.left < toasts.right && box.right > toasts.left;
  });
}

/**
 * Publishes the part of `main` the Toasts cover as `--toast-clearance` on it.
 * `main` pads its bottom by it; a screen whose panes have a face of their own
 * takes the room inside them instead (Planning), so that the faces reach the
 * bottom.
 */
function makeRoom(main: HTMLElement): DOMRect | undefined {
  const toasts = toastBox();
  // A bar stuck to the bottom of the screen: the Toasts are lifted above it
  // (lib/use-stuck-bar.ts), and room in `main` would lift the bar over
  // them. The room is left in the content before the bar instead, as
  // --toast-above-room (the Toasts' height and their gap to the bar), where
  // any content lies in the Toasts' columns.
  const above = parseFloat(
    document.documentElement.style.getPropertyValue('--toast-offset-above'),
  );
  const lifted = !Number.isNaN(above);
  const before =
    toasts === undefined || !lifted || !underToasts(main, toasts)
      ? 0
      : Math.max(0, main.getBoundingClientRect().bottom - toasts.top - above);
  if (before > 0) main.style.setProperty('--toast-above-room', `${before}px`);
  else main.style.removeProperty('--toast-above-room');
  // On a wide screen the content may stand clear of the Toasts sideways.
  const covered =
    toasts === undefined || lifted || !underToasts(main, toasts)
      ? 0
      : Math.max(0, main.getBoundingClientRect().bottom - toasts.top);
  if (covered > 0) main.style.setProperty('--toast-clearance', `${covered}px`);
  else main.style.removeProperty('--toast-clearance');
  return toasts;
}

/**
 * Makes room for the Toasts in the screen's scroll area (DESIGN.md Toast).
 * The Toasts lie over the bottom left of the screen; while they show,
 *
 * - `main` gets bottom padding (`--toast-clearance`) as tall as the part of
 *   it they cover, if any content lies in their columns, so
 *   that whatever is at the bottom (the last rows) can be scrolled clear of
 *   them. It goes with the Toasts. Content that fills the screen
 *   (`min-h-full`, `mt-auto`) rises by the same amount, as if the screen were
 *   that much shorter;
 * - what the person just pressed or typed in is scrolled up, by the least
 *   that it takes, if a Toast would cover it, and then a field whose save
 *   failed (#332).
 *
 * The Toasts are never moved for this; DESIGN.md fixes where they are. (A
 * bar stuck to the bottom of the screen lifts them instead
 * (lib/use-stuck-bar.ts). `main` gets no padding there, which would lift
 * the bar too; the screen puts `--toast-above-room` before the bar.)
 */
export function useToastClearance(mainRef: RefObject<HTMLElement | null>) {
  const toasts = useToasts();
  const last = useRef<{ target: Element; at: number } | null>(null);
  const seen = useRef(new Set<unknown>());

  // What the person last pressed or typed in, before the Toast appears.
  useEffect(() => {
    const remember = (event: Event) => {
      if (event.target instanceof Element) {
        // An item of a Menu lies outside the screen, in a portal: the row
        // that opened the Menu is what was pressed.
        const menu = event.target.closest('[role="menu"]');
        const opener =
          menu === null
            ? null
            : document.getElementById(
                menu.getAttribute('aria-labelledby') ?? '',
              );
        last.current = { target: opener ?? event.target, at: Date.now() };
      }
    };
    document.addEventListener('pointerdown', remember, true);
    document.addEventListener('keydown', remember, true);
    return () => {
      document.removeEventListener('pointerdown', remember, true);
      document.removeEventListener('keydown', remember, true);
    };
  }, []);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (main === null) return;
    const box = makeRoom(main);

    // Only for a Toast just shown or replaced (a new object), and for what
    // was pressed just before it.
    const shown = toasts.filter((t) => t.transitionStatus !== 'ending');
    const fresh = shown.some((t) => !seen.current.has(t));
    seen.current = new Set(shown);
    const target =
      last.current !== null && Date.now() - last.current.at < REACT_MS
        ? last.current.target
        : null;
    if (box === undefined || !fresh) return;

    // A field whose save failed keeps what was typed and says so (Field
    // `saveFailed`, #332): it is made clear last, so that it is what shows.
    // It may come after the Toast, and makes itself clear then.
    const clearFailed = () => {
      for (const field of document.querySelectorAll<HTMLElement>(
        '[data-save-failed]',
      ))
        scrollClearOfToasts(field, main.contains(field) ? main : null);
    };
    if (target === null) return clearFailed();

    const clear = (target: Element) => {
      if (!main.contains(target)) return;
      const el =
        target.closest<HTMLElement>(
          '[data-slot="task-row"], [data-slot="interrupt-row"], [data-slot="task-quick-add"]',
        ) ?? (target as HTMLElement);
      scrollClearOfToasts(el, main);
    };
    if (target.isConnected) {
      clear(target);
      clearFailed();
      return;
    }
    // What was pressed went away with the operation (a deleted row): the
    // screen moves the focus on in the next frame, and that is what the
    // Toast must not cover.
    // Not cancelled when the Toasts change again (their transition) before
    // then.
    requestAnimationFrame(() => {
      if (document.activeElement !== null) clear(document.activeElement);
      clearFailed();
    });
  }, [toasts, mainRef]);

  // Another screen, or content that comes late, has other content and other
  // stuck bars: measure again when `main` changes.
  useEffect(() => {
    const main = mainRef.current;
    if (main === null) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => makeRoom(main));
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [mainRef]);

  // The window's height changes where the Toasts are.
  useEffect(() => {
    const main = mainRef.current;
    if (main === null) return;
    const update = () => void makeRoom(main);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mainRef]);
}
