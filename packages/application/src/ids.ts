// Record IDs as TypeIDs (spec v0.3, ADR 0004 ID の形式): a prefix naming the
// kind of record, then a UUIDv7 in base32 (`task_01h2xcejqtf2nbrexx3vqjhp41`).
// The domain never makes IDs (packages/domain README); the API and the
// browser mock make them here, and check the ones that come from outside.
import { err, ok, type Id, type Instant, type Result } from '@itera/domain';

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const PREFIX = /^([a-z]([a-z_]{0,61}[a-z])?)?$/;
const SUFFIX = /^[0-7][0-9abcdefghjkmnpqrstvwxyz]{25}$/;

/**
 * The TypeID prefix of a kind of domain ID: its name in snake_case
 * (`SprintTask` → `sprint_task`).
 */
export function idPrefix(kind: string): string {
  return kind.replace(/(?<=[a-z])(?=[A-Z])/g, '_').toLowerCase();
}

/** 128 bits as the 26 characters of a TypeID suffix. */
export function encodeSuffix(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error('A UUID has 16 bytes.');
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let suffix = '';
  for (let i = 0; i < 26; i += 1) {
    suffix = ALPHABET.charAt(Number(value & 31n)) + suffix;
    value >>= 5n;
  }
  return suffix;
}

/** The 16 bytes of a TypeID suffix, or `undefined` when it is not one. */
export function decodeSuffix(suffix: string): Uint8Array | undefined {
  if (!SUFFIX.test(suffix)) return undefined;
  let value = 0n;
  for (const char of suffix)
    value = (value << 5n) | BigInt(ALPHABET.indexOf(char));
  const bytes = new Uint8Array(16);
  for (let i = 15; i >= 0; i -= 1) {
    bytes[i] = Number(value & 255n);
    value >>= 8n;
  }
  return bytes;
}

/** A TypeID's prefix and UUID, or `undefined` when the string is not one. */
export function parseTypeId(
  value: string,
): { readonly prefix: string; readonly uuid: Uint8Array } | undefined {
  const at = value.lastIndexOf('_');
  const prefix = at === -1 ? '' : value.slice(0, at);
  const suffix = at === -1 ? value : value.slice(at + 1);
  // An empty prefix has no separator.
  if (at === 0 || !PREFIX.test(prefix)) return undefined;
  const uuid = decodeSuffix(suffix);
  return uuid === undefined ? undefined : { prefix, uuid };
}

/**
 * An ID of `kind` from outside (a request, a URL): a TypeID with the kind's
 * prefix over a UUIDv7, as `createIdSource` makes them.
 */
export function parseId<Kind extends string>(
  kind: Kind,
  value: string,
): Result<Id<Kind>> {
  const parsed = parseTypeId(value);
  if (parsed === undefined)
    return err('invalidInput', `Not a TypeID: ${value}`);
  if (parsed.prefix !== idPrefix(kind)) {
    return err('invalidInput', `Not a ${kind} ID: ${value}`);
  }
  const version = (parsed.uuid[6] ?? 0) >> 4;
  const variant = (parsed.uuid[8] ?? 0) >> 6;
  if (version !== 7 || variant !== 0b10) {
    return err('invalidInput', `Not a UUIDv7: ${value}`);
  }
  return ok(value as Id<Kind>);
}

/** Fills the array with random bytes: `crypto.getRandomValues` in Workers and browsers. */
export type RandomBytes = (bytes: Uint8Array<ArrayBuffer>) => void;

/** Makes new IDs, in the order they are made. */
export interface IdSource {
  /** A new ID of `kind`, made at `at` (the UUIDv7's time). */
  newId<Kind extends string>(kind: Kind, at: Instant): Id<Kind>;
}

/** The 74 bits of a UUIDv7 after its time, version and variant. */
const RANDOM_BITS = 74n;
const RANDOM_MAX = (1n << RANDOM_BITS) - 1n;

/**
 * A source of UUIDv7 TypeIDs. IDs it makes sort in the order it made them,
 * also within one millisecond and when `at` goes back (RFC 9562 §6.2: the
 * random part counts up from the last ID's). The domain orders records
 * made at the same time by ID (packages/domain README), so this order is
 * the order of making.
 */
export function createIdSource(random: RandomBytes): IdSource {
  let lastTime = -1n;
  let lastRandom = 0n;
  const fresh = (): bigint => {
    const bytes = new Uint8Array(10);
    random(bytes);
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    // Room to count up within one millisecond: the top bit stays clear.
    return value & (RANDOM_MAX >> 1n);
  };
  return {
    newId<Kind extends string>(kind: Kind, at: Instant): Id<Kind> {
      const time = BigInt(Date.parse(at));
      if (time > lastTime) {
        lastTime = time;
        lastRandom = fresh();
      } else if (lastRandom < RANDOM_MAX) {
        lastRandom += 1n;
      } else {
        lastTime += 1n;
        lastRandom = fresh();
      }
      return `${idPrefix(kind)}_${encodeSuffix(uuidV7(lastTime, lastRandom))}` as Id<Kind>;
    },
  };
}

/** A UUIDv7: 48 bits of Unix time in ms, version 7, 12 + 62 random bits, variant 10. */
function uuidV7(time: bigint, randomBits: bigint): Uint8Array {
  const randA = randomBits >> 62n;
  const randB = randomBits & ((1n << 62n) - 1n);
  const value =
    (time << 80n) | (7n << 76n) | (randA << 64n) | (0b10n << 62n) | randB;
  const bytes = new Uint8Array(16);
  let rest = value;
  for (let i = 15; i >= 0; i -= 1) {
    bytes[i] = Number(rest & 255n);
    rest >>= 8n;
  }
  return bytes;
}
