import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type { RecurrenceRuleId, TaskId } from './shared/ids';
import { err } from './shared/result';
import {
  addDays,
  dayOfWeek,
  type DayOfWeek,
  type LocalDate,
} from './shared/time';
import type { Occurrence } from './occurrence';
import type { Task } from './task';

/**
 * The basic rules of PRD §6: every day, weekdays, every week on given days,
 * every month on a given day. Nothing more elaborate (PRD §11).
 */
export type RecurrencePattern =
  | { readonly freq: 'daily' }
  /** Monday to Friday. */
  | { readonly freq: 'weekdays' }
  | { readonly freq: 'weekly'; readonly daysOfWeek: readonly DayOfWeek[] }
  /**
   * `dayOfMonth` 29–31 falls on the last day of a shorter month (31 in
   * February is the 28th or 29th), so the rule still happens every month.
   */
  | { readonly freq: 'monthly'; readonly dayOfMonth: number };

/**
 * One version of a rule. `effectiveTo` is inclusive: the previous version
 * ends the day before the next one's `effectiveFrom`.
 */
export interface RecurrenceRuleVersion {
  readonly version: number;
  readonly pattern: RecurrencePattern;
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo?: LocalDate;
}

/**
 * How a recurring Task repeats. The rule records no completions or skips;
 * those belong to each Occurrence (invariant 30). A change adds a version
 * and never rewrites one that has taken effect, so occurrences generated
 * from an earlier version keep their meaning (invariant 31). Only a latest
 * version that has not taken effect yet is replaced (F39). An ended rule's
 * latest version has an `effectiveTo`; the rule is off its Task (which keeps
 * `taskId` here) and is never changed again (F41).
 */
export interface RecurrenceRule {
  readonly id: RecurrenceRuleId;
  readonly taskId: TaskId;
  /** Oldest first. The last one is the latest. */
  readonly versions: readonly RecurrenceRuleVersion[];
}

export function validatePattern(pattern: RecurrencePattern): string | null {
  switch (pattern.freq) {
    case 'daily':
    case 'weekdays':
      return null;
    case 'weekly': {
      const days = pattern.daysOfWeek;
      if (days.length === 0) return 'A weekly rule needs at least one day.';
      if (new Set(days).size !== days.length) return 'Days of week repeat.';
      if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        return 'Days of week must be 0–6.';
      }
      return null;
    }
    case 'monthly':
      return Number.isInteger(pattern.dayOfMonth) &&
        pattern.dayOfMonth >= 1 &&
        pattern.dayOfMonth <= 31
        ? null
        : 'Day of month must be 1–31.';
  }
}

export interface CreateRecurrenceRuleInput {
  readonly id: RecurrenceRuleId;
  readonly pattern: RecurrencePattern;
  /**
   * The first day the rule applies: the start of the next Sprint whose
   * occurrences have not been generated yet (decided by the Sprint code).
   */
  readonly effectiveFrom: LocalDate;
}

/**
 * Makes an active, non-recurring Task recurring. Creates version 1; no
 * occurrences are generated here (invariant 32).
 */
export function createRecurrenceRule(
  task: Task,
  input: CreateRecurrenceRuleInput,
  ctx: CommandContext,
): CommandResult<{ readonly task: Task; readonly rule: RecurrenceRule }> {
  if (task.recurrenceRuleId !== undefined) {
    return err('invalidInput', 'The Task already has a recurrence rule.');
  }
  if (task.lifecycle !== 'active') {
    return err(
      'invalidTransition',
      `Cannot make a ${task.lifecycle} Task recurring.`,
    );
  }
  const problem = validatePattern(input.pattern);
  if (problem !== null) return err('invalidInput', problem);

  const rule: RecurrenceRule = {
    id: input.id,
    taskId: task.id,
    versions: [
      {
        version: 1,
        pattern: input.pattern,
        effectiveFrom: input.effectiveFrom,
      },
    ],
  };
  return applied({ task: { ...task, recurrenceRuleId: rule.id }, rule }, [
    {
      kind: 'recurrenceRuleCreated',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      ruleId: rule.id,
      version: 1,
      effectiveFrom: input.effectiveFrom,
    },
  ]);
}

