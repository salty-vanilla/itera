import type { Area } from './area';
import type { PlanningValue } from './planning-value';
import type {
  AreaId,
  EstimateSuggestionId,
  OccurrenceId,
  PlanningCriterionId,
  SprintId,
  SprintTaskId,
  TaskId,
  UserId,
} from './shared/ids';
import {
  addDays,
  dayOfWeek,
  type Instant,
  type LocalDate,
} from './shared/time';
import type { TimeBasis } from './task';
import type { User } from './user';

export type SprintState = 'planning' | 'active' | 'review' | 'closed';

/** Sprint への参加。「進行中」「今日はここまで」は DailySelection が持つ。 */
export type SprintTaskOutcome =
  'draft' | 'planned' | 'done' | 'removed' | 'carriedOver';

export type SprintTaskOrigin = 'planning' | 'midSprint';
export type GoalLink = 'linked' | 'unlinked';

/**
 * What the time judgement looked like when the SprintTask was planned
 * (at confirm) or added (mid-Sprint). Fixed once made (invariant 16), so a
 * later Estimate change does not rewrite it.
 */
export interface PlanSnapshot {
  /** For a recurring Task: the value of one occurrence × the count. */
  readonly value: PlanningValue;
  readonly timeBasis: TimeBasis;
  /** The Task's own Estimate at the time, if any. */
  readonly estimateHours?: number;
  /** The suggestion on show at the time, if any. */
  readonly suggestion?: {
    readonly id: EstimateSuggestionId;
    readonly lo: number;
    readonly hi: number;
  };
  /** Recurring only: how many occurrences the value covers. */
  readonly occurrenceCount?: number;
}

/**
 * Taking a Task into this Sprint (参加レコード). A recurring Task's
 * SprintTask bundles its occurrences in the Sprint period.
 */
export interface SprintTask {
  readonly id: SprintTaskId;
  readonly taskId: TaskId;
  /** Recurring only. The included (non-excluded) occurrences. */
  readonly occurrenceIds?: readonly OccurrenceId[];
  /** Decided at creation and never changed (invariant 17). */
  readonly origin: SprintTaskOrigin;
  readonly addedAt: Instant;
  readonly goalLink: GoalLink;
  readonly outcome: SprintTaskOutcome;
  readonly planSnapshot?: PlanSnapshot;
  /** The previous Sprint's carried-over SprintTask this continues. */
  readonly carriedFrom?: SprintTaskId;
}

/**
 * "How I want this Area to be by the end of the week". One per Area at most,
 * and there is no Sprint-wide Goal (invariant 13). The system never judges
 * whether it was achieved (invariant 19).
 */
export interface SprintGoal {
  readonly areaId: AreaId;
  /** The current text. May change after confirm; changes go to Activity. */
  readonly text: string;
  /** The text at confirm. Written once (invariant 18). */
  readonly plannedText?: string;
}

/** An Area's name as this Sprint shows it (F5, F9). */
export interface SprintAreaSnapshotEntry {
  readonly areaId: AreaId;
  readonly name: string;
  readonly order: number;
}

/** How this Sprint treated the active PlanningCriterion. */
export interface CriterionUse {
  readonly criterionId: PlanningCriterionId;
  /** Fixed at confirm; there is no way to change it later (invariant 37). */
  readonly appliedAtConfirm: boolean;
}

/**
 * The aggregate root of one week's plan. MVP Sprints are one week long,
 * starting on the user's `weekStartsOn`.
 */
export interface Sprint {
  readonly id: SprintId;
  readonly userId: UserId;
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly state: SprintState;
  readonly previousSprintId?: SprintId;
  /** Current available hours. May change after confirm (history in Activity). */
  readonly availableHours?: number;
  /** Available hours at confirm. Written once (invariant 18). */
  readonly plannedAvailableHours?: number;
  readonly confirmedAt?: Instant;
  readonly goals: readonly SprintGoal[];
  readonly tasks: readonly SprintTask[];
  /** Empty until confirm; then the Area names this Sprint shows. */
  readonly areaSnapshot: readonly SprintAreaSnapshotEntry[];
  /** Present when a criterion was active at confirm (invariant 36). */
  readonly criterionUse?: CriterionUse;
}

/** The Sprint period that starts on `start` (one week, both ends inclusive). */
export function sprintEnd(start: LocalDate): LocalDate {
  return addDays(start, 6);
}

/** The first day of the user's week containing `date`. */
export function weekStartOf(date: LocalDate, user: User): LocalDate {
  const back = (dayOfWeek(date) - user.weekStartsOn + 7) % 7;
  return addDays(date, -back);
}

/**
 * SprintTasks that count toward the Sprint's plan now: in Planning and
 * during the Sprint. Removed and carried-over ones do not. Retro's
 * "planned total" (#24) must also count carried-over ones, so it needs its
 * own rule rather than this one.
 */
export function isCounted(task: SprintTask): boolean {
  return (
    task.outcome === 'draft' ||
    task.outcome === 'planned' ||
    task.outcome === 'done'
  );
}

/**
 * The name to show for an Area on this Sprint's screens (F5). Before
 * confirm, Planning uses the current name; after, the snapshot name, so a
 * rename during the Sprint does not show. `undefined` for an unknown Area.
 */
export function sprintAreaName(
  sprint: Sprint,
  areaId: AreaId,
  areas: readonly Area[],
): string | undefined {
  if (sprint.state !== 'planning') {
    const entry = sprint.areaSnapshot.find((e) => e.areaId === areaId);
    if (entry !== undefined) return entry.name;
  }
  return areas.find((a) => a.id === areaId)?.name;
}

function latest(sprints: readonly Sprint[]): Sprint | undefined {
  return sprints.toSorted((a, b) => (a.start < b.start ? 1 : -1))[0];
}

/**
 * The start of the next Sprint that is not confirmed yet: a Rule change
 * takes effect from here (F1). It is the draft Sprint's start if one is in
 * Planning; otherwise the day after the latest Sprint, or the current week
 * if that day has passed. Confirmed Sprints are never after it, so
 * `changeRecurrenceRule` with this date never touches them (invariant 31).
 */
export function nextUnconfirmedSprintStart(
  sprints: readonly Sprint[],
  user: User,
  today: LocalDate,
): LocalDate {
  const draft = sprints.find((s) => s.state === 'planning');
  if (draft !== undefined) return draft.start;
  const thisWeek = weekStartOf(today, user);
  const last = latest(sprints);
  if (last === undefined) return thisWeek;
  const after = addDays(last.end, 1);
  return after > thisWeek ? after : thisWeek;
}

/**
 * The first day not covered by any Sprint's generated occurrences: every
 * Sprint generates its period when its Planning starts. Pass it as
 * `projectFrom` to `nextOccurrence` / `recurrenceSummary`.
 */
export function projectFrom(
  sprints: readonly Sprint[],
  today: LocalDate,
): LocalDate {
  const last = latest(sprints);
  if (last === undefined) return today;
  const after = addDays(last.end, 1);
  return after > today ? after : today;
}
