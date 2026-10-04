import { versionKey, type Records } from '@itera/application';
import type {
  Area,
  AreaId,
  InterruptNoteId,
  PlanningCriterionId,
  SprintId,
  SprintTaskId,
  SubtaskId,
  TaskId,
  DailySelection,
  DayOfWeek,
  Estimate,
  EstimateSource,
  Occurrence,
  PlanningCriterion,
  PlanningValue,
  PlanSnapshot,
  RecurrencePattern,
  RecurrenceRule,
  Sprint,
  SprintTask,
  Task,
  User,
  UserId,
} from '@itera/domain';
import {
  actualTime,
  area,
  criterionUse,
  dailySelection,
  estimateSuggestion,
  estimateSuggestionUncertainty,
  interruptNote,
  occurrence,
  planningCriterion,
  recurrenceRule,
  recurrenceRuleVersion,
  recurrenceRuleVersionDay,
  retro,
  retroPin,
  sprint,
  sprintAreaSnapshot,
  sprintGoal,
  sprintTask,
  sprintTaskOccurrence,
  subtask,
  task,
  userSettings,
} from './schema';

// How the records of `@itera/domain` map to rows of src/db/schema.ts, both
// ways. A row has every column, NULL for an absent attribute, so two rows of
// the same record compare equal exactly when the record part is unchanged.

/** The tables of the records, each before the tables that reference it. */
export const recordTables = [
  userSettings,
  area,
  task,
  subtask,
  estimateSuggestion,
  estimateSuggestionUncertainty,
  recurrenceRule,
  recurrenceRuleVersion,
  recurrenceRuleVersionDay,
  occurrence,
  planningCriterion,
  sprint,
  sprintGoal,
  sprintAreaSnapshot,
  criterionUse,
  sprintTask,
  sprintTaskOccurrence,
  dailySelection,
  actualTime,
  interruptNote,
  retro,
  retroPin,
] as const;

export type RecordTable = (typeof recordTables)[number];
/**
 * A row of the record it holds. The revision that last wrote it is kept
 * apart (`revision`, written by saveRecords, read by loadRecords), so two
 * rows of the same record compare equal exactly when its values do.
 */
export type RowOf<T extends RecordTable> = Omit<T['$inferSelect'], 'revision'>;

/**
 * The tables of the records that have an etag (#321), with the key in
 * `RecordVersions` of the record a row holds.
 */
export const versionedTables: ReadonlyMap<
  RecordTable,
  (row: Record<string, unknown>) => string
> = new Map<RecordTable, (row: Record<string, unknown>) => string>([
  [area, (r) => versionKey.area(r.id as AreaId)],
  [task, (r) => versionKey.task(r.id as TaskId)],
  [subtask, (r) => versionKey.subtask(r.id as SubtaskId)],
  [planningCriterion, (r) => versionKey.criterion(r.id as PlanningCriterionId)],
  [sprint, (r) => versionKey.sprint(r.id as SprintId)],
  [
    sprintGoal,
    (r) => versionKey.goal(r.sprintId as SprintId, r.areaId as AreaId),
  ],
  [criterionUse, (r) => versionKey.criterionUse(r.sprintId as SprintId)],
  [sprintTask, (r) => versionKey.sprintTask(r.id as SprintTaskId)],
  [interruptNote, (r) => versionKey.interrupt(r.id as InterruptNoteId)],
  [retro, (r) => versionKey.retro(r.sprintId as SprintId)],
]);

/** Rows grouped by table, in the order they were added. */
export class RowSet {
  readonly #rows = new Map<RecordTable, unknown[]>();

  add<T extends RecordTable>(table: T, ...rows: readonly RowOf<T>[]): void {
    const list = this.#rows.get(table);
    if (list === undefined) this.#rows.set(table, [...rows]);
    else list.push(...rows);
  }