/**
 * Adds a version that takes effect on `effectiveFrom` (the start of the next
 * Sprint not yet confirmed, F1) and ends the latest version the day before.
 * Days before `effectiveFrom` keep their version, so generated occurrences
 * and the current Sprint are untouched (invariant 31).
 *
 * When the latest version starts on `effectiveFrom` too, it has not taken
 * effect yet, so its pattern is replaced instead of adding another version
 * (F39). If the replacement is the previous version's pattern, the latest
 * version is dropped and the previous one goes on.
 */
export interface ChangeRecurrenceRuleInput {
  readonly pattern: RecurrencePattern;
  /**
   * The start of the next Sprint not yet confirmed. This function only
   * checks that versions stay in order; choosing a day that leaves
   * confirmed Sprints untouched is the Sprint code's job (#22).
   */
  readonly effectiveFrom: LocalDate;
}

export function changeRecurrenceRule(
  rule: RecurrenceRule,
  input: ChangeRecurrenceRuleInput,
  ctx: CommandContext,
): CommandResult<RecurrenceRule> {
  const { pattern, effectiveFrom } = input;
  const problem = validatePattern(pattern);
  if (problem !== null) return err('invalidInput', problem);
  if (ruleEndsOn(rule) !== undefined) {
    return err('invalidTransition', 'The rule has ended.');
  }
  const latest = latestVersion(rule);
  // Changing to the pattern already in place changes nothing.
  if (samePattern(latest.pattern, pattern)) return applied(rule, []);
  if (effectiveFrom < latest.effectiveFrom) {
    return err(
      'invalidInput',
      `A new version cannot start before the latest one (${latest.effectiveFrom}).`,
    );
  }
  const versions =
    effectiveFrom === latest.effectiveFrom
      ? replaceLatest(rule.versions, latest, pattern)
      : [
          ...rule.versions.slice(0, -1),
          { ...latest, effectiveTo: addDays(effectiveFrom, -1) },
          { version: latest.version + 1, pattern, effectiveFrom },
        ];
  const changed = { ...rule, versions };
  return applied(changed, [
    {
      kind: 'recurrenceRuleChanged',
      at: ctx.now,
      actor: ctx.actor,
      taskId: rule.taskId,
      ruleId: rule.id,
      version: latestVersion(changed).version,
      effectiveFrom,
    },
  ]);
}

/**
 * Replaces the pattern of the latest version, which has not taken effect
 * yet. Going back to the previous version's pattern drops the latest
 * version and lets the previous one go on (F39).
 */
function replaceLatest(
  versions: readonly RecurrenceRuleVersion[],
  latest: RecurrenceRuleVersion,
  pattern: RecurrencePattern,
): RecurrenceRuleVersion[] {
  const earlier = versions.slice(0, -1);
  const previous = earlier.at(-1);
  if (previous !== undefined && samePattern(previous.pattern, pattern)) {
    return [
      ...earlier.slice(0, -1),
      {
        version: previous.version,
        pattern: previous.pattern,
        effectiveFrom: previous.effectiveFrom,
      },
    ];
  }
  return [...earlier, { ...latest, pattern }];
}

export interface EndRecurrenceRuleInput {
  /**
   * The first day without the rule: the start of the next Sprint not yet
   * confirmed (decided by the Sprint code, as for a change).
   */
  readonly endFrom: LocalDate;
}

/**
 * Ends the rule (F41): the latest version ends the day before `endFrom`, so
 * the rule produces no date from then on. Days before keep their version
 * (invariant 31). Versions that would only take effect from `endFrom` on
 * are dropped, as a change to them replaces them (F39). A rule with no
 * version in effect before `endFrom` cannot be ended; it is removed instead
 * (`endRuleForNextSprint`).
 */
