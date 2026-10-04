import type {
  ActivityKind,
  Actor,
  ActualTimeVia,
  AreaColor,
  AreaId,
  CriterionPolicy,
  CriterionState,
  DailyResolution,
  DailySelection,
  DailySelectionId,
  DailySelectionOrigin,
  DayOfWeek,
  EstimateSource,
  EstimateSuggestionId,
  GoalLink,
  Instant,
  InterruptNoteId,
  LocalDate,
  OccurrenceId,
  OccurrenceState,
  PlanningCriterionId,
  PlanningValue,
  RecurrencePattern,
  RecurrenceRuleId,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintId,
  SprintState,
  SprintTaskId,
  SprintTaskOrigin,
  SprintTaskOutcome,
  SubtaskId,
  SuggestionBound,
  SuggestionState,
  TaskCreatedVia,
  TaskId,
  TaskLifecycle,
  TaskPriority,
  TimeBasis,
  TimeZone,
  UserId,
} from '@itera/domain';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// Drizzle table definitions. Migrations are generated from this file with
// `pnpm db:generate` (drizzle-kit) and applied with wrangler.

// ---------------------------------------------------------------------------
// Better Auth (src/auth/better-auth.ts, ADR 0004)
//
// The tables Better Auth 1.7.6 reads and writes with the options Itera uses:
// the core tables, the passkey plugin, and rate limits kept in the database.
// Better Auth addresses them by the export names and property names below;
// the column names follow its Drizzle schema generator (snake_case). Its
// Drizzle adapter checks this schema's columns against its own before use and
// fails on a mismatch, so after upgrading Better Auth run the tests
// (src/auth/better-auth.test.ts) and update this section. Constraints the
// generator leaves out are added where noted.
// ---------------------------------------------------------------------------

