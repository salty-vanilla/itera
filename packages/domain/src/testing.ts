// Helpers for this package's tests. Not exported from the package.
import type { CommandContext, CommandResult } from './shared/command';
import { id, type TaskId, type UserId } from './shared/ids';
import { instant } from './shared/time';
import { createTask, type Task } from './task';

export const userId = id<'User'>('user-1') as UserId;

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
  return result.value.value;
}

export function newTask(
  title = '関連論文を 3 本読む',
  taskId = 'task-1',
): Task {
  return unwrap(
    createTask(
      { id: id<'Task'>(taskId) as TaskId, userId, title, via: 'backlog' },
      ctx,
    ),
  );
}
