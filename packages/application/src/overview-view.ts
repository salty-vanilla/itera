// What the app's shell and the plain screens show besides each screen's
// own data: the clock, counts, the Sprints by state, and the Areas.
import {
  backlogView,
  sprintNumber,
  type AreaColor,
  type AreaId,
  type Sprint,
} from '@itera/domain';
import { planningSprint } from './planning-view';
import type { Clock, Records } from './records';
import { reviewSprintOf } from './retro-view';
import { activeSprintOf } from './today-view';

/** A Sprint as the shell and the plain screens name it: 「Sprint 14」 (F25). */
export type SprintSummary = Pick<Sprint, 'start' | 'end' | 'state'> & {
  readonly number: number;
};

export interface AppOverview {
  readonly today: Clock['today'];
  readonly now: Clock['now'];
  readonly timeZone: Records['user']['timeZone'];
  readonly backlogCount: number;
  /** The running week, even while the next one is being planned. */
  readonly activeSprint?: SprintSummary;
  readonly reviewSprint?: SprintSummary;
  readonly planningSprint?: SprintSummary;
}

/**
 * More than one Sprint can be open at once (a week running or in Review
 * while the next is planned), so each is named by its state rather than
 * one 「open」 Sprint.
 */
export function appOverview(records: Records, clock: Clock): AppOverview {
  // The same selectors as the screens' views, so 「running」 or 「in
  // Review」 means one thing everywhere.
  const summary = (sprint: Sprint | undefined): SprintSummary | undefined =>
    sprint && {
      start: sprint.start,
      end: sprint.end,
      state: sprint.state,
      number: sprintNumber(sprint, records.sprints),
    };
  const active = summary(activeSprintOf(records));
  const review = summary(reviewSprintOf(records));
  const planning = summary(planningSprint(records));
  return {
    today: clock.today,
    now: clock.now,
    timeZone: records.user.timeZone,
    backlogCount: backlogView(records.tasks).length,
    ...(active === undefined ? {} : { activeSprint: active }),
    ...(review === undefined ? {} : { reviewSprint: review }),
    ...(planning === undefined ? {} : { planningSprint: planning }),
  };
}

export interface EditableArea {
  readonly id: AreaId;
  /** The current name (the Area is the person's, not a Sprint's, F5). */
  readonly name: string;
  readonly color: AreaColor;
  readonly archived: boolean;
}

/**
 * Every Area, archived ones too, in the person's order (`order`), each by
 * its current name. The choices are the ones not archived.
 */
export function areaList(
  records: Pick<Records, 'areas'>,
): readonly EditableArea[] {
  return records.areas
    .toSorted((a, b) => a.order - b.order)
    .map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      archived: a.archived,
    }));
}
