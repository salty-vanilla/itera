// Helpers for this package's tests. Not exported from the package.
import type { Area } from './area';
import type { CommandContext, CommandResult } from './shared/command';
import { id, type Id } from './shared/ids';
import { addDays, instant, localDate, timeZone } from './shared/time';
import type { Sprint } from './sprint';
import { createTask, type Task } from './task';
import type { User } from './user';

export const userId = id<'User'>('user-1');

export const ctx: CommandContext = {
  now: instant('2026-09-28T00:00:00.000Z'),
  actor: 'user',
};

export function at(iso: string): CommandContext {
  return { now: instant(iso), actor: 'user' };
}

/** Unwraps a successful command, failing the test otherwise. */
export function unwrap<T>(result: CommandResult<T>): T {
  if (!result.ok) {
    throw new Error(
      `Expected success, got ${result.error.code}: ${result.error.message}`,
    );
  }
  return result.value.record;
}

export function newTask(
  title = '関連論文を 3 本読む',
  taskId = 'task-1',
): Task {
  return unwrap(
    createTask({ id: id<'Task'>(taskId), userId, title, via: 'backlog' }, ctx),
  );
}

/** Monday-start weeks in Tokyo. */
export const user: User = {
  id: userId,
  displayName: 'テスト',
  timeZone: timeZone('Asia/Tokyo'),
  weekStartsOn: 1,
};

export const researchId = id<'Area'>('area-research');
export const workId = id<'Area'>('area-work');

export const research: Area = {
  id: researchId,
  userId,
  name: '研究',
  color: 2,
  order: 1,
  archived: false,
};

export const work: Area = {
  id: workId,
  userId,
  name: '仕事',
  color: 1,
  order: 0,
  archived: false,
};

/** Makes sequential IDs of one kind: `prefix-1`, `prefix-2`, … */
export function ids<Kind extends string>(prefix: string): () => Id<Kind> {
  let n = 0;
  return () => id<Kind>(`${prefix}-${++n}`);
}

/**
 * A Sprint fixture in a given state. Closing a Sprint (Review, Retro) comes
 * with #24; until then tests build closed Sprints directly.
 */
export function sprintFixture(
  start: string,
  state: Sprint['state'],
  extra: Partial<Sprint> = {},
): Sprint {
  return {
    id: id<'Sprint'>(`sprint-${start}`),
    userId,
    start: localDate(start),
    end: addDays(localDate(start), 6),
    state,
    goals: [],
    tasks: [],
    areaSnapshot: [],
    ...extra,
  };
}
