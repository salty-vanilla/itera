import { useCallback, useRef } from 'react';

/**
 * For the operations of rows the person presses one after another, sent with
 * `useOperation`'s `whileSending: 'wait'`: a second press on the *same*
 * target while it is on its way is dropped (a double click would send the
 * same change twice and fail), and one on another target is sent after it,
 * in order, not thrown away (ADR 0005). `key` names the target: the
 * operation and the ID it is on. Gives back `undefined` for one that was
 * dropped.
 */
export function useOncePerTarget() {
  const onTheWay = useRef(new Set<string>());
  return useCallback(
    async <T>(key: string, send: () => Promise<T>): Promise<T | undefined> => {
      if (onTheWay.current.has(key)) return undefined;
      onTheWay.current.add(key);
      try {
        return await send();
      } finally {
        onTheWay.current.delete(key);
      }
    },
    [],
  );
}