  get<T extends RecordTable>(table: T): readonly RowOf<T>[] {
    return (this.#rows.get(table) ?? []) as RowOf<T>[];
  }

  /** The rows of a table as plain objects, for code that treats every table alike. */
  plain(table: RecordTable): readonly Record<string, unknown>[] {
    return this.get(table);
  }
}

// ---------------------------------------------------------------------------
// Records → rows
// ---------------------------------------------------------------------------

export function addUserRows(rows: RowSet, user: User): void {
  rows.add(userSettings, {
    userId: user.id,
    displayName: user.displayName,
    timeZone: user.timeZone,
    weekStartsOn: user.weekStartsOn,
  });
}

export function addAreaRows(rows: RowSet, record: Area): void {
  rows.add(area, {
    id: record.id,
    userId: record.userId,
    name: record.name,
    color: record.color,
    order: record.order,
    archived: record.archived,
  });
}

export function addTaskRows(rows: RowSet, record: Task): void {
  const source = record.estimate?.source;
  rows.add(task, {
    id: record.id,
    userId: record.userId,
    title: record.title,
    description: record.description,
    areaId: record.areaId ?? null,
    due: record.due ?? null,
    priority: record.priority,
    lifecycle: record.lifecycle,
    timeBasis: record.timeBasis,
    estimateHours: record.estimate?.hours ?? null,
    estimateSetAt: record.estimate?.setAt ?? null,
    estimateSourceKind: source?.kind ?? null,
    estimateSourceSuggestionId:
      source === undefined || source.kind === 'manual'
        ? null
        : source.suggestionId,
    estimateSourceBound: source?.kind === 'adopted' ? source.bound : null,
    recurrenceRuleId: record.recurrenceRuleId ?? null,
    createdAt: record.createdAt,
    createdVia: record.createdVia,
    completedAt: record.completedAt ?? null,
    archivedAt: record.archivedAt ?? null,
  });
  record.subtasks.forEach((s, position) => {
    rows.add(subtask, {
      id: s.id,
      taskId: record.id,
      position,
      title: s.title,
      estimate: s.estimate ?? null,
      done: s.done,
      doneAt: s.doneAt ?? null,
    });
  });
  record.suggestions.forEach((s, position) => {
    rows.add(estimateSuggestion, {
      id: s.id,
      taskId: record.id,
      position,
      lo: s.lo,
      hi: s.hi,
      rationale: s.rationale,
      createdAt: s.createdAt,
      state: s.state,
    });
    s.uncertainties.forEach((text, position) => {
      rows.add(estimateSuggestionUncertainty, {
        suggestionId: s.id,
        position,
        text,
      });
    });
  });
}

export function addRuleRows(
  rows: RowSet,
  record: RecurrenceRule,
  userId: UserId,
): void {
  rows.add(recurrenceRule, {
    id: record.id,
    userId,
    taskId: record.taskId,
  });
  record.versions.forEach((v, position) => {
    const { pattern } = v;
    rows.add(recurrenceRuleVersion, {
      ruleId: record.id,
      version: v.version,
      position,
      freq: pattern.freq,
      dayOfMonth: pattern.freq === 'monthly' ? pattern.dayOfMonth : null,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo ?? null,
    });
    if (pattern.freq !== 'weekly') return;
    pattern.daysOfWeek.forEach((dayOfWeek, position) => {
      rows.add(recurrenceRuleVersionDay, {
        ruleId: record.id,
        version: v.version,
        position,
        dayOfWeek,
      });
    });
  });
}

export function addOccurrenceRows(
  rows: RowSet,
  record: Occurrence,
  userId: UserId,
): void {
  rows.add(occurrence, {
    id: record.id,
    userId,
    taskId: record.taskId,
    ruleId: record.ruleId,
    scheduledDate: record.scheduledDate,
    ruleVersion: record.ruleVersion,
    materializedAt: record.materializedAt,
    state: record.state,
    stateChangedAt: record.stateChangedAt,
  });
}

export function addCriterionRows(
  rows: RowSet,
  record: PlanningCriterion,
): void {
  const { scope } = record.policy;
  rows.add(planningCriterion, {
    id: record.id,
    userId: record.userId,
    scopeKind: scope.kind,
    scopeAreaId: scope.kind === 'area' ? scope.areaId : null,
    rangePolicy: record.policy.rangePolicy,
    sourceSprintId: record.sourceSprintId,
    state: record.state,
    replacedBy: record.replacedBy ?? null,
    createdAt: record.createdAt,
  });
}

export function addSprintRows(rows: RowSet, record: Sprint): void {
  const sprintId = record.id;
  rows.add(sprint, {
    id: sprintId,
    userId: record.userId,
    start: record.start,
    end: record.end,
    state: record.state,
    previousSprintId: record.previousSprintId ?? null,
    availableHours: record.availableHours ?? null,
    plannedAvailableHours: record.plannedAvailableHours ?? null,
    confirmedAt: record.confirmedAt ?? null,
  });
  record.goals.forEach((g, position) => {
    rows.add(sprintGoal, {
      sprintId,
      areaId: g.areaId,
      position,
      text: g.text,
      plannedText: g.plannedText ?? null,
      selfAssessment: g.selfAssessment ?? null,
    });
  });
  record.areaSnapshot.forEach((entry, position) => {
    rows.add(sprintAreaSnapshot, {
      sprintId,
      areaId: entry.areaId,
      position,
      name: entry.name,
      order: entry.order,
    });
  });
  if (record.criterionUse !== undefined) {
    const use = record.criterionUse;
    rows.add(criterionUse, {
      sprintId,
      criterionId: use.criterionId,
      appliedAtConfirm: use.appliedAtConfirm,
      retroDecision: use.retroDecision ?? null,
    });
  }
  record.tasks.forEach((t, position) => {
    rows.add(sprintTask, sprintTaskRow(t, sprintId, position));
    t.occurrenceIds?.forEach((occurrenceId, position) => {
      rows.add(sprintTaskOccurrence, {
        sprintTaskId: t.id,
        occurrenceId,
        position,
      });
    });
  });
  record.dailySelections.forEach((d, position) => {
    rows.add(dailySelection, {
      id: d.id,
      sprintId,
      position,
      date: d.date,
      sprintTaskId: d.sprintTaskId,
      occurrenceId: d.occurrenceId ?? null,
      origin: d.origin,
      resolution: d.resolution,
      selectedAt: d.selectedAt,
      startedAt: d.startedAt ?? null,
      resolvedAt: d.resolvedAt ?? null,
      closedBeforeResolution: d.closedBefore?.resolution ?? null,
      closedBeforeAt: d.closedBefore?.at ?? null,
    });
  });
  record.actualTimes.forEach((a, position) => {
    rows.add(actualTime, {
      sprintId,
      position,
      sprintTaskId: a.sprintTaskId,
      occurrenceId: a.occurrenceId ?? null,
      hours: a.hours,
      date: a.date,
      via: a.via,
      recordedAt: a.recordedAt,
    });
  });
  record.interrupts.forEach((note, position) => {
    rows.add(interruptNote, {
      id: note.id,
      sprintId,
      position,
      at: note.at,
      text: note.text,
      minutes: note.minutes ?? null,
    });
  });
  if (record.retro !== undefined) {
    const r = record.retro;
    rows.add(retro, {
      sprintId,
      startedAt: r.startedAt,
      completedAt: r.completedAt ?? null,
      reflection: r.reflection,
      improvementText: r.improvement?.text ?? null,
      improvementCriterionId: r.improvement?.criterionId ?? null,
    });
    r.pins.forEach((pin, position) => {
      rows.add(retroPin, {
        sprintId,
        position,
        kind: pin.kind,
        recordId: pin.id ?? null,
      });
    });
  }
}

function sprintTaskRow(
  t: SprintTask,
  sprintId: Sprint['id'],
  position: number,
): RowOf<typeof sprintTask> {
  const plan = t.planSnapshot;
  const value = plan?.value;
  return {
    id: t.id,
    sprintId,
    position,
    taskId: t.taskId,
    hasOccurrences: t.occurrenceIds !== undefined,
    origin: t.origin,
    addedAt: t.addedAt,
    goalLink: t.goalLink,
    outcome: t.outcome,
    planValueBase: value?.base ?? null,
    planValueLo: value === undefined || value.base === 'none' ? null : value.lo,
    planValueHi: value === undefined || value.base === 'none' ? null : value.hi,
    planValueUnestimatedSubtasks:
      value?.base === 'subtasks' ? value.unestimatedSubtasks : null,
    planValueCriterionApplied: value?.criterionApplied ?? null,
    planValueComputedAt: value?.computedAt ?? null,
    planTimeBasis: plan?.timeBasis ?? null,
    planEstimateHours: plan?.estimateHours ?? null,
    planSuggestionId: plan?.suggestion?.id ?? null,
    planSuggestionLo: plan?.suggestion?.lo ?? null,
    planSuggestionHi: plan?.suggestion?.hi ?? null,
    planOccurrenceCount: plan?.occurrenceCount ?? null,
    carriedFrom: t.carriedFrom ?? null,
  };
}

// ---------------------------------------------------------------------------
// Rows → records
// ---------------------------------------------------------------------------

/**
 * The records the rows hold. Parts must come in `position` order within
 * their parent. `null` when the user has no settings yet (no save so far).
 */
export function recordsFromRows(rows: RowSet): Records | null {
  const [settings] = rows.get(userSettings);
  if (settings === undefined) return null;
  const subtasks = groupBy(rows.get(subtask), (r) => r.taskId);
  const suggestions = groupBy(rows.get(estimateSuggestion), (r) => r.taskId);
  const uncertainties = groupBy(
    rows.get(estimateSuggestionUncertainty),
    (r) => r.suggestionId,
  );
  const versions = groupBy(rows.get(recurrenceRuleVersion), (r) => r.ruleId);
  const days = groupBy(rows.get(recurrenceRuleVersionDay), (r) =>
    ruleVersionKey(r.ruleId, r.version),
  );
  const goals = groupBy(rows.get(sprintGoal), (r) => r.sprintId);
  const snapshots = groupBy(rows.get(sprintAreaSnapshot), (r) => r.sprintId);
  const uses = groupBy(rows.get(criterionUse), (r) => r.sprintId);
  const sprintTasks = groupBy(rows.get(sprintTask), (r) => r.sprintId);
  const links = groupBy(rows.get(sprintTaskOccurrence), (r) => r.sprintTaskId);
  const selections = groupBy(rows.get(dailySelection), (r) => r.sprintId);
  const actuals = groupBy(rows.get(actualTime), (r) => r.sprintId);
  const interrupts = groupBy(rows.get(interruptNote), (r) => r.sprintId);
  const retros = groupBy(rows.get(retro), (r) => r.sprintId);
  const pins = groupBy(rows.get(retroPin), (r) => r.sprintId);

  return {
    user: {
      id: settings.userId,
      displayName: settings.displayName,
      timeZone: settings.timeZone,
      weekStartsOn: settings.weekStartsOn,
    },
    areas: rows.get(area).map((a) => ({
      id: a.id,
      userId: a.userId,
      name: a.name,
      color: a.color,
      order: a.order,
      archived: a.archived,
    })),
    tasks: rows.get(task).map((t) => ({
      id: t.id,
      userId: t.userId,
      title: t.title,
      description: t.description,
      ...optional('areaId', t.areaId),
      ...optional('due', t.due),
      priority: t.priority,
      lifecycle: t.lifecycle,
      timeBasis: t.timeBasis,
      subtasks: (subtasks.get(t.id) ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        ...optional('estimate', s.estimate),
        done: s.done,
        ...optional('doneAt', s.doneAt),
      })),
      ...optional('estimate', estimateOf(t)),
      suggestions: (suggestions.get(t.id) ?? []).map((s) => ({
        id: s.id,
        lo: s.lo,
        hi: s.hi,
        rationale: s.rationale,
        uncertainties: (uncertainties.get(s.id) ?? []).map((u) => u.text),
        createdAt: s.createdAt,
        state: s.state,
      })),
      ...optional('recurrenceRuleId', t.recurrenceRuleId),
      createdAt: t.createdAt,
      createdVia: t.createdVia,
      ...optional('completedAt', t.completedAt),
      ...optional('archivedAt', t.archivedAt),
    })),
    rules: rows.get(recurrenceRule).map((r) => ({
      id: r.id,
      taskId: r.taskId,
      versions: (versions.get(r.id) ?? []).map((v) => ({
        version: v.version,
        pattern: patternOf(
          v,
          (days.get(ruleVersionKey(v.ruleId, v.version)) ?? []).map(
            (d) => d.dayOfWeek,
          ),
        ),
        effectiveFrom: v.effectiveFrom,
        ...optional('effectiveTo', v.effectiveTo),
      })),
    })),
    occurrences: rows.get(occurrence).map((o) => ({
      id: o.id,
      taskId: o.taskId,
      ruleId: o.ruleId,
      scheduledDate: o.scheduledDate,
      ruleVersion: o.ruleVersion,
      materializedAt: o.materializedAt,
      state: o.state,
      stateChangedAt: o.stateChangedAt,
    })),
    sprints: rows.get(sprint).map((s) => {
      const [use] = uses.get(s.id) ?? [];
      const [r] = retros.get(s.id) ?? [];
      return {
        id: s.id,
        userId: s.userId,
        start: s.start,
        end: s.end,
        state: s.state,
        ...optional('previousSprintId', s.previousSprintId),
        ...optional('availableHours', s.availableHours),
        ...optional('plannedAvailableHours', s.plannedAvailableHours),
        ...optional('confirmedAt', s.confirmedAt),
        goals: (goals.get(s.id) ?? []).map((g) => ({
          areaId: g.areaId,
          text: g.text,
          ...optional('plannedText', g.plannedText),
          ...optional('selfAssessment', g.selfAssessment),
        })),
        tasks: (sprintTasks.get(s.id) ?? []).map((t) =>
          sprintTaskOf(
            t,
            (links.get(t.id) ?? []).map((l) => l.occurrenceId),
          ),
        ),
        areaSnapshot: (snapshots.get(s.id) ?? []).map((e) => ({
          areaId: e.areaId,
          name: e.name,
          order: e.order,
        })),
        ...optional(
          'criterionUse',
          use === undefined
            ? null
            : {
                criterionId: use.criterionId,
                appliedAtConfirm: use.appliedAtConfirm,
                ...optional('retroDecision', use.retroDecision),
              },
        ),
        dailySelections: (selections.get(s.id) ?? []).map(dailySelectionOf),
        actualTimes: (actuals.get(s.id) ?? []).map((a) => ({
          sprintTaskId: a.sprintTaskId,
          ...optional('occurrenceId', a.occurrenceId),
          hours: a.hours,
          date: a.date,
          via: a.via,
          recordedAt: a.recordedAt,
        })),
        interrupts: (interrupts.get(s.id) ?? []).map((n) => ({
          id: n.id,
          at: n.at,
          text: n.text,
          ...optional('minutes', n.minutes),
        })),
        ...optional(
          'retro',
          r === undefined
            ? null
            : {
                startedAt: r.startedAt,
                ...optional('completedAt', r.completedAt),
                pins: (pins.get(s.id) ?? []).map((p) => ({
                  kind: p.kind,
                  ...optional('id', p.recordId),
                })),
                reflection: r.reflection,
                ...optional(
                  'improvement',
                  r.improvementText === null
                    ? null
                    : {
                        text: r.improvementText,
                        ...optional('criterionId', r.improvementCriterionId),
                      },
                ),
              },
        ),
      };
    }),
    criteria: rows.get(planningCriterion).map((c) => ({
      id: c.id,
      userId: c.userId,
      policy: {
        scope:
          c.scopeKind === 'area'
            ? { kind: 'area', areaId: required(c.scopeAreaId, 'scopeAreaId') }
            : { kind: 'all' },
        rangePolicy: c.rangePolicy,
      },
      sourceSprintId: c.sourceSprintId,
      state: c.state,
      ...optional('replacedBy', c.replacedBy),
      createdAt: c.createdAt,
    })),
  };
}

