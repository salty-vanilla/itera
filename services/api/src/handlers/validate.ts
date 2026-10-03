import { parseInstant, parseLocalDate } from '@itera/domain';
import * as v from 'valibot';
import { ApiError } from '../errors';

// Checks a request against the contract's Valibot schemas (ADR 0006): the
// shape and formats, and that every date and time in it exists on the
// calendar. Only the schema's output goes further; unknown keys of shared
// objects are dropped by it.

type Schema = v.GenericSchema;

/**
 * The parts of a generated schema that hold other schemas. The contract's
 * generated schemas use only these (and leaves: string, number, boolean,
 * literal, picklist, void); `walk` throws on anything else, so that a new
 * kind in the contract is noticed (validate.test.ts walks every request
 * schema).
 */
type Node = {
  readonly type: string;
  readonly pipe?: readonly { readonly type: string }[];
  readonly entries?: Readonly<Record<string, Schema>>;
  readonly wrapped?: Schema;
  readonly item?: Schema;
  readonly value?: Schema;
  readonly options?: readonly Schema[];
};

const leaves = new Set([
  'string',
  'number',
  'boolean',
  'literal',
  'picklist',
  'void',
]);

type Visit = (kind: 'date' | 'instant', value: string, path: string) => void;

/**
 * Walks `value` (already valid for `schema`) along the schema, calling
 * `visit` for each LocalDate (`isoDate`) and Instant (`isoTimestamp`).
 */
function walk(schema: Schema, value: unknown, path: string, visit: Visit) {
  const node = schema as unknown as Node;
  switch (node.type) {
    case 'object':
    case 'strict_object':
      for (const [key, entry] of Object.entries(node.entries ?? {})) {
        const field = (value as Record<string, unknown>)[key];
        if (field !== undefined) walk(entry, field, `${path}.${key}`, visit);
      }
      return;
    case 'optional':
    case 'nullable':
    case 'nullish':
      if (value !== undefined && value !== null)
        walk(node.wrapped as Schema, value, path, visit);
      return;
    case 'array':
      (value as readonly unknown[]).forEach((item, i) =>
        walk(node.item as Schema, item, `${path}[${i}]`, visit),
      );
      return;
    case 'record':
      for (const [key, item] of Object.entries(value as object))
        walk(node.value as Schema, item, `${path}.${key}`, visit);
      return;
    case 'union': {
      const option = node.options?.find((o) => v.is(o, value));
      if (option !== undefined) walk(option, value, path, visit);
      return;
    }
    default: {
      if (!leaves.has(node.type)) {
        throw new Error(`validate.ts does not know the schema ${node.type}.`);
      }
      const actions = node.pipe?.map((action) => action.type) ?? [];
      if (actions.includes('iso_date')) visit('date', value as string, path);
      if (actions.includes('iso_timestamp'))
        visit('instant', value as string, path);
    }
  }
}

/** Every schema kind in `schema` is one `walk` knows. Throws otherwise. */
export function assertWalkable(schema: Schema): void {
  const node = schema as unknown as Node;
  if (leaves.has(node.type)) return;
  const inner: readonly (Schema | undefined)[] | undefined = {
    object: Object.values(node.entries ?? {}),
    strict_object: Object.values(node.entries ?? {}),
    optional: [node.wrapped],
    nullable: [node.wrapped],
    nullish: [node.wrapped],
    array: [node.item],
    record: [node.value],
    union: node.options,
  }[node.type];
  if (inner === undefined) {
    throw new Error(`validate.ts does not know the schema ${node.type}.`);
  }
  for (const child of inner) assertWalkable(child as Schema);
}

/**
 * The value as the contract describes it, or a 400 `validationFailed`.
 * Valibot's format checks do not reject a day that does not exist (2026-02-30),
 * so dates and times are also read with the domain's parsers (ADR 0006).
 */
export function validate<S extends Schema>(
  schema: S,
  value: unknown,
  what: string,
): v.InferOutput<S> {
  const result = v.safeParse(schema, value);
  if (!result.success) {
    const [issue] = result.issues;
    const at = v.getDotPath(issue);
    throw new ApiError(
      'validationFailed',
      `${what}${at === null ? '' : `.${at}`}: ${issue.message}`,
    );
  }
  walk(schema, result.output, what, (kind, text, path) => {
    const parsed = kind === 'date' ? parseLocalDate(text) : parseInstant(text);
    if (!parsed.ok) {
      throw new ApiError(
        'validationFailed',
        `${path}: ${parsed.error.message}`,
      );
    }
  });
  return result.output;
}

/**
 * A query string as the query schema declares it. Query values arrive as
 * strings; numbers and booleans are turned into their type first (ADR
 * 0006). A value that does not convert stays a string and fails validation.
 */
export function queryInput(
  schema: Schema,
  query: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const entries = (schema as unknown as Node).entries ?? {};
  return Object.fromEntries(
    Object.entries(query).map(([key, text]) => {
      const entry = entries[key];
      return [key, entry === undefined ? text : converted(entry, text)];
    }),
  );
}

function converted(schema: Schema, text: string): unknown {
  let node = schema as unknown as Node;
  while (node.wrapped !== undefined) node = node.wrapped as unknown as Node;
  // Decimal digits only: `Number` would also take ` 2`, `0x10` and `1e1`.
  if (node.type === 'number') {
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
  }
  if (node.type === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
  }
  return text;
}