export function endRecurrenceRule(
  rule: RecurrenceRule,
  input: EndRecurrenceRuleInput,
  ctx: CommandContext,
): CommandResult<RecurrenceRule> {
  if (ruleEndsOn(rule) !== undefined) {
    return err('invalidTransition', 'The rule has already ended.');
  }
  const kept = rule.versions.filter((v) => v.effectiveFrom < input.endFrom);
  const last = kept.at(-1);
  if (last === undefined) {
    return err(
      'invalidInput',
      `The rule is not in effect before ${input.endFrom}.`,
    );
  }
  const effectiveTo = addDays(input.endFrom, -1);
  return applied(
    { ...rule, versions: [...kept.slice(0, -1), { ...last, effectiveTo }] },
    [
      {
        kind: 'recurrenceRuleEnded',
        at: ctx.now,
        actor: ctx.actor,
        taskId: rule.taskId,
        ruleId: rule.id,
        version: last.version,
        effectiveTo,
      },
    ],
  );
}

/** The last day of an ended rule (F41); `undefined` while it goes on. */
export function ruleEndsOn(rule: RecurrenceRule): LocalDate | undefined {
  return latestVersion(rule).effectiveTo;
}

/**
 * The rule the Task repeats by on `today`, as the Backlog shows it: the
 * Task's own rule, or one that has ended (F41) and whose last day has not
 * passed. An ended rule is off the Task, so the Task is one-off for the
 * Sprints after it; until its last day the Backlog still shows it recurring.
 */
export function recurrenceOf(
  task: Task,
  rules: readonly RecurrenceRule[],
  today: LocalDate,
): RecurrenceRule | undefined {
  if (task.recurrenceRuleId !== undefined) {
    return rules.find((r) => r.id === task.recurrenceRuleId);
  }
  return rules.find((r) => {
    const endsOn = r.taskId === task.id ? ruleEndsOn(r) : undefined;
    return endsOn !== undefined && today <= endsOn;
  });
}

export function samePattern(
  a: RecurrencePattern,
  b: RecurrencePattern,
): boolean {
  switch (a.freq) {
    case 'daily':
    case 'weekdays':
      return b.freq === a.freq;
    case 'weekly':
      return (
        b.freq === 'weekly' &&
        a.daysOfWeek.length === b.daysOfWeek.length &&
        a.daysOfWeek.every((day) => b.daysOfWeek.includes(day))
      );
    case 'monthly':
      return b.freq === 'monthly' && a.dayOfMonth === b.dayOfMonth;
  }
}

export function latestVersion(rule: RecurrenceRule): RecurrenceRuleVersion {
  const latest = rule.versions.at(-1);
  if (latest === undefined) throw new Error(`Rule ${rule.id} has no version.`);
  return latest;
}

/** The version in effect on `date`, if any. */
export function versionOn(
  rule: RecurrenceRule,
  date: LocalDate,
): RecurrenceRuleVersion | undefined {
  return rule.versions.find(
    (v) =>
      v.effectiveFrom <= date &&
      (v.effectiveTo === undefined || date <= v.effectiveTo),
  );
}

export function matchesPattern(
  pattern: RecurrencePattern,
  date: LocalDate,
): boolean {
  switch (pattern.freq) {
    case 'daily':
      return true;
    case 'weekdays': {
      const day = dayOfWeek(date);
      return day >= 1 && day <= 5;
    }
    case 'weekly':
      return pattern.daysOfWeek.includes(dayOfWeek(date));
    case 'monthly': {
      const day = Number(date.slice(8, 10));
      const lastDay = Number(addDays(firstOfNextMonth(date), -1).slice(8, 10));
      return day === Math.min(pattern.dayOfMonth, lastDay);
    }
  }
}

function firstOfNextMonth(date: LocalDate): LocalDate {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const next =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return next as LocalDate;
}

/**
 * A date the rule produces, with the version that produced it. Projected
 * dates are computed for display and never stored (Occurrence has no
 * "projected" state).
 */
export interface ScheduledDate {
  readonly scheduledDate: LocalDate;
  readonly ruleVersion: number;
}

