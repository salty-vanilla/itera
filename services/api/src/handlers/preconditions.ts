import type { operations } from '@itera/application';
import { wasInterruptDeleted } from '../db/deleted-interrupts';
import { ApiError } from '../errors';
import type { Precondition } from './flow';

type Input<Name extends keyof typeof operations> = Parameters<
  (typeof operations)[Name]
>[0];

/**
 * The operations that need something the records do not hold, checked
 * against the database before the operation runs (`Flow.operate`).
 */
export const preconditions = {
  /**
   * Only a note the user deleted comes back. The ID is global (ADR 0004 ID
   * の形式) and `interrupt_note.id` its primary key, so an ID the user never
   * had would be saved as a new row, or fail on another user's. Another
   * user's note and one nobody has are refused alike, with a message that
   * says nothing about the ID (ADR 0006 「消した記録を戻す操作の照合」).
   */
  restoreInterrupt:
    ({ sprintId, note }: Input<'restoreInterrupt'>): Precondition =>
    async (db, userId) => {
      if (!(await wasInterruptDeleted(db, userId, sprintId, note.id))) {
        throw new ApiError(
          'notFound',
          'The person has not deleted such an interrupt from the Sprint.',
        );
      }
    },
} as const;
