import { createContext, use, useCallback } from 'react';

/**
 * The targets whose operation is on its way, for every screen and hook below
 * one `ApiProvider`: the same operation on the same target pressed from two
 * places (a row and the detail beside it) is one press.
 */
const OnTheWayContext = createContext<Set<string> | null>(null);

/**
 * For the operations of rows the person presses one after another, sent with
 * `useOperation`'s `whileSending: 'wait'`: a second press on the *same*
 * target while it is on its way is dropped (a double click would send the
 * same change twice and fail), and one on another target is sent after it,
 * in order, not thrown away (ADR 0005). `key` names the target: the
 * operation and the ID it is on. The keys are shared by every hook below
 * the `ApiProvider`, so the same operation on the same ID gets the same key
 * wherever it is pressed (a row and the detail), and two operations never
 * share one. Gives back `undefined` for one that was dropped.
 */
export function useOncePerTarget() {
  const onTheWay = use(OnTheWayContext);
  if (onTheWay === null)
    throw new Error('useOncePerTarget needs an ApiProvider.');
  return useCallback(
    async <T>(key: string, send: () => Promise<T>): Promise<T | undefined> => {
      if (onTheWay.has(key)) return undefined;
      onTheWay.add(key);
      try {
        return await send();
      } finally {
        onTheWay.delete(key);
      }
    },
    [onTheWay],
  );
}

export { OnTheWayContext };
