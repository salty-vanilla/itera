import type { RecordVersions } from '@itera/application';
import { instant, type Instant, type UserId } from '@itera/domain';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import type { Database } from './database';
import { idempotencyKey } from './schema';

// The writes a user has made, by their Idempotency-Key (ADR 0006 冪等キー,
// ADR 0004 同時の書き込み). A write's key is kept in the write's own batch,
// with what it answered, so the key is there exactly when the write was
// saved: the same write sent again answers the same without being made
// twice, and a write that met another (a version conflict) can tell whether
// it was made itself and only its answer was lost.

/** How long a key is kept: the same write is sent again well within it. */
export const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** A received write: its key, and what makes it the same write. */
export type IdempotentWrite = {
  /** The UUID of the header, in lowercase. */
  readonly key: string;
  /** SHA-256 of the method, path, query and body, in hex. */
  readonly fingerprint: string;
};

/** What a write that went through answered: its status and its JSON. */
export type Answer = {
  readonly status: 200 | 201 | 204;
  /** `null` when it has no body. */
  readonly body: string | null;
  /**
   * The `ETag` of a write that replaced a record's values: the record's
   * etag after it (#321, ADR 0006 記録ごとの版). `null` for other writes.
   */
  readonly etag: string | null;
};

/** The answer kept for a key, with the fingerprint of its write. */
export type KeptAnswer = Answer & { readonly fingerprint: string };

/** A key to look up, at the time of the request (older keys are gone). */
export type KeyLookup = { readonly key: string; readonly at: Instant };

/** The moment before which a key made is no longer kept. */
function expiredBy(at: Instant): Instant {
  return instant(new Date(Date.parse(at) - KEY_LIFETIME_MS).toISOString());
}

/**
 * The query of the answer kept for a key, for a batch (`loadRecords` reads
 * it with the records, as of the same moment). Without a key it selects
 * nothing.
 */
export function keptAnswerQuery(
  db: Database,
  userId: UserId,
  lookup: KeyLookup | undefined,
) {
  return db
    .select({
      fingerprint: idempotencyKey.fingerprint,
      status: idempotencyKey.status,
      body: idempotencyKey.body,
      etag: idempotencyKey.etag,
    })
    .from(idempotencyKey)
    .where(
      lookup === undefined
        ? sql`0`
        : and(
            eq(idempotencyKey.userId, userId),
            eq(idempotencyKey.key, lookup.key),
            gt(idempotencyKey.createdAt, expiredBy(lookup.at)),
          ),
    );
}

/** The kept answer among the rows `keptAnswerQuery` selected. */
export function keptAnswerOf(
  rows: readonly {
    fingerprint: string;
    status: number;
    body: string | null;
    etag: string | null;
  }[],
): KeptAnswer | null {
  const [row] = rows;
  if (row === undefined) return null;
  return { ...row, status: row.status as Answer['status'] };
}

/** The answer kept for a key now, read alone (after a version conflict). */
export async function loadKeptAnswer(
  db: Database,
  userId: UserId,
  lookup: KeyLookup,
): Promise<KeptAnswer | null> {
  return keptAnswerOf(await keptAnswerQuery(db, userId, lookup));
}

/** A write to keep with its save: its key, its answer and when it was made. */
export type AnsweredWrite = {
  readonly write: IdempotentWrite;
  readonly answer: Answer;
  readonly at: Instant;
};

/**
 * A write to keep with its save, whose answer is made once the versions of
 * the save are known (the `ETag` of the record it replaced, #321).
 */
export type AnsweringWrite = Omit<AnsweredWrite, 'answer'> & {
  readonly answer: (versions: RecordVersions) => Answer;
};

/**
 * The statements that keep a write's key in its save's batch: the user's
 * keys past their 24 hours are deleted first (also one this key used
 * before, so that it is a new write), then this one is inserted. If the
 * same key was kept in between by another request, the insert fails the
 * batch, as that request also raised the version.
 */
export function keepAnswerStatements(
  db: Database,
  userId: UserId,
  { write, answer, at }: AnsweredWrite,
) {
  return [
    db
      .delete(idempotencyKey)
      .where(
        and(
          eq(idempotencyKey.userId, userId),
          lte(idempotencyKey.createdAt, expiredBy(at)),
        ),
      ),
    db.insert(idempotencyKey).values({
      userId,
      key: write.key,
      fingerprint: write.fingerprint,
      status: answer.status,
      body: answer.body,
      etag: answer.etag,
      createdAt: at,
    }),
  ] as const;
}
