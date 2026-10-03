import type { InterruptNoteId, SprintId, UserId } from '@itera/domain';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from './database';
import { activity } from './schema';

/**
 * Whether the user deleted this InterruptNote from this Sprint: the Activity
 * log keeps that it was deleted (domain `deleteInterrupt`). The log is
 * append-only, so a deletion that was there stays, and the answer does not
 * race with a save.
 *
 * This is the one place the log is read for a decision (ADR 0004 「Activity
 * を読む 1 つの例外」, ADR 0006 「消した記録を戻す操作の照合」). It looks at the user's own entries only, so the ID of
 * another user's note and an ID nobody has give the same answer.
 *
 * The condition on `kind` is a literal and the JSON path the one of
 * `activity_interrupt_deleted_idx`, so that the query uses that index
 * (src/db/deleted-interrupts.test.ts holds it).
 */
export async function wasInterruptDeleted(
  db: Database,
  userId: UserId,
  sprintId: SprintId,
  interruptId: InterruptNoteId,
): Promise<boolean> {
  const rows = await deletedInterruptQuery(db, userId, sprintId, interruptId);
  return rows.length > 0;
}

/** The query of `wasInterruptDeleted`, for the test that reads its plan. */
export function deletedInterruptQuery(
  db: Database,
  userId: UserId,
  sprintId: SprintId,
  interruptId: InterruptNoteId,
) {
  return db
    .select({ at: activity.at })
    .from(activity)
    .where(
      and(
        sql`${activity.kind} = 'interruptDeleted'`,
        eq(activity.userId, userId),
        sql`${activity.content} ->> '$.interruptId' = ${interruptId}`,
        sql`${activity.content} ->> '$.sprintId' = ${sprintId}`,
      ),
    )
    .limit(1);
}
