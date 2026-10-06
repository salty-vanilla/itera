// What `breaking.mjs` makes of oasdiff's findings: the rules of ADR 0006
// 「互換の規則」 that oasdiff does not know, and how `info.version` must move.
// Kept apart from oasdiff and git so that the tests can run them.

/**
 * A change as oasdiff's `breaking --format json` reports it.
 * @typedef {{ id: string, text: string, level: number, operation?: string, path?: string }} Change
 */

// oasdiff's levels in its JSON output.
export const ERR = 3;
export const WARN = 2;

/**
 * oasdiff's levels that ADR 0006 「壊す変更」 sets otherwise, as oasdiff's
 * `--severity-levels` file reads them. oasdiff takes these as a warning or
 * as compatible:
 * - Removing a property from a request (the body refuses keys it does not
 *   know with 400), or an optional one from a response.
 * - Removing an optional response header: the Web sends `ETag` back in
 *   `If-Match`.
 * - Renaming an operation (its `operationId`, the name of the generated
 *   function and of `useOperation`), and removing one that was deprecated
 *   first: the ADR has no deprecation that makes a removal compatible.
 */
export const LEVELS = [
  'request-property-removed err',
  'response-optional-property-removed err',
  'optional-response-header-removed err',
  'api-operation-id-removed err',
  'api-removed-with-deprecation err',
  'api-path-removed-with-deprecation err',
].join('\n');

const ERROR_STATUS = /for the response status `[45]\d\d`/;
// The error's own `type`, at the top of its body or of one of its branches.
const TYPE_PROPERTY = /`(?:oneOf\[[^\]`]*\]\/)?type` response property/;
// oasdiff names a property by its path from the response body, and the
// response by its status.
const ENUM_PROPERTY =
  /enum value to the `([^`]+)` response property for the response status `([^`]+)`/;
const OPEN_ENUM = /^Open enum\./;

/** @typedef {Record<string, unknown>} Schema */

/** @param {unknown} value @returns {value is Schema} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The schema behind a `$ref` into the bundled contract (`#/components/…`),
 * or the schema itself.
 * @param {unknown} spec @param {unknown} node
 * @returns {Schema | undefined}
 */
function deref(spec, node) {
  let current = node;
  for (let depth = 0; isRecord(current); depth += 1) {
    const ref = current['$ref'];
    if (typeof ref !== 'string') return current;
    if (!ref.startsWith('#/') || depth > 16) return undefined;
    current = ref
      .slice(2)
      .split('/')
      .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
      .reduce(
        (/** @type {unknown} */ at, key) =>
          isRecord(at) ? at[key] : undefined,
        spec,
      );
  }
  return undefined;
}

/**
 * The schema and, because oasdiff flattens `allOf`, the schemas it is
 * made of.
 * @param {unknown} spec @param {Schema} schema
 * @returns {Schema[]}
 */
function parts(spec, schema) {
  const allOf = Array.isArray(schema['allOf']) ? schema['allOf'] : [];
  return [
    schema,
    ...allOf.flatMap((member) => {
      const resolved = deref(spec, member);
      return resolved ? parts(spec, resolved) : [];
    }),
  ];
}

/** The segments of an oasdiff property path; a `/` inside `[…]` stays. */
function segments(/** @type {string} */ path) {
  return path.split(/\/(?![^[]*\])/);
}

/**
 * Where one segment of an oasdiff property path leads from `schema`: a
 * property, `items`, `additionalProperties`, or a branch of a `oneOf` /
 * `anyOf`, named by its `$ref` (`oneOf[#/components/schemas/X]`) or by its
 * place in the list (`oneOf[subschema #2: Title]`, counted from 1). A
 * branch that is not where it was in the other contract is written
 * `oneOf[<in the base> -> <in the head>]`, so `side` picks the part for the
 * contract that `spec` is.
 * @param {unknown} spec @param {Schema} schema @param {string} segment
 * @param {'base' | 'head'} side
 * @returns {Schema[]}
 */
