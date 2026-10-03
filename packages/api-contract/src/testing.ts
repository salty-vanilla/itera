// Helpers for the tests that hold the contract against packages/application.

/**
 * A type as JSON carries it: IDs, dates and other branded strings become
 * `string`, `readonly` goes, and intersections become one object. The
 * generated types have no brands and no `readonly`; this makes both sides
 * comparable.
 */
export type Plain<T> = T extends string
  ? [Exclude<keyof T, keyof string>] extends [never]
    ? T
    : string
  : T extends number | boolean | null | undefined | void
    ? T
    : T extends readonly (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { -readonly [K in keyof T as PlainKey<K>]: Plain<T[K]> }
        : T;

type PlainKey<K> = K extends string ? Plain<K> : K;

/** A read's result as the response carries it: `undefined` becomes `null`. */
export type WithNull<T> =
  Exclude<T, undefined> | (undefined extends T ? null : never);

/** Whether two types are the same (not only assignable both ways). */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
