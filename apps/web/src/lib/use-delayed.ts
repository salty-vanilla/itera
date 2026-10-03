import { useEffect, useState } from 'react';

/**
 * Spinners and loading words wait this long: work that ends sooner shows
 * none (DESIGN.md Spinner and Loading, docs/design/foundations.md Loading).
 */
export const LOADING_DELAY = 300;

/** True once `on` has stayed true for `LOADING_DELAY`. */
export function useDelayed(on: boolean): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setLate(true), LOADING_DELAY);
    return () => {
      clearTimeout(timer);
      setLate(false);
    };
  }, [on]);
  return on && late;
}
