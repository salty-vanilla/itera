import type { Sprint } from '@itera/domain';
import type { Records } from '@/store/records';

/**
 * The Sprint the screens are about: the one in Planning, Active or Review.
 * There is at most one of each; if several are open (a Sprint in Review
 * while the next is in Planning), the latest wins.
 */
export function openSprint(records: Records): Sprint | undefined {
  return records.sprints
    .filter((s) => s.state !== 'closed')
    .toSorted((a, b) => (a.start < b.start ? 1 : -1))[0];
}