/** Every date from `start` to `end` (inclusive) that the rule produces. */
export function scheduledDates(
  rule: RecurrenceRule,
  start: LocalDate,
  end: LocalDate,
): readonly ScheduledDate[] {
  const dates: ScheduledDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const version = versionOn(rule, date);
    if (version !== undefined && matchesPattern(version.pattern, date)) {
      dates.push({ scheduledDate: date, ruleVersion: version.version });
    }
  }
  return dates;
}

/** Longer than any gap between two dates of a basic rule. */
const PROJECTION_HORIZON_DAYS = 400;

export interface NextOccurrenceOptions {
  /** Today, in the user's time zone. */
  readonly today: LocalDate;
  /**
   * The first day not covered by a generated Sprint period, from which the
   * rule is projected. Days before it only count if an occurrence exists.
   */
  readonly projectFrom: LocalDate;
}

export interface NextOccurrence extends ScheduledDate {
  /** `true` for a generated, pending occurrence; `false` for a projection. */
  readonly generated: boolean;
}

/**
 * The next time the Task comes up (Backlog: 「次は 10/4 (日)」). A pending
 * occurrence from today on wins; otherwise the rule is projected from
 * `projectFrom`. An excluded occurrence is not "next".
 */
export function nextOccurrence(
  rule: RecurrenceRule,
  occurrences: readonly Occurrence[],
  options: NextOccurrenceOptions,
): NextOccurrence | undefined {
  const pending = occurrences
    .filter(
      (o) =>
        o.ruleId === rule.id &&
        o.state === 'pending' &&
        o.scheduledDate >= options.today,
    )
    .toSorted((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1))[0];
  if (pending !== undefined) {
    return {
      scheduledDate: pending.scheduledDate,
      ruleVersion: pending.ruleVersion,
      generated: true,
    };
  }

  // A day that already has an occurrence (done, skipped, excluded, missed)
  // is never projected again, whatever `projectFrom` says.
  const taken = new Set(
    occurrences.filter((o) => o.ruleId === rule.id).map((o) => o.scheduledDate),
  );
  const from =
    options.projectFrom > options.today ? options.projectFrom : options.today;
  const first = scheduledDates(
    rule,
    from,
    addDays(from, PROJECTION_HORIZON_DAYS),
  ).find((s) => !taken.has(s.scheduledDate));
  return first === undefined ? undefined : { ...first, generated: false };
}

/** What the Backlog row of a recurring Task shows (one row per rule, invariant 34). */
export interface RecurrenceSummary {
  /**
   * The pattern in effect on `today`, or, before the rule starts, the first
   * version that will take effect.
   */
  readonly pattern: RecurrencePattern;
  /**
   * A change that takes effect after `today` (「次の Sprint から反映」 on the
   * Backlog row). On the very day a change takes effect it is already the
   * current pattern; the confirmation right after changing comes from the
   * change command's result, not from this summary.
   */
  readonly upcoming?: {
    readonly pattern: RecurrencePattern;
    readonly effectiveFrom: LocalDate;
  };
  readonly next?: NextOccurrence;
  /** The last day of an ended rule (F41). */
  readonly endsOn?: LocalDate;
}

/**
 * The values for a recurring Task's single Backlog row. Wording (「毎週 土」,
 * 「次は 10/4 (日)」) is the UI's job, following docs/design/content.md.
 */
export function recurrenceSummary(
  rule: RecurrenceRule,
  occurrences: readonly Occurrence[],
  options: NextOccurrenceOptions,
): RecurrenceSummary {
  const latest = latestVersion(rule);
  const current =
    versionOn(rule, options.today) ??
    rule.versions.find(
      (v) =>
        v.effectiveFrom > options.today &&
        (v.effectiveTo === undefined || v.effectiveFrom <= v.effectiveTo),
    ) ??
    latest;
  const next = nextOccurrence(rule, occurrences, options);
  const endsOn = ruleEndsOn(rule);
  return {
    pattern: current.pattern,
    ...(latest !== current && latest.effectiveFrom > options.today
      ? {
          upcoming: {
            pattern: latest.pattern,
            effectiveFrom: latest.effectiveFrom,
          },
        }
      : {}),
    ...(next === undefined ? {} : { next }),
    ...(endsOn === undefined ? {} : { endsOn }),
  };
}
