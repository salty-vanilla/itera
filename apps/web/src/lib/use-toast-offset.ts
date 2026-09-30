import { useEffect, type RefObject } from 'react';

/**
 * Lifts the Toast above a bar that is stuck to the bottom of the screen
 * (the Quick Add of Today; of Backlog under 768px), so that the Toast does
 * not cover it, at any width. The
 * Toast reads `--toast-offset-above` (components/ui/toast.tsx); it is the
 * bar's height while `active`, and is removed when the bar goes.
 */
export function useToastOffsetAbove(
  ref: RefObject<HTMLElement | null>,
  active = true,
) {
  useEffect(() => {
    const el = ref.current;
    if (el === null || !active) return;
    const root = document.documentElement;
    const set = () =>
      root.style.setProperty('--toast-offset-above', `${el.offsetHeight}px`);
    set();
    // Where ResizeObserver does not exist (jsdom) the first height stays.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(set);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--toast-offset-above');
    };
  }, [ref, active]);
}
