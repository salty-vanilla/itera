import { useEffect, type RefObject } from 'react';

/**
 * Publishes the height of a bar stuck to the top or the bottom of `main`
 * (the Quick Add of Today; of Backlog under 768px; the Capacity line of
 * Planning under 1200px) while `active`, and removes it when the bar goes.
 *
 * - `--stuck-bar-top` / `--stuck-bar-bottom`: what is in `main` and not in
 *   the bar (marked `data-stuck-bar`) takes them as its scroll margin
 *   (styles/globals.css), so that what takes the focus scrolls clear of the
 *   bar instead of staying under it (WCAG 2.4.11, #152).
 * - `--toast-offset-above` (bottom only): the Toast is lifted above the bar
 *   (components/ui/toast.tsx), so that it does not cover it, at any width.
 *
 * A bar hidden at some width (`display: none`) is 0 there.
 */
export function useStuckBar(
  ref: RefObject<HTMLElement | null>,
  edge: 'top' | 'bottom',
  active = true,
) {
  useEffect(() => {
    const el = ref.current;
    if (el === null || !active) return;
    const root = document.documentElement;
    const names =
      edge === 'top'
        ? ['--stuck-bar-top']
        : ['--stuck-bar-bottom', '--toast-offset-above'];
    el.dataset.stuckBar = edge;
    const set = () => {
      for (const name of names) {
        root.style.setProperty(name, `${el.offsetHeight}px`);
      }
    };
    set();
    // Where ResizeObserver does not exist (jsdom) the first height stays.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(set);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      delete el.dataset.stuckBar;
      for (const name of names) root.style.removeProperty(name);
    };
  }, [ref, edge, active]);
}
