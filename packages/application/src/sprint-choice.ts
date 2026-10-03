// Which Sprint the Sprint and Retro screens open, and where it is next to
// now (#90). Any Sprint can be opened by its number (F25) in the URL
// (`/sprint?sprint=3`); without one, a screen opens the current Sprint.
// The weeks before, of and after now (the screens' 「先週」, 「今週」 and
// 「来週」) are places relative to now, not separate screens.
import {
  addDays,
  nextUnconfirmedSprintStart,
  sprintEnd,
  sprintNumber,
  type LocalDate,
  type Sprint,
} from '@itera/domain';
import type { Clock, Records } from './records';

/**
 * A Sprint's place next to now: the week before, the current week, or the
 * one after it. The screens put it in words (「先週」「今週」「来週」).
 */
export type SprintWeek = 'previous' | 'current' | 'next';

/** A Sprint a screen can open, or the next week before its Planning. */
export interface SprintRef {
  /** 「Sprint 3」 (F25). */
  readonly number: number;
  readonly start: LocalDate;
  readonly end: LocalDate;
  /** Absent for the next week, whose Planning has not started. */
  readonly sprint?: Sprint;
  readonly week?: SprintWeek;
}

/**
 * The current week and the next (the rule of #90): while a Sprint runs, it
 * is the current week and the one after it the next. With none running
 * (the last one in Review or closed), the next to start is the current
 * week, so planning next week on Sunday evening keeps its usual words. The
 * week before the current one is the previous (#168: the screens name it
 * only in the Sprint Header). Any other Sprint has none.
 */
export function weekNameOf(
  start: LocalDate,
  records: Records,
  clock: Clock,
): SprintWeek | undefined {
  const upcoming = nextUnconfirmedSprintStart(
    records.sprints,
    records.user,
    clock.today,
  );
  const active = records.sprints.find((s) => s.state === 'active');
  const thisWeek = active?.start ?? upcoming;
  if (start === thisWeek) return 'current';
  if (active !== undefined && start === upcoming) return 'next';
  return start === addDays(thisWeek, -7) ? 'previous' : undefined;
}

/** `{ week }` for a view's data, left out for a Sprint with no name. */
export function weekOf(
  sprint: Sprint,
  records: Records,
  clock: Clock,
): { week?: SprintWeek } {
  const week = weekNameOf(sprint.start, records, clock);
  return week === undefined ? {} : { week };
}

/**
 * The Sprint of the current week, if one is: the running one, else the one
 * being planned. The Backlog marks its Tasks 「今週」 by it.
 */
export function thisWeekSprintOf(
  records: Records,
  clock: Clock,
): Sprint | undefined {
  return records.sprints.find(
    (s) => weekNameOf(s.start, records, clock) === 'current',
  );
}

/**
 * The Sprint of the next week, once its Planning has started: the draft
 * that exists while this week runs (#90). Tasks in it are marked 「来週」
 * (#150).
 */
export function nextWeekSprintOf(
  records: Records,
  clock: Clock,
): Sprint | undefined {
  return records.sprints.find(
    (s) => weekNameOf(s.start, records, clock) === 'next',
  );
}

/**
 * Every Sprint in order and, while no Planning has started, the next week
 * after them: that is where its Planning starts (invariant 11).
 */
export function sprintRefs(
  records: Records,
  clock: Clock,
): readonly SprintRef[] {
  const refs: SprintRef[] = records.sprints
    .toSorted((a, b) => (a.start < b.start ? -1 : 1))
    .map((sprint) => {
      const week = weekNameOf(sprint.start, records, clock);
      return {
        number: sprintNumber(sprint, records.sprints),
        start: sprint.start,
        end: sprint.end,
        sprint,
        ...(week === undefined ? {} : { week }),
      };
    });
  if (!records.sprints.some((s) => s.state === 'planning')) {
    const start = nextUnconfirmedSprintStart(
      records.sprints,
      records.user,
      clock.today,
    );
    const week = weekNameOf(start, records, clock);
    refs.push({
      number: refs.length + 1,
      start,
      end: sprintEnd(start),
      ...(week === undefined ? {} : { week }),
    });
  }
  return refs;
}
