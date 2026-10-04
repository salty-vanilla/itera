import type { Records } from '@itera/application';
import {
  id,
  instant,
  localDate,
  timeZone,
  type Activity,
  type Area,
  type Occurrence,
  type PlanningCriterion,
  type RecurrenceRule,
  type Sprint,
  type Task,
  type User,
  type UserId,
} from '@itera/domain';
import { getTableName, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { afterEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { loadRecords } from './load-records';
import { createMemoryDatabase } from './memory-database';
import { recordTables } from './record-rows';
import type { LoadedRecords } from './records';
import { createRecordingDatabase } from './recording-database';
import { fixedUniqueIndexes, saveRecords, uniqueSlots } from './save-records';
import { activity, recordRevision, user as authUser } from './schema';

// IDs in the TypeID shape (ADR 0004 「ID の形式」). Fixed values: generating
// TypeIDs is #264's.
const tid = (prefix: string, n: number) =>
  `${prefix}_01k6p${String(n).padStart(21, '0')}`;

const at = (minute: number) =>
  instant(`2026-09-28T00:${String(minute).padStart(2, '0')}:00.000Z`);

const alice = id<'User'>(tid('user', 1));
const bob = id<'User'>(tid('user', 2));

function userOf(userId: UserId): User {
  return {
    id: userId,
    displayName: 'Alice',
    timeZone: timeZone('Asia/Tokyo'),
    weekStartsOn: 1,
  };
}

/**
 * Records covering every optional attribute both present and absent, and
 * every form of each union, for one user. `n` keeps two users' IDs apart.
 */
function recordsOf(userId: UserId, n: number): Records {
  const ids = (prefix: string, i: number) => tid(prefix, n * 100 + i);
  const areaId = id<'Area'>(ids('area', 1));
  const taskIds = [1, 2, 3, 4].map((i) => id<'Task'>(ids('task', i)));
  const [plainTask, estimatedTask, editedTask, recurringTask] = taskIds as [
    Task['id'],
    Task['id'],
    Task['id'],
    Task['id'],
  ];
  const suggestionIds = [1, 2, 3].map((i) =>
    id<'EstimateSuggestion'>(ids('estimate_suggestion', i)),
  ) as [
    Task['suggestions'][number]['id'],
    Task['suggestions'][number]['id'],
    Task['suggestions'][number]['id'],
  ];
  const ruleIds = [1, 2, 3, 4].map((i) =>
    id<'RecurrenceRule'>(ids('recurrence_rule', i)),
  );
  const occurrenceIds = [1, 2].map((i) =>
    id<'Occurrence'>(ids('occurrence', i)),
  ) as [Occurrence['id'], Occurrence['id']];
  const [firstSprint, secondSprint, reviewSprint, activeSprint] = [
    1, 2, 3, 4,
  ].map((i) => id<'Sprint'>(ids('sprint', i))) as [
    Sprint['id'],
    Sprint['id'],
    Sprint['id'],
    Sprint['id'],
  ];
  const sprintTaskIds = [1, 2, 3, 4, 5].map((i) =>
    id<'SprintTask'>(ids('sprint_task', i)),
  ) as Sprint['tasks'][number]['id'][];
  const criterionIds = [1, 2].map((i) =>
    id<'PlanningCriterion'>(ids('planning_criterion', i)),
  ) as [PlanningCriterion['id'], PlanningCriterion['id']];

  const areas: Area[] = [
    { id: areaId, userId, name: '研究', color: 3, order: 0, archived: false },
    {
      id: id<'Area'>(ids('area', 2)),
      userId,
      name: '生活',
      color: 7,
      order: 1,
      archived: true,
    },
  ];
  const tasks: Task[] = [
    {
      id: plainTask,
      userId,
      title: 'タイトルだけ',
      description: '',
      priority: 'normal',
      lifecycle: 'active',
      timeBasis: 'task',
      subtasks: [],
      suggestions: [],
      createdAt: at(1),
      createdVia: 'backlog',
    },
    {
      id: estimatedTask,
      userId,
      title: '論文を読む',
      description: '3 本',
      areaId,
      due: localDate('2026-10-04'),
      priority: 'high',
      lifecycle: 'completed',
      timeBasis: 'subtasks',
      subtasks: [
        {
          id: id<'Subtask'>(ids('subtask', 1)),
          title: '1 本目',
          estimate: 1.5,
          done: true,
          doneAt: at(5),
        },
        {
          id: id<'Subtask'>(ids('subtask', 2)),
          title: '2 本目',
          done: false,
        },
      ],
      estimate: {
        hours: 4,
        setAt: at(3),
        source: {
          kind: 'adopted',
          suggestionId: suggestionIds[0],
          bound: 'hi',
        },
      },
      suggestions: [
        {
          id: suggestionIds[0],
          lo: 2,
          hi: 4,
          rationale: '似た Task から',
          uncertainties: ['長さ', '難しさ'],
          createdAt: at(2),
          state: 'adopted',
        },
        {
          id: suggestionIds[1],
          lo: 1,
          hi: 1,
          rationale: '',
          uncertainties: [],
          createdAt: at(4),
          state: 'presented',
        },
      ],
      createdAt: at(1),
      createdVia: 'today',
      completedAt: at(6),
    },
    {
      id: editedTask,
      userId,
      title: '直して使う',
      description: '',
      priority: 'low',
      lifecycle: 'archived',
      timeBasis: 'task',
      subtasks: [],
      estimate: {
        hours: 2.5,
        setAt: at(3),
        source: { kind: 'edited', suggestionId: suggestionIds[2] },
      },
      suggestions: [
        {
          id: suggestionIds[2],
          lo: 2,
          hi: 3,
          rationale: '',
          uncertainties: ['量'],
          createdAt: at(2),
          state: 'replaced',
        },
      ],
      createdAt: at(1),
      createdVia: 'agent',
      archivedAt: at(7),
    },
    {
      id: recurringTask,
      userId,
      title: '部屋の掃除',
      description: '',
      priority: 'normal',
      lifecycle: 'active',
      timeBasis: 'task',
      subtasks: [],
      estimate: { hours: 1, setAt: at(3), source: { kind: 'manual' } },
      suggestions: [],
      recurrenceRuleId: ruleIds[0]!,
      createdAt: at(1),
      createdVia: 'backlog',
    },
  ];
  const rules: RecurrenceRule[] = [
    {
      id: ruleIds[0]!,
      taskId: recurringTask,
      versions: [
        {
          version: 1,
          pattern: { freq: 'weekly', daysOfWeek: [6, 0] },
          effectiveFrom: localDate('2026-09-28'),
          effectiveTo: localDate('2026-10-04'),
        },
        {
          version: 2,
          pattern: { freq: 'monthly', dayOfMonth: 31 },
          effectiveFrom: localDate('2026-10-05'),
        },
      ],
    },
    {
      id: ruleIds[1]!,
      taskId: plainTask,
      versions: [
        {
          version: 1,
          pattern: { freq: 'daily' },
          effectiveFrom: localDate('2026-09-28'),
        },
      ],
    },
    {
      id: ruleIds[2]!,
      taskId: plainTask,
      versions: [
        {
          version: 1,
          pattern: { freq: 'weekdays' },
          effectiveFrom: localDate('2026-09-28'),
        },
      ],
    },
  ];
  const occurrences: Occurrence[] = [
    {
      id: occurrenceIds[0],
      taskId: recurringTask,
      ruleId: ruleIds[0]!,
      scheduledDate: localDate('2026-10-03'),
      ruleVersion: 1,
      materializedAt: at(1),
      state: 'done',
      stateChangedAt: at(8),
    },
    {
      id: occurrenceIds[1],
      taskId: recurringTask,
      ruleId: ruleIds[0]!,
      scheduledDate: localDate('2026-10-04'),
      ruleVersion: 1,
      materializedAt: at(1),
      state: 'excluded',
      stateChangedAt: at(2),
    },
  ];
  const sprints: Sprint[] = [
    {
      id: firstSprint,
      userId,
      start: localDate('2026-09-28'),
      end: localDate('2026-10-04'),
      state: 'closed',
      availableHours: 12.5,
      plannedAvailableHours: 10,
      confirmedAt: at(9),
      goals: [
        {
          areaId,
          text: '3 本読む',
          plannedText: '2 本読む',
          selfAssessment: 'partly',
        },
        { areaId: id<'Area'>(ids('area', 2)), text: '片付ける' },
      ],
      tasks: [
        {
          id: sprintTaskIds[0]!,
          taskId: estimatedTask,
          origin: 'planning',
          addedAt: at(9),
          goalLink: 'linked',
          outcome: 'done',
          planSnapshot: {
            value: {
              base: 'subtasks',
              lo: 1.5,
              hi: 1.5,
              unestimatedSubtasks: 1,
              criterionApplied: false,
              computedAt: at(9),
            },
            timeBasis: 'subtasks',
            estimateHours: 4,
            suggestion: { id: suggestionIds[1], lo: 1, hi: 1 },
          },
        },
        {
          id: sprintTaskIds[1]!,
          taskId: recurringTask,
          occurrenceIds: [occurrenceIds[0]],
          origin: 'planning',
          addedAt: at(9),
          goalLink: 'unlinked',
          outcome: 'planned',
          planSnapshot: {
            value: {
              base: 'estimate',
              lo: 1,
              hi: 1,
              criterionApplied: false,
              computedAt: at(9),
            },
            timeBasis: 'task',
            estimateHours: 1,
            occurrenceCount: 1,
          },
        },
        {
          id: sprintTaskIds[2]!,
          taskId: editedTask,
          origin: 'midSprint',
          addedAt: at(10),
          goalLink: 'unlinked',
          outcome: 'carriedOver',
          planSnapshot: {
            value: {
              base: 'suggestion',
              lo: 2,
              hi: 3,
              criterionApplied: true,
              computedAt: at(10),
            },
            timeBasis: 'task',
          },
        },
        {
          id: sprintTaskIds[3]!,
          taskId: plainTask,
          origin: 'midSprint',
          addedAt: at(11),
          goalLink: 'unlinked',
          outcome: 'removed',
          planSnapshot: {
            value: {
              base: 'none',
              criterionApplied: false,
              computedAt: at(11),
            },
            timeBasis: 'task',
          },
        },
      ],
      areaSnapshot: [
        { areaId, name: '研究（旧）', order: 0 },
        { areaId: id<'Area'>(ids('area', 2)), name: '生活', order: 1 },
      ],
      criterionUse: {
        criterionId: criterionIds[0],
        appliedAtConfirm: true,
        retroDecision: 'replace',
      },
      dailySelections: [
        {
          id: id<'DailySelection'>(ids('daily_selection', 1)),
          date: localDate('2026-09-29'),
          sprintTaskId: sprintTaskIds[0]!,
          origin: 'manual',
          resolution: 'done',
          selectedAt: at(12),
          startedAt: at(13),
          resolvedAt: at(14),
          closedBefore: { resolution: 'paused', at: at(13) },
        },
        {
          id: id<'DailySelection'>(ids('daily_selection', 2)),
          date: localDate('2026-10-03'),
          sprintTaskId: sprintTaskIds[1]!,
          occurrenceId: occurrenceIds[0],
          origin: 'recurringToday',
          resolution: 'selected',
          selectedAt: at(15),
        },
      ],
      actualTimes: [
        {
          sprintTaskId: sprintTaskIds[0]!,
          hours: 1.25,
          date: localDate('2026-09-29'),
          via: 'completion',
          recordedAt: at(14),
        },
        {
          sprintTaskId: sprintTaskIds[1]!,
          occurrenceId: occurrenceIds[0],
          hours: 0.5,
          date: localDate('2026-10-03'),
          via: 'later',
          recordedAt: at(16),
        },
      ],
      interrupts: [
        {
          id: id<'InterruptNote'>(ids('interrupt_note', 1)),
          at: at(17),
          text: '来客',
          minutes: 30,
        },
        {
          id: id<'InterruptNote'>(ids('interrupt_note', 2)),
          at: at(18),
          text: '電話',
        },
      ],
      retro: {
        startedAt: at(19),
        completedAt: at(20),
        pins: [
          { kind: 'sprintTask', id: sprintTaskIds[2]! },
          { kind: 'availableHours' },
        ],
        reflection: '見積もりが甘い',
        improvement: { text: '多めに見る', criterionId: criterionIds[1] },
      },
    },
    {
      id: secondSprint,
      userId,
      start: localDate('2026-10-05'),
      end: localDate('2026-10-11'),
      state: 'planning',
      previousSprintId: firstSprint,
      goals: [],
      tasks: [
        {
          id: sprintTaskIds[4]!,
          taskId: recurringTask,
          occurrenceIds: [],
          origin: 'planning',
          addedAt: at(21),
          goalLink: 'unlinked',
          outcome: 'draft',
          carriedFrom: sprintTaskIds[2]!,
        },
      ],
      areaSnapshot: [],
      criterionUse: { criterionId: criterionIds[1], appliedAtConfirm: false },
      dailySelections: [],
      actualTimes: [],
      interrupts: [],
      retro: {
        startedAt: at(22),
        pins: [],
        reflection: '',
        improvement: { text: '' },
      },
    },
    // No CriterionUse; a Retro without improvement or completion.
    {
      id: reviewSprint,
      userId,
      start: localDate('2026-10-12'),
      end: localDate('2026-10-18'),
      state: 'review',
      goals: [],
      tasks: [],
      areaSnapshot: [],
      dailySelections: [],
      actualTimes: [],
      interrupts: [],
      retro: { startedAt: at(23), pins: [], reflection: '' },
    },
    // No CriterionUse and no Retro.
    {
      id: activeSprint,
      userId,
      start: localDate('2026-10-19'),
      end: localDate('2026-10-25'),
      state: 'active',
      goals: [],
      tasks: [],
      areaSnapshot: [],
      dailySelections: [],
      actualTimes: [],
      interrupts: [],
    },
  ];
  const criteria: PlanningCriterion[] = [
    {
      id: criterionIds[0],
      userId,
      policy: { scope: { kind: 'all' }, rangePolicy: 'mid' },
      sourceSprintId: firstSprint,
      state: 'replaced',
      replacedBy: criterionIds[1],
      createdAt: at(1),
    },
    {
      id: criterionIds[1],
      userId,
      policy: { scope: { kind: 'area', areaId }, rangePolicy: 'hi' },
      sourceSprintId: firstSprint,
      state: 'active',
      createdAt: at(20),
    },
  ];
  return {
    user: userOf(userId),
    areas,
    tasks,
    rules,
    occurrences,
    sprints,
    criteria,
  };
}

const empty: LoadedRecords = {
  revision: 0,
  records: null,
  caughtUpTo: null,
  versions: new Map(),
};

/** The day every save in these tests brings the records up to. */
const caughtUpTo = localDate('2026-10-03');

async function signUp(db: Database, userId: UserId, email: string) {
  await db.insert(authUser).values({ id: userId, name: 'n', email });
}

/** Saves `records` as the user's first save. */
async function saveAll(db: Database, records: Records) {
  return saveRecords(db, {
    userId: records.user.id,
    loaded: empty,
    changes: records,
    activities: [],
    caughtUpTo,
  });
}

/** Every row of every record table, the revisions and the Activity. */
async function dump(db: Database) {
  const tables: Record<string, unknown[]> = {};
  for (const table of [...recordTables, recordRevision, activity]) {
    const rows = await db.select().from(table);
    tables[getTableName(table)] = rows.map((row) => JSON.stringify(row)).sort();
  }
  return tables;
}

let close: (() => void) | undefined;
afterEach(() => close?.());

async function memoryDatabase() {
  const memory = await createMemoryDatabase();
  close = memory.close;
  await signUp(memory.db, alice, 'alice@example.com');
  await signUp(memory.db, bob, 'bob@example.com');
  return memory.db;
}

describe('loadRecords and saveRecords', () => {
  it('returns no records and revision 0 before the first save', async () => {
    const db = await memoryDatabase();
    expect(await loadRecords(db, alice)).toEqual(empty);
  });

  it('reads back every record as it was written', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    expect(await saveAll(db, records)).toMatchObject({ ok: true, revision: 1 });
    // toStrictEqual also fails on a key present as `undefined`.
    expect(await loadRecords(db, alice)).toStrictEqual({
      revision: 1,
      records,
      caughtUpTo,
      versions: expect.any(Map),
    });
  });

  it('writes only the rows of the changed part of an aggregate', async () => {
    const records = recordsOf(alice, 1);
    const { db, queries } = createRecordingDatabase();
    const [, task] = records.tasks as [Task, Task];
    const [first, second] = task.subtasks as [
      Task['subtasks'][number],
      Task['subtasks'][number],
    ];
    const changed: Task = {
      ...task,
      subtasks: [first, { ...second, title: '2 本目（短縮）' }],
    };
    const result = await saveRecords(db, {
      userId: alice,
      loaded: { revision: 3, records, versions: new Map() },
      changes: { tasks: [changed] },
      activities: [],
      caughtUpTo,
    });
    expect(result).toMatchObject({ ok: true, revision: 4 });
    expect(queries).toEqual([
      'insert into "record_revision" ("user_id", "revision", "caught_up_to") values (?, ?, ?) on conflict ("record_revision"."user_id") do update set "revision" = case when "record_revision"."revision" = ? then ? else 0 end, "caught_up_to" = case when "record_revision"."caught_up_to" > ? then "record_revision"."caught_up_to" else ? end',
      'update "subtask" set "title" = ?, "revision" = ? where "subtask"."id" = ?',
    ]);
    // The Subtask is at this save's version; the Task, whose own row did
    // not change, keeps its own (#321).
    const versions = result.ok ? result.versions : new Map();
    expect(versions.get(second.id)).toBe(4);
    expect(versions.has(task.id)).toBe(false);
  });

  it('keeps the version of a row whose place alone moved (#321)', async () => {
    const records = recordsOf(alice, 1);
    const { db, queries } = createRecordingDatabase();
    const [, task] = records.tasks as [Task, Task];
    const [first, second] = task.subtasks as [
      Task['subtasks'][number],
      Task['subtasks'][number],
    ];
    const loaded = new Map([
      [first.id, 2],
      [second.id, 3],
    ]);
    const result = await saveRecords(db, {
      userId: alice,
      loaded: { revision: 3, records, versions: loaded },
      changes: { tasks: [{ ...task, subtasks: [second] }] },
      activities: [],
      caughtUpTo,
    });
    expect(queries.slice(1)).toEqual([
      'delete from "subtask" where "subtask"."id" = ?',
      'update "subtask" set "position" = ? where "subtask"."id" = ?',
    ]);
    const versions = result.ok ? result.versions : new Map();
    expect(versions.get(second.id)).toBe(3);
    expect(versions.has(first.id)).toBe(false);
  });

  it('adds, updates and deletes the parts of an aggregate', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    const sprint = records.sprints[0]!;
    const [first, second] = sprint.dailySelections as [
      Sprint['dailySelections'][number],
      Sprint['dailySelections'][number],
    ];
    const changed: Sprint = {
      ...sprint,
      // One removed, one changed, one added; a goal and a pin removed.
      dailySelections: [
        { ...second, resolution: 'deferred', resolvedAt: at(30) },
        {
          ...first,
          id: id<'DailySelection'>(tid('daily_selection', 199)),
          date: localDate('2026-09-30'),
        },
      ],
      goals: sprint.goals.slice(1),
      retro: { ...sprint.retro!, pins: sprint.retro!.pins.slice(1) },
    };
    const result = await saveRecords(db, {
      userId: alice,
      loaded,
      changes: { sprints: [changed] },
      activities: [],
      caughtUpTo,
    });
    expect(result).toMatchObject({ ok: true, revision: 2 });
    const reloaded = await loadRecords(db, alice);
    expect(reloaded.records?.sprints[0]).toStrictEqual(changed);
  });

  it('deletes records and lets an occurrence be generated again', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    const [, excluded] = records.occurrences as [Occurrence, Occurrence];
    const regenerated: Occurrence = {
      ...excluded,
      id: id<'Occurrence'>(tid('occurrence', 199)),
      ruleVersion: 2,
      state: 'pending',
    };
    const [, daily] = records.rules as [RecurrenceRule, RecurrenceRule];
    const result = await saveRecords(db, {
      userId: alice,
      loaded,
      changes: {
        occurrences: [regenerated],
        deleted: {
          occurrences: [excluded.id],
          rules: [daily.id],
          criteria: [records.criteria[0]!.id],
        },
      },
      activities: [],
      caughtUpTo,
    });
    expect(result).toMatchObject({ ok: true, revision: 2 });
    const reloaded = (await loadRecords(db, alice)).records!;
    expect(reloaded.occurrences).toStrictEqual([
      records.occurrences[0],
      regenerated,
    ]);
    expect(reloaded.rules.map((r) => r.id)).toEqual([
      records.rules[0]!.id,
      records.rules[2]!.id,
    ]);
    expect(reloaded.criteria).toStrictEqual([records.criteria[1]]);
    const [versions] = await db.batch([
      db.all(
        sql`select * from recurrence_rule_version where rule_id = ${daily.id}`,
      ),
    ]);
    expect(versions).toEqual([]);
  });

  it('hands an active criterion and a presented suggestion over in one save', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    const [earlier, active] = records.criteria as [
      PlanningCriterion,
      PlanningCriterion,
    ];
    const task = records.tasks[1]!;
    const [adopted, presented] = task.suggestions as [
      Task['suggestions'][number],
      Task['suggestions'][number],
    ];
    // Both are updates of existing rows, and the row taking the slot comes
    // first in each table: the save still frees the slot before taking it.
    const changes = {
      criteria: [
        { ...earlier, state: 'active' as const },
        { ...active, state: 'replaced' as const, replacedBy: earlier.id },
      ],
      tasks: [
        {
          ...task,
          suggestions: [
            { ...adopted, state: 'presented' as const },
            { ...presented, state: 'rejected' as const },
          ],
        },
      ],
    };
    const result = await saveRecords(db, {
      userId: alice,
      loaded,
      changes,
      activities: [],
      caughtUpTo,
    });
    expect(result).toMatchObject({ ok: true, revision: 2 });
    const reloaded = (await loadRecords(db, alice)).records!;
    expect(reloaded.criteria).toStrictEqual(changes.criteria);
    expect(reloaded.tasks[1]).toStrictEqual(changes.tasks[0]);
  });

  it('hands the active Sprint over in one save', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    const [, planning, , active] = records.sprints as [
      Sprint,
      Sprint,
      Sprint,
      Sprint,
    ];
    const sprints: Sprint[] = [
      { ...planning, state: 'active' },
      { ...active, state: 'review' },
    ];
    const result = await saveRecords(db, {
      userId: alice,
      loaded,
      changes: { sprints },
      activities: [],
      caughtUpTo,
    });
    expect(result).toMatchObject({ ok: true, revision: 2 });
  });

  it('lists every partial unique index with the order its writes need', () => {
    const partial = recordTables.flatMap((table) =>
      getTableConfig(table)
        .indexes.filter((i) => i.config.unique && i.config.where !== undefined)
        .map((i) => i.config.name),
    );
    expect(partial.sort()).toEqual(
      [...Object.keys(uniqueSlots), ...fixedUniqueIndexes].sort(),
    );
  });

  it.each([
    [
      'two active criteria',
      (records: Records) => ({
        criteria: [
          {
            ...records.criteria[1]!,
            id: id<'PlanningCriterion'>(tid('planning_criterion', 199)),
          },
        ],
      }),
    ],
    [
      'two presented suggestions on a Task',
      (records: Records) => {
        const task = records.tasks[1]!;
        const presented = task.suggestions[1]!;
        return {
          tasks: [
            {
              ...task,
              suggestions: [
                ...task.suggestions,
                {
                  ...presented,
                  id: id<'EstimateSuggestion'>(tid('estimate_suggestion', 199)),
                },
              ],
            },
          ],
        };
      },
    ],
    [
      'a non-recurring Task twice in a Sprint (invariant 14)',
      (records: Records) => {
        const sprint = records.sprints[0]!;
        const once = sprint.tasks[0]!;
        return {
          sprints: [
            {
              ...sprint,
              tasks: [
                ...sprint.tasks,
                { ...once, id: id<'SprintTask'>(tid('sprint_task', 199)) },
              ],
            },
          ],
        };
      },
    ],
    [
      'a DailySelection whose SprintTask is gone',
      (records: Records) => {
        const sprint = records.sprints[0]!;
        return { sprints: [{ ...sprint, tasks: sprint.tasks.slice(1) }] };
      },
    ],
  ] as const)('keeps the DB from holding %s', async (_, change) => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    const before = await dump(db);
    await expect(
      saveRecords(db, {
        userId: alice,
        loaded,
        changes: change(records),
        activities: [],
        caughtUpTo,
      }),
    ).rejects.toThrow();
    expect(await dump(db)).toEqual(before);
  });

  it('lets a deletion win over a change of the same record', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    const [done, excluded] = records.occurrences as [Occurrence, Occurrence];
    const madeAndDropped: Occurrence = {
      ...excluded,
      id: id<'Occurrence'>(tid('occurrence', 199)),
      scheduledDate: localDate('2026-10-02'),
    };
    const result = await saveRecords(db, {
      userId: alice,
      loaded,
      changes: {
        occurrences: [{ ...excluded, state: 'pending' }, madeAndDropped],
        deleted: { occurrences: [excluded.id, madeAndDropped.id] },
      },
      activities: [],
      caughtUpTo,
    });
    expect(result).toMatchObject({ ok: true, revision: 2 });
    expect((await loadRecords(db, alice)).records!.occurrences).toStrictEqual([
      done,
    ]);
  });

  it('appends Activity in order with the revision of the save', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    const activities: Activity[] = [
      {
        kind: 'areaCreated',
        at: at(1),
        actor: 'user',
        areaId: records.areas[0]!.id,
        name: '研究',
      },
      {
        kind: 'areaRenamed',
        at: at(2),
        actor: 'agent',
        areaId: records.areas[0]!.id,
        from: '研究',
        to: '研究と読書',
      },
    ];
    await saveRecords(db, {
      userId: alice,
      loaded: empty,
      changes: { user: records.user, areas: records.areas },
      activities,
      caughtUpTo,
    });
    // An operation that changes no record can still append Activity.
    const loaded = await loadRecords(db, alice);
    await saveRecords(db, {
      userId: alice,
      loaded,
      changes: {},
      activities: activities.slice(0, 1),
      caughtUpTo,
    });
    expect(await db.select().from(activity)).toEqual([
      {
        userId: alice,
        revision: 1,
        position: 0,
        at: at(1),
        actor: 'user',
        kind: 'areaCreated',
        content: { areaId: records.areas[0]!.id, name: '研究' },
      },
      {
        userId: alice,
        revision: 1,
        position: 1,
        at: at(2),
        actor: 'agent',
        kind: 'areaRenamed',
        content: {
          areaId: records.areas[0]!.id,
          from: '研究',
          to: '研究と読書',
        },
      },
      {
        userId: alice,
        revision: 2,
        position: 0,
        at: at(1),
        actor: 'user',
        kind: 'areaCreated',
        content: { areaId: records.areas[0]!.id, name: '研究' },
      },
    ]);
  });

  it('writes nothing when nothing changed', async () => {
    const records = recordsOf(alice, 1);
    const { db, queries } = createRecordingDatabase();
    const result = await saveRecords(db, {
      userId: alice,
      loaded: { revision: 3, records, versions: new Map() },
      changes: { tasks: records.tasks, user: records.user },
      activities: [],
      caughtUpTo,
    });
    expect(result).toMatchObject({ ok: true, revision: 3 });
    expect(queries).toEqual([]);
  });

  it('keeps every statement within D1’s 100 bound parameters', async () => {
    const { db, queries } = createRecordingDatabase();
    const records = recordsOf(alice, 1);
    const many = Array.from({ length: 40 }, (_, i) => ({
      ...records.tasks[1]!,
      id: id<'Task'>(tid('task', 1000 + i)),
      subtasks: [],
      suggestions: [],
    }));
    await saveRecords(db, {
      userId: alice,
      loaded: empty,
      changes: { user: records.user, tasks: many },
      activities: [],
      caughtUpTo,
    });
    const parameters = queries.map((q) => q.split('?').length - 1);
    expect(Math.max(...parameters)).toBeLessThanOrEqual(100);
    // 40 tasks of 19 columns: 5 rows per statement.
    expect(
      queries.filter((q) => q.startsWith('insert into "task"')),
    ).toHaveLength(8);
  });

  it('requires the user’s settings in the first save', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await expect(
      saveRecords(db, {
        userId: alice,
        loaded: empty,
        changes: { areas: records.areas },
        activities: [],
        caughtUpTo,
      }),
    ).rejects.toThrow(/first save/);
  });
});

