import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useToastsKey } from '@/components/ui/toast';

/** A Toast follows the press that caused it within this time. */
const REACT_MS = 1000;

/** Room left between the Toast and the row it made way for. */
const GAP = 8;

/** The nearest ancestor that scrolls vertically. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
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

/** Sets the padding of `main` to the part of it the Toasts cover. */
function makeRoom(main: HTMLElement): DOMRect | undefined {
  const toasts = toastBox();
  const covered =
    toasts === undefined
      ? 0
      : Math.max(0, main.getBoundingClientRect().bottom - toasts.top);
  main.style.paddingBottom = covered > 0 ? `${covered}px` : '';
  return toasts;
}

/**
 * Makes room for the Toasts in the screen's scroll area (DESIGN.md Toast).
 * The Toast lies over the bottom left of the screen; while it shows,
 *
 * - `main` gets bottom padding as tall as the part of it the Toasts cover,
 *   so that whatever is at the bottom (the last rows, the Quick Add) can be
 *   scrolled clear of them. It goes with the Toast, and nothing moves when
 *   it comes;
 * - what the person just pressed or typed in is scrolled up, by the least
 *   that it takes, if a Toast would cover it.
 *
 * Toasts are never moved for this; DESIGN.md fixes where they are.
 */
export function useToastClearance(mainRef: RefObject<HTMLElement | null>) {
  const key = useToastsKey();
  const last = useRef<{ target: Element; at: number } | null>(null);
  const shown = useRef(new Set<string>());

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
    const toasts = makeRoom(main);
    if (toasts === undefined) {
      shown.current.clear();
      return;
    }

    // Only for a Toast just shown or replaced, and for what was pressed
    // just before it.
    const entries = key.split('|').filter((e) => !e.endsWith(':ending'));
    const fresh = entries.some((e) => !shown.current.has(e));
    shown.current = new Set(entries);
    const target =
      last.current !== null && Date.now() - last.current.at < REACT_MS
        ? last.current.target
        : null;
    if (!fresh || target === null || !main.contains(target)) return;
    const el =
      target.closest<HTMLElement>(
        '[data-slot="task-row"], [data-slot="task-quick-add"]',
      ) ?? (target as HTMLElement);
    const box = el.getBoundingClientRect();
    const overlaps =
      box.left < toasts.right &&
      box.right > toasts.left &&
      box.bottom > toasts.top &&
      box.top < toasts.bottom;
    if (!overlaps) return;
    (scrollParent(el) ?? main).scrollBy({
      top: box.bottom - toasts.top + GAP,
    });
  }, [key, mainRef]);

  // The window's height changes where the Toasts are.
  useEffect(() => {
    const main = mainRef.current;
    if (main === null) return;
    const update = () => void makeRoom(main);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mainRef]);
}