function follow(spec, schema, segment, side) {
  const branch = /^(oneOf|anyOf)\[(.*)\]$/.exec(segment);
  const named = (branch?.[2] ?? '').split(' -> ');
  const name = side === 'base' ? named[0] : named[named.length - 1];
  const found = parts(spec, schema).flatMap((part) => {
    if (branch) {
      const list = part[/** @type {string} */ (branch[1])];
      if (!Array.isArray(list)) return [];
      const place = /^subschema #(\d+)/.exec(name ?? '');
      return place
        ? [list[Number(place[1]) - 1]]
        : list.filter((b) => isRecord(b) && b['$ref'] === name);
    }
    // oasdiff writes `items` for the keyword and for a property of that
    // name alike (the Backlog's `items`), so both are followed.
    const properties = part['properties'];
    return [
      ...(isRecord(properties) ? [properties[segment]] : []),
      ...(segment === 'items' || segment === 'additionalProperties'
        ? [part[segment]]
        : []),
    ];
  });
  return found.flatMap((node) => {
    const schema = deref(spec, node);
    return schema ? [schema] : [];
  });
}

/**
 * Whether the enum that a change adds a value to says `Open enum.` at the
 * start of its description (ADR 0006 「列挙」) in one of the bundled
 * contracts. oasdiff names the property by its path, not the schema it
 * comes from, so the path is followed from the response. A path that cannot
 * be followed is not open.
 * @param {Change} change @param {unknown} spec @param {'base' | 'head'} side
 */
function declaresOpenEnum(change, spec, side) {
  const match = ENUM_PROPERTY.exec(change.text);
  if (!match || !change.operation || !change.path) return false;
  const operation = isRecord(spec)
    ? deref(spec, /** @type {Schema} */ (spec['paths'])?.[change.path])?.[
        change.operation.toLowerCase()
      ]
    : undefined;
  const responses = isRecord(operation) ? operation['responses'] : undefined;
  const response = isRecord(responses)
    ? deref(spec, responses[/** @type {string} */ (match[2])])
    : undefined;
  const content = response?.['content'];
  if (!isRecord(content)) return false;
  let at = Object.values(content).flatMap((media) => {
    const schema = isRecord(media) ? deref(spec, media['schema']) : undefined;
    return schema ? [schema] : [];
  });
  for (const segment of segments(/** @type {string} */ (match[1]))) {
    if (segment === '') continue;
    at = at.flatMap((schema) => follow(spec, schema, segment, side));
  }
  const enums = at.flatMap((schema) =>
    parts(spec, schema).filter((part) => Array.isArray(part['enum'])),
  );
  return (
    enums.length > 0 &&
    enums.every((e) => OPEN_ENUM.test(String(e['description'] ?? '')))
  );
}

/**
 * The bundled contracts at the base and at the head.
 * @typedef {{ base: unknown, head: unknown }} Contracts
 */

/**
 * Whether oasdiff counts the change as breaking where ADR 0006 「列挙」 does
 * not: a value added to an enum whose description says `Open enum.` in the
 * base and in the head (an enum that was closed and is opened with the value
 * is a breaking change of its own, which only a review sees), and the error
 * bodies, an open enum too, so a branch added to an error response's
 * `oneOf`, or a value added to an error's `type`, does not break a client
 * that reads unknown errors as a general failure.
 * @param {Change} change
 * @param {Contracts} [contracts]
 */
export function isOpenEnumAddition(change, contracts) {
  if (
    change.id === 'response-property-enum-value-added' &&
    contracts &&
    declaresOpenEnum(change, contracts.base, 'base') &&
    declaresOpenEnum(change, contracts.head, 'head')
  ) {
    return true;
  }
  if (!ERROR_STATUS.test(change.text)) return false;
  if (change.id === 'response-body-one-of-added') return true;
  return (
    change.id === 'response-property-enum-value-added' &&
    TYPE_PROPERTY.test(change.text)
  );
}

