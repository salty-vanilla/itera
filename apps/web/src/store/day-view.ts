// What the Today screen shows of a day other than today (#90), derived from
// the records by `@itera/domain`. Read only: a past day's records, and a
// future day's occurrences and deadlines. Today itself is today-view.ts.
import {
  sprintAreaName,
  toLocalDate,
  type AreaColor,
  type AreaId,
  type DailySelection,
  type InterruptNote,
  type LocalDate,
  type Occurrence,
  type Sprint,
  type Task,
} from '@itera/domain';
import { daysBetween } from '@/lib/date-format';
import type { Clock, Records } from './records';
import { sprintRefs, type SprintRef } from './sprint-choice';

export interface DayArea {
  readonly id: AreaId;
  readonly name: string;
  readonly color: AreaColor;
}

/** One choice made for the day, as it ended (read only). */
export interface DayRecord {
  readonly selection: DailySelection;
  readonly title: string;
  readonly area?: DayArea;
  /** Recurring: the occurrence this was about. */
  readonly occurrence?: Occurrence;
  /** The actual hours recorded for it that day. */
  readonly actualHours: number;
}

export interface DayData {
  readonly date: LocalDate;
  readonly today: LocalDate;
  /** Before today, or after it. */
  readonly when: 'past' | 'future';
  readonly timeZone: Records['user']['timeZone'];
  /**
   * The Sprint whose period has the day, with the day's place in it
   * (「3日目 / 7日」). The next week before its Planning has no Sprint yet.
   */
  readonly within?: SprintRef & {
    readonly day: { readonly index: number; readonly count: number };
  };
  /** With no Sprint for the day: the next one to start after it. */
  readonly next?: SprintRef;
  /** Past: the day's choices and how each ended, in the order chosen. */
  readonly records: readonly DayRecord[];
  /** Past: the day's interrupts, oldest first. */
  readonly interrupts: readonly InterruptNote[];
  /** Future: the occurrences due that day (not those left out in Planning). */
  readonly occurrences: readonly {
    readonly occurrence: Occurrence;
    readonly title: string;
    readonly area?: DayArea;
  }[];
  /** Future: the active Tasks whose deadline is that day. */
  readonly due: readonly { readonly task: Task; readonly area?: DayArea }[];
}

/** A day other than today; `undefined` for today. */
export function dayData(
  records: Records,
  clock: Clock,
  date: LocalDate,
): DayData | undefined {
  if (date === clock.today) return undefined;
  const refs = sprintRefs(records, clock);
  const ref = refs.find((r) => r.start <= date && date <= r.end);
  const next = refs.find((r) => r.start > date);
  const sprint = ref?.sprint;

  const areaOf = (task: Task): DayArea | undefined => {
    const area = records.areas.find((a) => a.id === task.areaId);
    if (area === undefined) return undefined;
    return {
      id: area.id,
      // A Sprint's days show its names at confirm (F5).
      name:
        (sprint && sprintAreaName(sprint, area.id, records.areas)) ?? area.name,
      color: area.color,
    };
  };
  const withArea = (task: Task) => {
    const area = areaOf(task);
    return area === undefined ? {} : { area };
  };
  const taskOf = (sprintTaskId: string, s: Sprint) =>
    records.tasks.find(
      (t) => t.id === s.tasks.find((st) => st.id === sprintTaskId)?.taskId,
    );

  const past = date < clock.today;
  const dayRecords: DayRecord[] =
    !past || sprint === undefined
      ? []
      : sprint.dailySelections
          .filter((s) => s.date === date)
          .toSorted((a, b) => (a.selectedAt < b.selectedAt ? -1 : 1))
          .flatMap((selection) => {
            const task = taskOf(selection.sprintTaskId, sprint);
            if (task === undefined) return [];
            const occurrence = records.occurrences.find(
              (o) => o.id === selection.occurrenceId,
            );
            return [
              {
                selection,
                title: task.title,
                ...withArea(task),
                ...(occurrence === undefined ? {} : { occurrence }),
                actualHours: sprint.actualTimes
                  .filter(
                    (a) =>
                      a.date === date &&
                      a.sprintTaskId === selection.sprintTaskId &&
                      a.occurrenceId === selection.occurrenceId,
                  )
                  .reduce((sum, a) => sum + a.hours, 0),
              },
            ];
          });

  // The occurrences a Sprint took in (Planning may leave some out).
  const taken = new Set(
    sprint?.tasks.flatMap((t) =>
      t.outcome === 'removed' ? [] : (t.occurrenceIds ?? []),
    ) ?? [],
  );
  const occurrences = past
    ? []
    : records.occurrences
        .filter(
          (o) =>
            o.scheduledDate === date &&
            o.state !== 'excluded' &&
            taken.has(o.id),
        )
        .flatMap((occurrence) => {
          const task = records.tasks.find((t) => t.id === occurrence.taskId);
          return task === undefined
            ? []
            : [{ occurrence, title: task.title, ...withArea(task) }];
        });
  const due = past
    ? []
    : records.tasks
        .filter((t) => t.lifecycle === 'active' && t.due === date)
        .map((task) => ({ task, ...withArea(task) }));

  return {
    date,
    today: clock.today,
    when: past ? 'past' : 'future',
    timeZone: records.user.timeZone,
    ...(ref === undefined
      ? next === undefined
        ? {}
        : { next }
      : {
          within: {
            ...ref,
            day: {
              index: daysBetween(ref.start, date) + 1,
              count: daysBetween(ref.start, ref.end) + 1,
            },
          },
        }),
    records: dayRecords,
    interrupts: past
      ? (sprint?.interrupts ?? []).filter(
          (n) => toLocalDate(n.at, records.user.timeZone) === date,
        )
      : [],
    occurrences,
    due,
  };
}
