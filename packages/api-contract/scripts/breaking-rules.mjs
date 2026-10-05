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
 * `--severity-levels` file reads them. Removing a property breaks a client
 * from a request (the body refuses keys it does not know with 400) and from
 * a response alike; oasdiff takes the first as a warning and the second as
 * compatible when the property was optional.
 */
export const LEVELS = [
  'request-property-removed err',
  'response-optional-property-removed err',
].join('\n');

const ERROR_STATUS = /for the response status `[45]\d\d`/;
const TYPE_PROPERTY = /`(?:[^`]*\/)?type` response property/;

/**
 * Whether oasdiff counts the change as breaking where ADR 0006 「列挙」 does
 * not: the error bodies are an open enum, so a branch added to an error
 * response's `oneOf`, or a value added to an error's `type`, does not break
 * a client that reads unknown errors as a general failure.
 * @param {Change} change
 */
export function isOpenEnumAddition(change) {
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
 * @param {{ changes: Change[], base: string, head: string }} input
 */
export function assess({ changes, base, head }) {
  const breaking = changes.filter(
    (c) => c.level >= ERR && !isOpenEnumAddition(c),
  );
  const open = changes.filter((c) => c.level >= ERR && isOpenEnumAddition(c));
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