function estimateOf(t: RowOf<typeof task>): Estimate | null {
  if (t.estimateHours === null) return null;
  return {
    hours: t.estimateHours,
    setAt: required(t.estimateSetAt, 'estimateSetAt'),
    source: estimateSourceOf(t),
  };
}

function estimateSourceOf(t: RowOf<typeof task>): EstimateSource {
  switch (required(t.estimateSourceKind, 'estimateSourceKind')) {
    case 'manual':
      return { kind: 'manual' };
    case 'adopted':
      return {
        kind: 'adopted',
        suggestionId: required(
          t.estimateSourceSuggestionId,
          'estimateSourceSuggestionId',
        ),
        bound: required(t.estimateSourceBound, 'estimateSourceBound'),
      };
    case 'edited':
      return {
        kind: 'edited',
        suggestionId: required(
          t.estimateSourceSuggestionId,
          'estimateSourceSuggestionId',
        ),
      };
  }
}

function patternOf(
  v: RowOf<typeof recurrenceRuleVersion>,
  daysOfWeek: readonly DayOfWeek[],
): RecurrencePattern {
  switch (v.freq) {
    case 'daily':
    case 'weekdays':
      return { freq: v.freq };
    case 'weekly':
      return { freq: 'weekly', daysOfWeek };
    case 'monthly':
      return {
        freq: 'monthly',
        dayOfMonth: required(v.dayOfMonth, 'dayOfMonth'),
      };
  }
}

