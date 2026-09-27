/**
 * Under `exactOptionalPropertyTypes` an absent key and `undefined` differ,
 * so clearing an optional attribute must drop the key. These helpers return
 * copies; records are never mutated.
 */

/** Sets an optional key, or drops it when `value` is `null`. */
export function withOptional<T extends object, K extends keyof T>(
  record: T,
  key: K,
  value: Exclude<T[K], undefined> | null,
): T {
  if (value !== null) return { ...record, [key]: value };
  return omit(record, key);
}

/** A copy of `record` without `keys`. */
export function omit<T extends object, K extends keyof T>(
  record: T,
  ...keys: readonly K[]
): T {
  const copy = { ...record };
  for (const key of keys) delete copy[key];
  return copy;
}
