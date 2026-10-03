// The contract's ID patterns accept exactly the IDs `parseId` of
// packages/application accepts (ADR 0004 ID の形式): a TypeID with the
// kind's prefix over a UUIDv7.
import { createIdSource, parseId } from '@itera/application';
import { instant } from '@itera/domain';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ID_SCHEMAS } from './testing';

let seed = 1;
const ids = createIdSource((bytes) => {
  // Not random, but every byte value shows up.
  for (let i = 0; i < bytes.length; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    bytes[i] = seed % 256;
  }
});

/** Strings around an ID: each breaks one rule of a TypeID or of UUIDv7. */
function around(id: string): string[] {
  const at = id.lastIndexOf('_');
  const prefix = id.slice(0, at);
  const suffix = id.slice(at + 1);
  const put = (i: number, c: string) =>
    `${prefix}_${suffix.slice(0, i)}${c}${suffix.slice(i + 1)}`;
  return [
    id,
    `other_${suffix}`,
    suffix,
    id.toUpperCase(),
    `${id}0`,
    id.slice(0, -1),
    put(0, '8'),
    put(5, 'u'),
    // The UUID's version (the 11th character) and variant (the 14th).
    ...'0123456789abcdefghjkmnpqrstvwxyz'.split('').map((c) => put(10, c)),
    ...'0123456789abcdefghjkmnpqrstvwxyz'.split('').map((c) => put(13, c)),
  ];
}

describe.each(Object.entries(ID_SCHEMAS))('the %s ID', (kind, schema) => {
  it('accepts what parseId accepts, and nothing else', () => {
    for (const ms of [0, 1_700_000_000_000, 2_000_000_000_000]) {
      const id = ids.newId(kind, instant(new Date(ms).toISOString()));
      expect(v.is(schema, id), id).toBe(true);
      for (const value of around(id)) {
        expect(v.is(schema, value), value).toBe(parseId(kind, value).ok);
      }
    }
  });

  it("does not accept another kind's ID", () => {
    const other = kind === 'Task' ? 'Area' : 'Task';
    const id = ids.newId(other, instant('2026-10-03T00:00:00.000Z'));
    expect(v.is(schema, id)).toBe(false);
  });
});