function sprintTaskOf(
  t: RowOf<typeof sprintTask>,
  occurrenceIds: readonly Occurrence['id'][],
): SprintTask {
  return {
    id: t.id,
    taskId: t.taskId,
    ...optional('occurrenceIds', t.hasOccurrences ? occurrenceIds : null),
    origin: t.origin,
    addedAt: t.addedAt,
    goalLink: t.goalLink,
    outcome: t.outcome,
    ...optional('planSnapshot', planSnapshotOf(t)),
    ...optional('carriedFrom', t.carriedFrom),
  };
}

function planSnapshotOf(t: RowOf<typeof sprintTask>): PlanSnapshot | null {
  if (t.planValueBase === null) return null;
  return {
    value: planningValueOf(t),
    timeBasis: required(t.planTimeBasis, 'planTimeBasis'),
    ...optional('estimateHours', t.planEstimateHours),
    ...optional(
      'suggestion',
      t.planSuggestionId === null
        ? null
        : {
            id: t.planSuggestionId,
            lo: required(t.planSuggestionLo, 'planSuggestionLo'),
            hi: required(t.planSuggestionHi, 'planSuggestionHi'),
          },
    ),
    ...optional('occurrenceCount', t.planOccurrenceCount),
  };
}

function planningValueOf(t: RowOf<typeof sprintTask>): PlanningValue {
  const base = required(t.planValueBase, 'planValueBase');
  const computedAt = required(t.planValueComputedAt, 'planValueComputedAt');
  switch (base) {
    case 'none':
      return { base: 'none', criterionApplied: false, computedAt };
    case 'subtasks':
      return {
        base: 'subtasks',
        lo: required(t.planValueLo, 'planValueLo'),
        hi: required(t.planValueHi, 'planValueHi'),
        unestimatedSubtasks: required(
          t.planValueUnestimatedSubtasks,
          'planValueUnestimatedSubtasks',
        ),
        criterionApplied: false,
        computedAt,
      };
    case 'estimate':
    case 'suggestion':
      return {
        base,
        lo: required(t.planValueLo, 'planValueLo'),
        hi: required(t.planValueHi, 'planValueHi'),
        criterionApplied: required(
          t.planValueCriterionApplied,
          'planValueCriterionApplied',
        ),
        computedAt,
      };
  }
}