describe('revision', () => {
  it('fails the later of two saves made from the same records, writing nothing', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    const [area] = records.areas as [Area];
    const fromPc = await saveRecords(db, {
      userId: alice,
      loaded,
      changes: { areas: [{ ...area, name: 'PC で変えた' }] },
      activities: [],
      caughtUpTo,
    });
    expect(fromPc).toMatchObject({ ok: true, revision: 2 });
    const before = await dump(db);
    const fromPhone = await saveRecords(db, {
      userId: alice,
      loaded,
      changes: {
        areas: [{ ...area, name: 'スマホで変えた' }],
        tasks: [{ ...records.tasks[0]!, title: 'スマホで変えた' }],
      },
      activities: [
        {
          kind: 'areaRenamed',
          at: at(30),
          actor: 'user',
          areaId: area.id,
          from: area.name,
          to: 'スマホで変えた',
        },
      ],
      caughtUpTo,
    });
    expect(fromPhone).toEqual({ ok: false, reason: 'revisionConflict' });
    expect(await dump(db)).toEqual(before);
  });

  it('fails two first saves made at the same time', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    expect(await saveAll(db, records)).toMatchObject({ ok: true, revision: 1 });
    const before = await dump(db);
    expect(
      await saveRecords(db, {
        userId: alice,
        loaded: empty,
        changes: { user: { ...records.user, displayName: '別の端末' } },
        activities: [],
        caughtUpTo,
      }),
    ).toEqual({ ok: false, reason: 'revisionConflict' });
    expect(await dump(db)).toEqual(before);
  });

  it('rethrows a failure that is not a conflict', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const loaded = await loadRecords(db, alice);
    // The same date for the same rule: occurrence_rule_date_idx.
    const duplicate: Occurrence = {
      ...records.occurrences[0]!,
      id: id<'Occurrence'>(tid('occurrence', 199)),
    };
    await expect(
      saveRecords(db, {
        userId: alice,
        loaded,
        changes: { occurrences: [duplicate] },
        activities: [],
        caughtUpTo,
      }),
    ).rejects.toThrow();
  });

  it('keeps the day the records were brought up to, never an earlier one', async () => {
    const db = await memoryDatabase();
    const records = recordsOf(alice, 1);
    await saveAll(db, records);
    const rename = async (displayName: string, day: string) => {
      const loaded = await loadRecords(db, alice);
      await saveRecords(db, {
        userId: alice,
        loaded,
        changes: { user: { ...records.user, displayName } },
        activities: [],
        caughtUpTo: localDate(day),
      });
      return loadRecords(db, alice);
    };
    expect((await rename('次の日', '2026-10-04')).caughtUpTo).toBe(
      '2026-10-04',
    );
    // Another save whose clock was still before midnight.
    const late = await rename('前の日の時計', '2026-10-03');
    expect(late.revision).toBe(3);
    expect(late.caughtUpTo).toBe('2026-10-04');
  });
});

