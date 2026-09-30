import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useToasts } from '@/components/ui/toast';

/** A Toast follows the press that caused it within this time. */
const REACT_MS = 1000;
/** Room left between the Toast and the row it made way for. */
const GAP = 8;

/** The nearest ancestor that scrolls vertically. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    if (
      /(auto|scroll)/.test(getComputedStyle(p).overflowY) &&
      p.scrollHeight > p.clientHeight
    ) {
      return p;
    }
  }
  return null;
}

/** The Toasts' box, or `undefined` while none shows (it has no height). */
function toastBox(): DOMRect | undefined {
  const box = document
    .querySelector('[data-slot="toast-viewport"]')
    ?.getBoundingClientRect();
  return box === undefined || box.height === 0 ? undefined : box;
}

/**
 * Publishes the part of `main` the Toasts cover as `--toast-clearance` on it.
 * `main` pads its bottom by it; a screen whose panes have a face of their own
 * takes the room inside them instead (Planning), so that the faces reach the
 * bottom.
 */
function makeRoom(main: HTMLElement): DOMRect | undefined {
  const toasts = toastBox();
  // A bar stuck to the bottom of a compact screen: the Toasts are lifted
  // above it (lib/use-toast-offset.ts), and room in `main` would lift the bar
  // over them.
  const lifted =
    document.documentElement.style.getPropertyValue('--toast-offset-above') !==
    '';
  const covered =
    toasts === undefined || lifted
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
 *   it they cover, so
 *   that whatever is at the bottom (the last rows, the Quick Add) can be
 *   scrolled clear of them. It goes with the Toasts. Content that fills the
 *   screen (`min-h-full`, `mt-auto`, a sticky bar at the end) rises by the
 *   same amount, as if the screen were that much shorter;
 * - what the person just pressed or typed in is scrolled up, by the least
 *   that it takes, if a Toast would cover it.
 *
 * The Toasts are never moved for this; DESIGN.md fixes where they are. (A
 * bar stuck to the bottom of a compact screen lifts them instead, and no
 * room is added there: lib/use-toast-offset.ts.)
 */
export function useToastClearance(mainRef: RefObject<HTMLElement | null>) {
  const toasts = useToasts();
  const last = useRef<{ target: Element; at: number } | null>(null);
  const seen = useRef(new Set<unknown>());

  // What the person last pressed or typed in, before the Toast appears.
  useEffect(() => {
    const remember = (event: Event) => {
      if (event.target instanceof Element) {
        last.current = { target: event.target, at: Date.now() };
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
    if (box === undefined || !fresh || target === null) return;
    if (!main.contains(target)) return;

    const el =
      target.closest<HTMLElement>(
        '[data-slot="task-row"], [data-slot="task-quick-add"]',
      ) ?? (target as HTMLElement);
    const rect = el.getBoundingClientRect();
    const overlaps =
      rect.left < box.right &&
      rect.right > box.left &&
      rect.bottom > box.top &&
      rect.top < box.bottom;
    if (!overlaps) return;
    (scrollParent(el) ?? main).scrollBy({
      top: rect.bottom - box.top + GAP,
    });
  }, [toasts, mainRef]);

  // The window's height changes where the Toasts are.
  useEffect(() => {
    const main = mainRef.current;
    if (main === null) return;
    const update = () => void makeRoom(main);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mainRef]);
}
