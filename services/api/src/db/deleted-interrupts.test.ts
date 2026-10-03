import { id, instant, type UserId } from '@itera/domain';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deletedInterruptQuery,
  wasInterruptDeleted,
} from './deleted-interrupts';
import type { Database } from './database';
import { createMemoryDatabase } from './memory-database';
import { activity, user as authUser } from './schema';

const tid = (prefix: string, n: number) =>
  `${prefix}_01k6p${String(n).padStart(21, '0')}`;

const alice = id<'User'>(tid('user', 1));
const bob = id<'User'>(tid('user', 2));
const sprint = id<'Sprint'>(tid('sprint', 1));
const otherSprint = id<'Sprint'>(tid('sprint', 2));
const note = id<'InterruptNote'>(tid('interrupt_note', 1));

let close: (() => void) | undefined;
afterEach(() => close?.());

async function database() {
  const memory = await createMemoryDatabase();
  close = memory.close;
  for (const [userId, email] of [
    [alice, 'alice@example.com'],
    [bob, 'bob@example.com'],
  ] as const) {
    await memory.db.insert(authUser).values({ id: userId, name: 'n', email });
  }
  return memory;
}

/** What `deleteInterrupt` appends: the common columns, the rest as JSON. */
async function logDeleted(
  db: Database,
  userId: UserId,
  revision: number,
  content: Record<string, unknown>,
  kind: 'interruptDeleted' | 'interruptNoted' = 'interruptDeleted',
) {
  await db.insert(activity).values({
    userId,
    revision,
    position: 0,
    at: instant('2026-10-04T00:00:00.000Z'),
    actor: 'user',
    kind,
    content,
  });
}

describe('wasInterruptDeleted', () => {
  it('finds a note the user deleted from the Sprint', async () => {
    const { db } = await database();
    await logDeleted(db, alice, 1, { sprintId: sprint, interruptId: note });
    expect(await wasInterruptDeleted(db, alice, sprint, note)).toBe(true);
  });

  it('answers the same for another user’s note and for one nobody has', async () => {
    const { db } = await database();
    await logDeleted(db, bob, 1, { sprintId: sprint, interruptId: note });
    const nobody = id<'InterruptNote'>(tid('interrupt_note', 9));
    expect(await wasInterruptDeleted(db, alice, sprint, note)).toBe(false);
    expect(await wasInterruptDeleted(db, alice, sprint, nobody)).toBe(false);
  });

  it('does not find a note deleted from another Sprint, or one only noted', async () => {
    const { db } = await database();
    await logDeleted(db, alice, 1, {
      sprintId: otherSprint,
      interruptId: note,
    });
    await logDeleted(
      db,
      alice,
      2,
      { sprintId: sprint, interruptId: note },
      'interruptNoted',
    );
    expect(await wasInterruptDeleted(db, alice, sprint, note)).toBe(false);
  });

  it('uses the index of the deletions, not a scan of the log', async () => {
    const { db, client } = await database();
    const { sql, params } = deletedInterruptQuery(
      db,
      alice,
      sprint,
      note,
    ).toSQL();
    const plan = await client.execute({
      sql: `explain query plan ${sql}`,
      args: params as never[],
    });
    const detail = plan.rows.map((row) => String(row.detail)).join('\n');
    expect(detail).toContain('activity_interrupt_deleted_idx');
  });
});