describe('users', () => {
  it('reads and writes only the given user’s records', async () => {
    const db = await memoryDatabase();
    const aliceRecords = recordsOf(alice, 1);
    const bobRecords = recordsOf(bob, 2);
    await saveAll(db, aliceRecords);
    await saveAll(db, bobRecords);
    expect(await loadRecords(db, alice)).toStrictEqual({
      revision: 1,
      records: aliceRecords,
      caughtUpTo,
      versions: expect.any(Map),
    });
    expect(await loadRecords(db, bob)).toStrictEqual({
      revision: 1,
      records: bobRecords,
      caughtUpTo,
      versions: expect.any(Map),
    });

    const loaded = await loadRecords(db, alice);
    await saveRecords(db, {
      userId: alice,
      loaded,
      changes: {
        sprints: aliceRecords.sprints.map((s) => ({ ...s, interrupts: [] })),
      },
      activities: [],
      caughtUpTo,
    });
    expect(await loadRecords(db, bob)).toStrictEqual({
      revision: 1,
      records: bobRecords,
      caughtUpTo,
      versions: expect.any(Map),
    });
  });

  it('refuses another user’s record or a record it did not load', async () => {
    const db = await memoryDatabase();
    const aliceRecords = recordsOf(alice, 1);
    const bobRecords = recordsOf(bob, 2);
    await saveAll(db, aliceRecords);
    await saveAll(db, bobRecords);
    const loaded = await loadRecords(db, alice);
    await expect(
      saveRecords(db, {
        userId: alice,
        loaded,
        changes: { tasks: [{ ...bobRecords.tasks[0]!, title: '乗っ取り' }] },
        activities: [],
        caughtUpTo,
      }),
    ).rejects.toThrow(/cannot be saved/);
    await expect(
      saveRecords(db, {
        userId: alice,
        loaded,
        changes: { deleted: { occurrences: [bobRecords.occurrences[0]!.id] } },
        activities: [],
        caughtUpTo,
      }),
    ).rejects.toThrow(/not a loaded record/);
    // A record with another user's ID under Alice's name is a new row, and
    // the primary key keeps it from replacing Bob's.
    const forged: Occurrence = {
      ...bobRecords.occurrences[0]!,
      state: 'skipped',
    };
    await expect(
      saveRecords(db, {
        userId: alice,
        loaded,
        changes: { occurrences: [forged] },
        activities: [],
        caughtUpTo,
      }),
    ).rejects.toThrow();
    expect((await loadRecords(db, bob)).records).toStrictEqual(bobRecords);
  });
});