/** @param {string} version */
export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map(Number) : undefined;
}

/** @param {number[]} a @param {number[]} b */
function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Whether `head` is a version that a breaking change may have after `base`:
 * a higher major, or while the major is 0 (until the first release to
 * production) a higher minor (ADR 0006 「壊す変更をするとき」).
 * @param {number[]} base @param {number[]} head
 */
export function allowsBreaking(base, head) {
  const [baseMajor = 0, baseMinor = 0] = base;
  const [headMajor = 0, headMinor = 0] = head;
  if (headMajor !== baseMajor) return headMajor > baseMajor;
  return baseMajor === 0 && headMinor > baseMinor;
}

/**
 * Sorts oasdiff's changes by ADR 0006 and checks `info.version`.
 * `problems` is what the check fails on (or warns about, while it only
 * warns).
 * `contracts` are the bundled contracts, where an enum says whether it is
 * open.
 * @param {{ changes: Change[], base: string, head: string, contracts?: Contracts }} input
 */
export function assess({ changes, base, head, contracts }) {
  const breaking = changes.filter(
    (c) => c.level >= ERR && !isOpenEnumAddition(c, contracts),
  );
  const open = changes.filter(
    (c) => c.level >= ERR && isOpenEnumAddition(c, contracts),
  );
  const potential = changes.filter((c) => c.level === WARN);
  /** @type {string[]} */
  const problems = [];
  const baseVersion = parseVersion(base);
  const headVersion = parseVersion(head);
  if (!baseVersion || !headVersion) {
    problems.push(
      `info.version must be MAJOR.MINOR.PATCH, but it is ${base} on the base and ${head} here.`,
    );
  } else if (compareVersions(headVersion, baseVersion) < 0) {
    problems.push(`info.version went down from ${base} to ${head}.`);
  } else if (breaking.length > 0 && !allowsBreaking(baseVersion, headVersion)) {
    const next =
      baseVersion[0] === 0
        ? `0.${(baseVersion[1] ?? 0) + 1}.0`
        : `${(baseVersion[0] ?? 0) + 1}.0.0`;
    problems.push(
      `The contract has ${breaking.length} breaking change(s) but info.version ` +
        `goes from ${base} to ${head}. Raise it to ${next} and add a revision ` +
        `line to ADR 0006 (「壊す変更をするとき」), or keep the change compatible.`,
    );
  }
  return { breaking, open, potential, problems };
}

/**
 * The `oneOf` / `anyOf` lists where oasdiff cannot match the branches. It
 * matches inline branches by their content, or by `title`, so when two
 * untitled object branches change in one pull request, it reports them as
 * removed and added (in a response, a breaking change) instead of comparing
 * what changed inside them. Every inline object branch of a list with more
 * than one needs a `title`. Returns JSON pointers into the bundled contract.
 * @param {unknown} spec
 */
export function untitledBranches(spec) {
  /** @type {string[]} */
  const found = [];
  /** @param {unknown} node @param {string} pointer */
  const walk = (node, pointer) => {
    if (node === null || typeof node !== 'object') return;
    const record = /** @type {Record<string, unknown>} */ (node);
    for (const key of ['oneOf', 'anyOf']) {
      const branches = record[key];
      if (!Array.isArray(branches)) continue;
      const objects = branches.filter(isInlineObject);
      if (objects.length > 1 && objects.some((b) => !('title' in b))) {
        found.push(`${pointer}/${key}`);
      }
    }
    for (const [key, value] of Object.entries(record)) {
      walk(
        value,
        `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      );
    }
  };
  walk(spec, '#');
  return found;
}

/** @param {unknown} branch @returns {branch is Record<string, unknown>} */
function isInlineObject(branch) {
  if (branch === null || typeof branch !== 'object') return false;
  const record = /** @type {Record<string, unknown>} */ (branch);
  return (
    !('$ref' in record) &&
    (record['type'] === 'object' || 'properties' in record || 'allOf' in record)
  );
}