// Milliseconds since the epoch, as Better Auth's generator writes it.
const nowInMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .default(false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(nowInMs)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(nowInMs)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(nowInMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

// Links a user to a sign-in provider (Google). Passkeys live in `passkey`.
export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    // Part of Better Auth's core schema. Stays empty: passwords are not
    // enabled (Issue #121).
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(nowInMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

// Short-lived values such as the OAuth state.
export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(nowInMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(nowInMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const passkey = sqliteTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Unique, unlike the generator's plain index: Better Auth does not check
    // other users' passkeys before registering one, and sign-in looks a
    // passkey up by this ID alone.
    credentialID: text('credential_id').notNull().unique(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
    transports: text('transports'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    aaguid: text('aaguid'),
  },
  (table) => [index('passkey_userId_idx').on(table.userId)],
);

// Request counts per client IP and path (`rateLimit.storage: 'database'`).
export const rateLimit = sqliteTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  // Milliseconds since the epoch.
  lastRequest: integer('last_request').notNull(),
});

// ---------------------------------------------------------------------------
// Itera's records (src/db/records.ts, ADR 0004 「記録のテーブル」)
//
// One table per record of `@itera/domain`, and one per part of an aggregate
// (Sprint, Task, RecurrenceRule). Value objects and unions are spread over
// the owner's columns: a union keeps its discriminator (`kind`, `base`, …)
// and one column per field; an optional attribute is NULL when absent.
// Arrays whose order matters keep it in a `position` column (0-based).
//
// Every root row belongs to a Better Auth user and goes with it. Parts of an
// aggregate reference their root and go with it. References between
// aggregates (a Task's Area, a SprintTask's Task, …) have no foreign key:
// the domain decides when they may dangle (ADR 0004).
//
// A partial unique index must also be listed in src/db/save-records.ts
// (`uniqueSlots` or `fixedUniqueIndexes`), which orders the writes around it.
// ---------------------------------------------------------------------------

const owner = () =>
  text('user_id')
    .$type<UserId>()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

const instantColumn = (name: string) => text(name).$type<Instant>();
const localDateColumn = (name: string) => text(name).$type<LocalDate>();
const position = () => integer('position').notNull();
/**
 * The user's revision of the save that last wrote the row's values (not
 * only its `position`): the version of the record the row holds, sent back
 * as its etag (ADR 0004 「同時の書き込み」, #321). 0 for a row written before
 * it was kept.
 */
const revision = () => integer('revision').notNull().default(0);

/** The domain's `User`: the user's own settings, 1:1 with Better Auth's `user`. */
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .$type<UserId>()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  timeZone: text('time_zone').$type<TimeZone>().notNull(),
  weekStartsOn: integer('week_starts_on').$type<DayOfWeek>().notNull(),
  revision: revision(),
});

/**
 * The user's revision: how many times their records have been saved. Every
 * save checks and raises it in the same batch (src/db/save-records.ts).
 * No row means no save yet (revision 0). A mismatch writes 0, which the
 * check rejects, so the whole batch fails.
 *
 * `caught_up_to` is the day the system's records were brought up to by the
 * last save (「今日」 in the user's time zone then, #271): every save comes
 * after the catch-up. NULL for a save made before it was kept.
 */
export const recordRevision = sqliteTable(
  'record_revision',
  {
    userId: text('user_id')
      .$type<UserId>()
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    caughtUpTo: localDateColumn('caught_up_to'),
  },
  (table) => [check('record_revision_positive', sql`${table.revision} >= 1`)],
);

export const area = sqliteTable(
  'area',
  {
    id: text('id').$type<AreaId>().primaryKey(),
    userId: owner(),
    name: text('name').notNull(),
    color: integer('color').$type<AreaColor>().notNull(),
    order: integer('order').notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull(),
    revision: revision(),
  },
  (table) => [index('area_user_id_idx').on(table.userId)],
);

export const task = sqliteTable(
  'task',
  {
    id: text('id').$type<TaskId>().primaryKey(),
    userId: owner(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    areaId: text('area_id').$type<AreaId>(),
    due: localDateColumn('due'),
    priority: text('priority').$type<TaskPriority>().notNull(),
    lifecycle: text('lifecycle').$type<TaskLifecycle>().notNull(),
    timeBasis: text('time_basis').$type<TimeBasis>().notNull(),
    // Estimate: all NULL when the Task has none.
    estimateHours: real('estimate_hours'),
    estimateSetAt: instantColumn('estimate_set_at'),
    estimateSourceKind: text('estimate_source_kind').$type<
      EstimateSource['kind']
    >(),
    // `adopted` and `edited` only.
    estimateSourceSuggestionId: text(
      'estimate_source_suggestion_id',
    ).$type<EstimateSuggestionId>(),
    // `adopted` only.
    estimateSourceBound: text('estimate_source_bound').$type<SuggestionBound>(),
    recurrenceRuleId: text('recurrence_rule_id').$type<RecurrenceRuleId>(),
    createdAt: instantColumn('created_at').notNull(),
    createdVia: text('created_via').$type<TaskCreatedVia>().notNull(),
    completedAt: instantColumn('completed_at'),
    archivedAt: instantColumn('archived_at'),
    revision: revision(),
  },
  (table) => [index('task_user_id_idx').on(table.userId)],
);

export const subtask = sqliteTable(
  'subtask',
  {
    id: text('id').$type<SubtaskId>().primaryKey(),
    taskId: text('task_id')
      .$type<TaskId>()
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    position: position(),
    title: text('title').notNull(),
    estimate: real('estimate'),
    done: integer('done', { mode: 'boolean' }).notNull(),
    doneAt: instantColumn('done_at'),
    revision: revision(),
  },
  (table) => [index('subtask_task_id_idx').on(table.taskId)],
);

export const estimateSuggestion = sqliteTable(
  'estimate_suggestion',
  {
    id: text('id').$type<EstimateSuggestionId>().primaryKey(),
    taskId: text('task_id')
      .$type<TaskId>()
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    position: position(),
    lo: real('lo').notNull(),
    hi: real('hi').notNull(),
    rationale: text('rationale').notNull(),
    createdAt: instantColumn('created_at').notNull(),
    state: text('state').$type<SuggestionState>().notNull(),
    revision: revision(),
  },
  (table) => [
    index('estimate_suggestion_task_id_idx').on(table.taskId),
    // At most one suggestion on show per Task (packages/domain README, #20).
    uniqueIndex('estimate_suggestion_presented_idx')
      .on(table.taskId)
      .where(sql`${table.state} = 'presented'`),
  ],
);

export const estimateSuggestionUncertainty = sqliteTable(
  'estimate_suggestion_uncertainty',
  {
    suggestionId: text('suggestion_id')
      .$type<EstimateSuggestionId>()
      .notNull()
      .references(() => estimateSuggestion.id, { onDelete: 'cascade' }),
    position: position(),
    text: text('text').notNull(),
    revision: revision(),
  },
  (table) => [primaryKey({ columns: [table.suggestionId, table.position] })],
);

export const recurrenceRule = sqliteTable(
  'recurrence_rule',
  {
    id: text('id').$type<RecurrenceRuleId>().primaryKey(),
    // The domain's rule has no owner; it is the user whose records hold it.
    userId: owner(),
    taskId: text('task_id').$type<TaskId>().notNull(),
    revision: revision(),
  },
  (table) => [index('recurrence_rule_user_id_idx').on(table.userId)],
);

export const recurrenceRuleVersion = sqliteTable(
  'recurrence_rule_version',
  {
    ruleId: text('rule_id')
      .$type<RecurrenceRuleId>()
      .notNull()
      .references(() => recurrenceRule.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    position: position(),
    freq: text('freq').$type<RecurrencePattern['freq']>().notNull(),
    // `monthly` only. The days of a `weekly` pattern are rows of
    // recurrence_rule_version_day.
    dayOfMonth: integer('day_of_month'),
    effectiveFrom: localDateColumn('effective_from').notNull(),
    effectiveTo: localDateColumn('effective_to'),
    revision: revision(),
  },
  (table) => [primaryKey({ columns: [table.ruleId, table.version] })],
);

export const recurrenceRuleVersionDay = sqliteTable(
  'recurrence_rule_version_day',
  {
    ruleId: text('rule_id').$type<RecurrenceRuleId>().notNull(),
    version: integer('version').notNull(),
    position: position(),
    dayOfWeek: integer('day_of_week').$type<DayOfWeek>().notNull(),
    revision: revision(),
  },
  (table) => [
    primaryKey({ columns: [table.ruleId, table.version, table.position] }),
    foreignKey({
      columns: [table.ruleId, table.version],
      foreignColumns: [
        recurrenceRuleVersion.ruleId,
        recurrenceRuleVersion.version,
      ],
    }).onDelete('cascade'),
  ],
);

export const occurrence = sqliteTable(
  'occurrence',
  {
    id: text('id').$type<OccurrenceId>().primaryKey(),
    // The domain's occurrence has no owner, as for its rule.
    userId: owner(),
    taskId: text('task_id').$type<TaskId>().notNull(),
    ruleId: text('rule_id').$type<RecurrenceRuleId>().notNull(),
    scheduledDate: localDateColumn('scheduled_date').notNull(),
    ruleVersion: integer('rule_version').notNull(),
    materializedAt: instantColumn('materialized_at').notNull(),
    state: text('state').$type<OccurrenceState>().notNull(),
    stateChangedAt: instantColumn('state_changed_at').notNull(),
    revision: revision(),
  },
  (table) => [
    index('occurrence_user_id_idx').on(table.userId),
    // A rule comes up once a day at most: generation skips dates that
    // already have an occurrence (generateOccurrences).
    uniqueIndex('occurrence_rule_date_idx').on(
      table.ruleId,
      table.scheduledDate,
    ),
  ],
);

export const planningCriterion = sqliteTable(
  'planning_criterion',
  {
    id: text('id').$type<PlanningCriterionId>().primaryKey(),
    userId: owner(),
    // CriterionPolicy
    scopeKind: text('scope_kind')
      .$type<CriterionPolicy['scope']['kind']>()
      .notNull(),
    // `area` only.
    scopeAreaId: text('scope_area_id').$type<AreaId>(),
    rangePolicy: text('range_policy').$type<SuggestionBound>().notNull(),
    sourceSprintId: text('source_sprint_id').$type<SprintId>().notNull(),
    state: text('state').$type<CriterionState>().notNull(),
    replacedBy: text('replaced_by').$type<PlanningCriterionId>(),
    createdAt: instantColumn('created_at').notNull(),
    revision: revision(),
  },
  (table) => [
    index('planning_criterion_user_id_idx').on(table.userId),
    // Invariant 35: at most one active criterion.
    uniqueIndex('planning_criterion_active_idx')
      .on(table.userId)
      .where(sql`${table.state} = 'active'`),
  ],
);

export const sprint = sqliteTable(
  'sprint',
  {
    id: text('id').$type<SprintId>().primaryKey(),
    userId: owner(),
    start: localDateColumn('start').notNull(),
    end: localDateColumn('end').notNull(),
    state: text('state').$type<SprintState>().notNull(),
    previousSprintId: text('previous_sprint_id').$type<SprintId>(),
    availableHours: real('available_hours'),
    plannedAvailableHours: real('planned_available_hours'),
    confirmedAt: instantColumn('confirmed_at'),
    revision: revision(),
  },
  (table) => [
    // Invariant 11, in part: one Sprint per week start. Overlapping periods
    // with different starts are left to the domain.
    uniqueIndex('sprint_user_start_idx').on(table.userId, table.start),
    // Invariant 11: one active Sprint at a time.
    uniqueIndex('sprint_active_idx')
      .on(table.userId)
      .where(sql`${table.state} = 'active'`),
  ],
);

const sprintPart = () =>
  text('sprint_id')
    .$type<SprintId>()
    .notNull()
    .references(() => sprint.id, { onDelete: 'cascade' });

export const sprintGoal = sqliteTable(
  'sprint_goal',
  {
    sprintId: sprintPart(),
    areaId: text('area_id').$type<AreaId>().notNull(),
    position: position(),
    text: text('text').notNull(),
    plannedText: text('planned_text'),
    selfAssessment: text('self_assessment').$type<SelfAssessment>(),
    revision: revision(),
  },
  // Invariant 13: one Goal per Sprint and Area.
  (table) => [primaryKey({ columns: [table.sprintId, table.areaId] })],
);

export const sprintAreaSnapshot = sqliteTable(
  'sprint_area_snapshot',
  {
    sprintId: sprintPart(),
    areaId: text('area_id').$type<AreaId>().notNull(),
    position: position(),
    name: text('name').notNull(),
    order: integer('order').notNull(),
    revision: revision(),
  },
  (table) => [primaryKey({ columns: [table.sprintId, table.areaId] })],
);

/** A Sprint's CriterionUse (0..1). */
export const criterionUse = sqliteTable('criterion_use', {
  sprintId: text('sprint_id')
    .$type<SprintId>()
    .primaryKey()
    .references(() => sprint.id, { onDelete: 'cascade' }),
  criterionId: text('criterion_id').$type<PlanningCriterionId>().notNull(),
  appliedAtConfirm: integer('applied_at_confirm', {
    mode: 'boolean',
  }).notNull(),
  retroDecision: text('retro_decision').$type<RetroDecision>(),
  revision: revision(),
});

export const sprintTask = sqliteTable(
  'sprint_task',
  {
    id: text('id').$type<SprintTaskId>().primaryKey(),
    sprintId: sprintPart(),
    position: position(),
    taskId: text('task_id').$type<TaskId>().notNull(),
    // Whether `occurrenceIds` is present (a recurring Task's SprintTask, even
    // with every occurrence excluded). The IDs are sprint_task_occurrence.
    hasOccurrences: integer('has_occurrences', { mode: 'boolean' }).notNull(),
    origin: text('origin').$type<SprintTaskOrigin>().notNull(),
    addedAt: instantColumn('added_at').notNull(),
    goalLink: text('goal_link').$type<GoalLink>().notNull(),
    outcome: text('outcome').$type<SprintTaskOutcome>().notNull(),
    // PlanSnapshot: all NULL when absent. Its PlanningValue is a union on
    // `base`; `lo`/`hi` are NULL for `none`, and `unestimated_subtasks` is
    // set for `subtasks` only.
    planValueBase: text('plan_value_base').$type<PlanningValue['base']>(),
    planValueLo: real('plan_value_lo'),
    planValueHi: real('plan_value_hi'),
    planValueUnestimatedSubtasks: integer('plan_value_unestimated_subtasks'),
    planValueCriterionApplied: integer('plan_value_criterion_applied', {
      mode: 'boolean',
    }),
    planValueComputedAt: instantColumn('plan_value_computed_at'),
    planTimeBasis: text('plan_time_basis').$type<TimeBasis>(),
    planEstimateHours: real('plan_estimate_hours'),
    planSuggestionId: text('plan_suggestion_id').$type<EstimateSuggestionId>(),
    planSuggestionLo: real('plan_suggestion_lo'),
    planSuggestionHi: real('plan_suggestion_hi'),
    planOccurrenceCount: integer('plan_occurrence_count'),
    carriedFrom: text('carried_from').$type<SprintTaskId>(),
    revision: revision(),
  },
  (table) => [
    index('sprint_task_sprint_id_idx').on(table.sprintId),
    // Invariant 14: a non-recurring Task has one SprintTask per Sprint. A
    // recurring one may have more (an occurrence added mid-Sprint).
    uniqueIndex('sprint_task_once_idx')
      .on(table.sprintId, table.taskId)
      .where(sql`${table.hasOccurrences} = 0`),
  ],
);

/** A SprintTask's `occurrenceIds`. */
export const sprintTaskOccurrence = sqliteTable(
  'sprint_task_occurrence',
  {
    sprintTaskId: text('sprint_task_id')
      .$type<SprintTaskId>()
      .notNull()
      .references(() => sprintTask.id, { onDelete: 'cascade' }),
    occurrenceId: text('occurrence_id').$type<OccurrenceId>().notNull(),
    position: position(),
    revision: revision(),
  },
  (table) => [
    primaryKey({ columns: [table.sprintTaskId, table.occurrenceId] }),
  ],
);

export const dailySelection = sqliteTable(
  'daily_selection',
  {
    id: text('id').$type<DailySelectionId>().primaryKey(),
    sprintId: sprintPart(),
    position: position(),
    date: localDateColumn('date').notNull(),
    sprintTaskId: text('sprint_task_id')
      .$type<SprintTaskId>()
      .notNull()
      .references(() => sprintTask.id),
    occurrenceId: text('occurrence_id').$type<OccurrenceId>(),
    origin: text('origin').$type<DailySelectionOrigin>().notNull(),
    resolution: text('resolution').$type<DailyResolution>().notNull(),
    selectedAt: instantColumn('selected_at').notNull(),
    startedAt: instantColumn('started_at'),
    resolvedAt: instantColumn('resolved_at'),
    // `closedBefore`: both NULL when absent.
    closedBeforeResolution: text('closed_before_resolution').$type<
      NonNullable<DailySelection['closedBefore']>['resolution']
    >(),
    closedBeforeAt: instantColumn('closed_before_at'),
    revision: revision(),
  },
  (table) => [
    index('daily_selection_sprint_id_idx').on(table.sprintId),
    // Invariant 21: one per day and SprintTask, or per day and occurrence
    // for a recurring one. NULLs are distinct in a unique index, so the
    // non-recurring case has its own.
    uniqueIndex('daily_selection_task_date_idx')
      .on(table.sprintTaskId, table.date)
      .where(sql`${table.occurrenceId} is null`),
    uniqueIndex('daily_selection_occurrence_date_idx').on(
      table.sprintTaskId,
      table.occurrenceId,
      table.date,
    ),
  ],
);

/** A Sprint's `actualTimes`. Append-only and without IDs: keyed by position. */
export const actualTime = sqliteTable(
  'actual_time',
  {
    sprintId: sprintPart(),
    position: position(),
    sprintTaskId: text('sprint_task_id')
      .$type<SprintTaskId>()
      .notNull()
      .references(() => sprintTask.id),
    occurrenceId: text('occurrence_id').$type<OccurrenceId>(),
    hours: real('hours').notNull(),
    date: localDateColumn('date').notNull(),
    via: text('via').$type<ActualTimeVia>().notNull(),
    recordedAt: instantColumn('recorded_at').notNull(),
    revision: revision(),
  },
  (table) => [
    primaryKey({ columns: [table.sprintId, table.position] }),
    index('actual_time_sprint_task_id_idx').on(table.sprintTaskId),
  ],
);

export const interruptNote = sqliteTable(
  'interrupt_note',
  {
    id: text('id').$type<InterruptNoteId>().primaryKey(),
    sprintId: sprintPart(),
    position: position(),
    at: instantColumn('at').notNull(),
    text: text('text').notNull(),
    minutes: real('minutes'),
    revision: revision(),
  },
  (table) => [index('interrupt_note_sprint_id_idx').on(table.sprintId)],
);

/** A Sprint's Retro (0..1) and its RetroImprovement (0..1). */
export const retro = sqliteTable('retro', {
  sprintId: text('sprint_id')
    .$type<SprintId>()
    .primaryKey()
    .references(() => sprint.id, { onDelete: 'cascade' }),
  startedAt: instantColumn('started_at').notNull(),
  completedAt: instantColumn('completed_at'),
  reflection: text('reflection').notNull(),
  // NULL when there is no improvement.
  improvementText: text('improvement_text'),
  improvementCriterionId: text(
    'improvement_criterion_id',
  ).$type<PlanningCriterionId>(),
  revision: revision(),
});

/** A Retro's `pins`. Without IDs: keyed by position. */
export const retroPin = sqliteTable(
  'retro_pin',
  {
    sprintId: text('sprint_id')
      .$type<SprintId>()
      .notNull()
      .references(() => retro.sprintId, { onDelete: 'cascade' }),
    position: position(),
    kind: text('kind').$type<RetroPin['kind']>().notNull(),
    // NULL for `availableHours`.
    recordId: text('record_id'),
    revision: revision(),
  },
  (table) => [primaryKey({ columns: [table.sprintId, table.position] })],
);

/**
 * The append-only Activity log. The common fields are columns; the rest of
 * each kind is JSON in `content`, never searched (ADR 0004) but for the one
 * check of a deleted InterruptNote (below). Entries are
 * ordered by the revision of the save that appended them, then `position`.
 */
export const activity = sqliteTable(
  'activity',
  {
    userId: owner(),
    revision: integer('revision').notNull(),
    position: position(),
    at: instantColumn('at').notNull(),
    actor: text('actor').$type<Actor>().notNull(),
    kind: text('kind').$type<ActivityKind>().notNull(),
    content: text('content', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.revision, table.position] }),
    // The one place the log is searched: whether the user deleted an
    // InterruptNote (src/db/deleted-interrupts.ts, ADR 0006 「消した記録を戻す操作の照合」).
    index('activity_interrupt_deleted_idx')
      .on(sql`${table.content} ->> '$.interruptId'`)
      .where(sql`${table.kind} = 'interruptDeleted'`),
  ],
);

/**
 * The writes the user has made, by their Idempotency-Key (ADR 0006
 * 冪等キー): what each one answered, so that the same write sent again
 * answers the same without being made twice. A row is written in the
 * write's own batch, so it exists exactly when the write was saved. Rows
 * older than 24 hours are deleted by the user's next write
 * (src/db/idempotency.ts).
 */
export const idempotencyKey = sqliteTable(
  'idempotency_key',
  {
    userId: owner(),
    /** The UUID of the header, in lowercase. */
    key: text('key').notNull(),
    /** SHA-256 of the method, path, query and body, in hex. */
    fingerprint: text('fingerprint').notNull(),
    status: integer('status').notNull(),
    /** The response's JSON as it was sent; NULL without a body (204). */
    body: text('body'),
    /**
     * The response's ETag: the record's new etag after a write that
     * replaced its values (#321). NULL for other writes.
     */
    etag: text('etag'),
    createdAt: instantColumn('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    index('idempotency_key_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);
