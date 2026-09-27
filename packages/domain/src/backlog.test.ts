import { describe, expect, it } from 'vitest';
import { backlogView } from './backlog';
import { id, type AreaId } from './shared/ids';
import { archiveTask, completeTask, createTask, updateTask } from './task';
import { at, ctx, unwrap, userId } from './testing';

const research = id('area-research') as AreaId;

function task(taskId: string, createdAt: string) {
  return unwrap(
    createTask(
      { id: id(taskId), userId, title: taskId, via: 'backlog' },
      at(createdAt),
    ),
  );
}

describe('backlogView', () => {
  it('invariant 2: shows only active Tasks', () => {
    const active = task('a', '2026-09-28T00:00:00.000Z');
    const completed = unwrap(
      completeTask(task('b', '2026-09-28T00:01:00.000Z'), ctx),
    );
    const archived = unwrap(
      archiveTask(task('c', '2026-09-28T00:02:00.000Z'), ctx),
    );
    expect(backlogView([completed, archived, active]).map((t) => t.id)).toEqual(
      ['a'],
    );
  });

  it('invariant 5: priority is not the default order; creation order is', () => {
    const low = unwrap(
      updateTask(
        task('first', '2026-09-28T00:00:00.000Z'),
        { priority: 'low' },
        ctx,
      ),
    );
    const high = unwrap(
      updateTask(
        task('second', '2026-09-28T00:05:00.000Z'),
        { priority: 'high' },
        ctx,
      ),
    );
    expect(backlogView([high, low]).map((t) => t.id)).toEqual([
      'first',
      'second',
    ]);
  });

  it('filters by Area and by "no Area"', () => {
    const inResearch = unwrap(
      updateTask(
        task('r', '2026-09-28T00:00:00.000Z'),
        { areaId: research },
        ctx,
      ),
    );
    const noArea = task('n', '2026-09-28T00:01:00.000Z');
    expect(
      backlogView([inResearch, noArea], { area: research }).map((t) => t.id),
    ).toEqual(['r']);
    expect(
      backlogView([inResearch, noArea], { area: 'none' }).map((t) => t.id),
    ).toEqual(['n']);
  });

  it('does not reorder the array it is given', () => {
    const tasks = Object.freeze([
      task('b', '2026-09-28T00:01:00.000Z'),
      task('a', '2026-09-28T00:00:00.000Z'),
    ]);
    backlogView(tasks);
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
  });
});
