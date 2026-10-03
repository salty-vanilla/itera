// The reads of the contract's resources (#295, ADR 0006 経路の形): each is
// named by a noun of the domain, not by a screen. A Sprint is read by its
// ID; the Sprints the person has now are in the person's own read (`/me`);
// a day is one resource whether it is today, past or still to come.
import {
  nextUnconfirmedSprintStart,
  sprintEnd,
  sprintNumber,
  type LocalDate,
  type Sprint,
  type SprintId,
  type SprintState,
} from '@itera/domain';
import { dayData, type DayData } from './day-view';
import {
  planningCandidatesOf,
  sprintPlanOf,
  type PlanningData,
  type SprintPlan,
} from './planning-view';
import type { Clock, Records } from './records';
import { retroData, type RetroData } from './retro-view';
import { runningData, type RunningData } from './running-view';
import { weekNameOf, type SprintWeek } from './sprint-choice';
import { todayData, type TodayData } from './today-view';

/** A Sprint as a list or a reference shows it. */
export interface SprintItem {
  readonly id: SprintId;
  /** 「Sprint 14」 (F25): an attribute, not the key (#295). */
  readonly number: number;
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly state: SprintState;
  /** 今週・来週・先週, for the Sprints that have a name (#90). */
  readonly week?: SprintWeek;
}

function itemOf(sprint: Sprint, records: Records, clock: Clock): SprintItem {
  const week = weekNameOf(sprint.start, records, clock);
  return {
    id: sprint.id,
    number: sprintNumber(sprint, records.sprints),
    start: sprint.start,
    end: sprint.end,
    state: sprint.state,
    ...(week === undefined ? {} : { week }),
  };
}

/** The person's Sprints in order, or the one with that number. */
export function sprintList(
  records: Records,
  clock: Clock,
  filter: { readonly number?: number } = {},
): readonly SprintItem[] {
  return records.sprints
    .toSorted((a, b) => (a.start < b.start ? -1 : 1))
    .map((sprint) => itemOf(sprint, records, clock))
    .filter((s) => filter.number === undefined || s.number === filter.number);
}

/**
 * The Sprints the person has now, by what each is (more than one can be
 * open: a week running or in Review while the next is planned), and where
 * the next Planning starts when none is planned.
 */
export interface CurrentSprints {
  readonly active?: SprintItem;
  readonly review?: SprintItem;
  readonly planning?: SprintItem;
  /**
   * The next week not confirmed yet, with its number (F25), its last day
   * and its place next to now: where its Planning starts, so a screen can
   * open it before there is a Sprint (#274).
   */
  readonly next: {
    readonly start: LocalDate;
    readonly end: LocalDate;
    readonly number: number;
    readonly week?: SprintWeek;
  };
}

export function currentSprints(records: Records, clock: Clock): CurrentSprints {
  const of = (state: SprintState) => {
    const sprint = records.sprints.find((s) => s.state === state);
    return sprint === undefined
      ? {}
      : { [state]: itemOf(sprint, records, clock) };
  };
  const start = nextUnconfirmedSprintStart(
    records.sprints,
    records.user,
    clock.today,
  );
  const week = weekNameOf(start, records, clock);
  return {
    ...of('active'),
    ...of('review'),
    ...of('planning'),
    // One after every Sprint that starts before it.
    next: {
      start,
      end: sprintEnd(start),
      number: records.sprints.filter((s) => s.start < start).length + 1,
      ...(week === undefined ? {} : { week }),
    },
  };
}

/**
 * A Sprint (#295 R2): while planned, its plan; once confirmed, how it went.
 * The Tasks to choose from are not part of it (`sprintCandidates`).
 * `undefined` when the person has no Sprint with the ID.
 */
export type SprintView =
  | {
      readonly state: 'planning';
      readonly plan: SprintPlan;
    }
  | {
      readonly state: 'active' | 'review' | 'closed';
      readonly running: RunningData;
    };

export function sprintView(
  records: Records,
  clock: Clock,
  sprintId: SprintId,
  options: { applyCriterion: boolean },
): SprintView | undefined {
  const sprint = records.sprints.find((s) => s.id === sprintId);
  if (sprint === undefined) return undefined;
  if (sprint.state === 'planning')
    return {
      state: 'planning',
      plan: sprintPlanOf(records, clock, sprint, options),
    };
  const running = runningData(records, clock, sprintId);
  return running === undefined ? undefined : { state: sprint.state, running };
}

/**
 * The Tasks a Sprint being planned can choose, in groups (#295 R2).
 * `undefined` for a Sprint not being planned.
 */
export function sprintCandidates(
  records: Records,
  clock: Clock,
  sprintId: SprintId,
): PlanningData['candidates'] | undefined {
  const sprint = records.sprints.find((s) => s.id === sprintId);
  return sprint?.state === 'planning'
    ? planningCandidatesOf(records, clock, sprint)
    : undefined;
}

/** A Sprint's Retro, once it has started; `undefined` before. */
export function sprintRetro(
  records: Records,
  clock: Clock,
  sprintId: SprintId,
): RetroData | undefined {
  return retroData(records, clock, sprintId);
}

/**
 * A day (#295 R3), whether today, past or still to come: today's choices
 * on the running Sprint (none when no Sprint runs), or another day's
 * records or occurrences.
 */
export type DayView =
  | { readonly kind: 'today'; readonly today?: TodayData }
  | { readonly kind: 'past' | 'future'; readonly day: DayData };

export function dayView(
  records: Records,
  clock: Clock,
  date: LocalDate,
): DayView {
  const day = dayData(records, clock, date);
  if (day === undefined) {
    const today = todayData(records, clock);
    return today === undefined ? { kind: 'today' } : { kind: 'today', today };
  }
  return { kind: day.when, day };
}
