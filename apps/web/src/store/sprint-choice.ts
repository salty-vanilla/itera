// Which Sprint the Sprint and Retro screens open, and what it is called
// (#90). Any Sprint can be opened by its number (F25) in the URL
// (`/sprint?sprint=3`); without one, a screen opens the current Sprint.
// 「今週」 and 「来週」 are names relative to now, not separate screens.
import {
  nextUnconfirmedSprintStart,
  sprintEnd,
  sprintNumber,
  type LocalDate,
  type Sprint,
  type SprintState,
} from '@itera/domain';
import type { WeekName } from '@/lib/week-text';
import type { Clock, Records } from './records';

export type { WeekName };

/** A Sprint a screen can open, or the next week before its Planning. */
export interface SprintRef {
  /** 「Sprint 3」 (F25). */
  readonly number: number;
  readonly start: LocalDate;
  readonly end: LocalDate;
  /** Absent for the next week, whose Planning has not started. */
  readonly sprint?: Sprint;
  readonly week?: WeekName;
}

/** The Sprint a screen shows, and those before and after it. */
export interface SprintChoice {
  readonly current: SprintRef;
  readonly previous?: SprintRef;
  readonly next?: SprintRef;
}

/**
 * 「今週」「来週」 (the rule of #90): while a Sprint runs, it is 「今週」
 * and the one after it 「来週」. With none running (the last one in Review
 * or closed), the next to start is 「今週」, so planning next week on
 * Sunday evening keeps its usual words. Any other Sprint has none.
 */
export function weekNameOf(
  start: LocalDate,
  records: Records,
  clock: Clock,
): WeekName | undefined {
  const upcoming = nextUnconfirmedSprintStart(
    records.sprints,
    records.user,
    clock.today,
  );
  const active = records.sprints.find((s) => s.state === 'active');
  if (active !== undefined) {
    if (start === active.start) return '今週';
    return start === upcoming ? '来週' : undefined;
  }
  return start === upcoming ? '今週' : undefined;
}

/** `{ week }` for a view's data, left out for a Sprint with no name. */
export function weekOf(
  sprint: Sprint,
  records: Records,
  clock: Clock,
): { week?: WeekName } {
  const week = weekNameOf(sprint.start, records, clock);
  return week === undefined ? {} : { week };
}

/**
 * The Sprint called 「今週」, if one is: the running one, else the one being
 * planned. The Backlog marks its Tasks 「今週」 by it.
 */
export function thisWeekSprintOf(
  records: Records,
  clock: Clock,
): Sprint | undefined {
  return records.sprints.find(
    (s) => weekNameOf(s.start, records, clock) === '今週',
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

/**
 * The Sprint a screen opens: the one asked for, if there is one by that
 * number, else the current one.
 * - Sprint: the running Sprint, else the one being planned, else the one in
 *   Review, else the next week (its Planning starts there).
 * - Retro: the one in Review, else the running one (its Retro starts on its
 *   last day, F21), else the last closed. The next week has no Retro, so
 *   there is none before the first Sprint.
 */
export function sprintChoice(
  records: Records,
  clock: Clock,
  screen: 'sprint',
  asked?: number,
): SprintChoice;
export function sprintChoice(
  records: Records,
  clock: Clock,
  screen: 'retro',
  asked?: number,
): SprintChoice | undefined;
export function sprintChoice(
  records: Records,
  clock: Clock,
  screen: 'sprint' | 'retro',
  asked?: number,
): SprintChoice | undefined {
  const refs = sprintRefs(records, clock).filter(
    (r) => screen === 'sprint' || r.sprint !== undefined,
  );
  const inState = (state: SprintState) =>
    refs.find((r) => r.sprint?.state === state);
  const current =
    refs.find((r) => r.number === asked) ??
    (screen === 'sprint'
      ? (inState('active') ?? inState('planning') ?? inState('review'))
      : (inState('review') ??
        inState('active') ??
        refs.findLast((r) => r.sprint?.state === 'closed'))) ??
    refs.at(-1);
  if (current === undefined) return undefined;
  const index = refs.indexOf(current);
  const previous = refs[index - 1];
  const next = refs[index + 1];
  return {
    current,
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
}
