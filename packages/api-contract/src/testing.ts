// Helpers for the tests that hold the contract against packages/application.
import type { Id } from '@itera/domain';
import * as contract from './index';

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

/** The ID schemas of the contract, by the kind of ID (packages/domain). */
export const ID_SCHEMAS = {
  User: contract.vUserId,
  Area: contract.vAreaId,
  Task: contract.vTaskId,
  Subtask: contract.vSubtaskId,
  EstimateSuggestion: contract.vEstimateSuggestionId,
  RecurrenceRule: contract.vRecurrenceRuleId,
  Occurrence: contract.vOccurrenceId,
  Sprint: contract.vSprintId,
  SprintTask: contract.vSprintTaskId,
  DailySelection: contract.vDailySelectionId,
  InterruptNote: contract.vInterruptNoteId,
  PlanningCriterion: contract.vPlanningCriterionId,
} as const;

type Schema = {
  readonly type?: string;
  readonly entries?: Record<string, unknown>;
  readonly wrapped?: unknown;
  readonly item?: unknown;
  readonly options?: readonly unknown[];
};

/**
 * Which kind of ID each property of a Valibot schema takes, as the contract
 * says: the kind's name for an ID (or a list of them), the same for an
 * object's properties, and `undefined` where there is no ID. A union of
 * shapes is not followed (the reads' fixture test covers those).
 */
export function idKindsOf(schema: unknown): unknown {
  const kind = Object.entries(ID_SCHEMAS).find(([, s]) => s === schema)?.[0];
  if (kind !== undefined) return kind;
  const s = schema as Schema;
  if (s.wrapped !== undefined) return idKindsOf(s.wrapped);
  if (s.type === 'array') return idKindsOf(s.item);
  if (s.entries !== undefined) {
    const kinds = Object.entries(s.entries).flatMap(([key, value]) => {
      const of = idKindsOf(value);
      return of === undefined ? [] : [[key, of] as const];
    });
    return kinds.length === 0 ? undefined : Object.fromEntries(kinds);
  }
  return undefined;
}

/**
 * Which kind of ID each property of a type takes, as packages/domain's
 * branded IDs say: the same shape as `idKindsOf` gives for the contract.
 * Unions of shapes are not followed, as there.
 */
export type IdKinds<T> = [KindOf<T>] extends [never]
  ? [T] extends [object]
    ? ObjectKinds<T>
    : never
  : KindOf<T>;

type KindOf<T> = T extends Id<infer Kind> ? Kind : never;
type Item<T> = NonNullable<T> extends readonly (infer U)[] ? U : NonNullable<T>;
type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;
type ObjectKinds<T> =
  IsUnion<T> extends true
    ? never
    : {
          [
            K in keyof T as [IdKinds<Item<T[K]>>] extends [never] ? never : K
          ]-?: IdKinds<Item<T[K]>>;
        } extends infer O
      ? [keyof O] extends [never]
        ? never
        : O
      : never;
