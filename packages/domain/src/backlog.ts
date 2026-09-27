import type { AreaId } from './shared/ids';
import type { Task } from './task';

export interface BacklogFilter {
  /** An Area, or `'none'` for Tasks without an Area. Omit for all. */
  readonly area?: AreaId | 'none';
}

/**
 * Backlog is not a container but a view: the active Tasks (invariant 2).
 * Being in a Sprint or in Today does not hide a Task.
 *
 * The default order is creation order. Priority is deliberately not the
 * default sort key (invariant 5); screens may offer it as an explicit sort.
 */
export function backlogView(
  tasks: readonly Task[],
  filter: BacklogFilter = {},
): readonly Task[] {
  return tasks
    .filter((task) => task.lifecycle === 'active')
    .filter((task) => {
      if (filter.area === undefined) return true;
      if (filter.area === 'none') return task.areaId === undefined;
      return task.areaId === filter.area;
    })
    .toSorted(
      (a, b) => compare(a.createdAt, b.createdAt) || compare(a.id, b.id),
    );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