function dailySelectionOf(d: RowOf<typeof dailySelection>): DailySelection {
  return {
    id: d.id,
    date: d.date,
    sprintTaskId: d.sprintTaskId,
    ...optional('occurrenceId', d.occurrenceId),
    origin: d.origin,
    resolution: d.resolution,
    selectedAt: d.selectedAt,
    ...optional('startedAt', d.startedAt),
    ...optional('resolvedAt', d.resolvedAt),
    ...optional(
      'closedBefore',
      d.closedBeforeResolution === null
        ? null
        : {
            resolution: d.closedBeforeResolution,
            at: required(d.closedBeforeAt, 'closedBeforeAt'),
          },
    ),
  };
}

/** `{ [key]: value }`, or `{}` for NULL: an absent optional attribute has no key. */
function optional<K extends string, V>(
  key: K,
  value: V | null,
): { [P in K]?: V } {
  return (value === null ? {} : { [key]: value }) as { [P in K]?: V };
}

/** A column that the row's other columns say is set. */
function required<V>(value: V | null, column: string): V {
  if (value === null) throw new Error(`${column} is NULL.`);
  return value;
}

function ruleVersionKey(ruleId: string, version: number): string {
  return `${ruleId}\u0000${version}`;
}

function groupBy<R>(
  rows: readonly R[],
  key: (row: R) => string,
): Map<string, R[]> {
  const groups = new Map<string, R[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group === undefined) groups.set(k, [row]);
    else group.push(row);
  }
  return groups;
}
