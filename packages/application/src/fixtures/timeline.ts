// The fixture's one week of history, played through `@itera/domain`
// commands so that every record is one the domain could have made. The
// states of PRD §12 are snapshots taken along the way (states.ts). The
// browser mock and the API's tests use it; production code does not.
//
// IDs are TypeIDs made at each step's time, with no randomness, so the
// timeline makes the same IDs every time it is played.
//
// Based on the Scenarios of docs/domain/domain-model.md, on one user and one
// timeline (Asia/Tokyo, weeks start on Monday):
// - Sprint 9/21–9/27 is the previous week. Its Retro makes the criterion
//   「研究：見積もりなしは提案の多めの値で計画」 active.
// - Sprint 9/28–10/4 follows Scenario A (関連論文を 3本読む: deferred twice,
//   4時間30分 then 中断, 昨日の続き, carried over; the available hours
//   differ, see the Check) and Scenario B
//   (顧客インタビューの設計 added to Today from the Backlog). Scenario C's
//   weekly 部屋の掃除 is changed from Saturday to Sunday during the Sprint,
//   which takes effect from the next Sprint.
// - 10/5 the system moves the Sprint to Review, and the Retro is written.
import {
  activeCriterion,
  addSubtask,
  addToToday,
  assessGoal,
  changeRuleForNextSprint,
  completeRetro,
  completeSelection,
  confirmSprint,
  createArea,
  createRecurrenceRule,
  createTask,
  decideCriterion,
  deferSelection,
  draftCriterion,
  instant,
  localDate,
  noteInterrupt,
  pauseSelection,
  pinFact,
  presentSuggestion,
  selectForToday,
  selectTask,
  setAvailableHours,
  setEstimate,
  setGoalLink,
  setGoalText,
  setImprovement,
  setReflection,
  skipSelection,
  startDay,
  startPlanning,
  startSelection,
  timeZone,
  toLocalDate,
  updateTask,
  type Actor,
  type AreaColor,
  type AreaId,
  type Instant,
  type LocalDate,
  type Occurrence,
  type RecurrencePattern,
  type RecurrenceRuleId,
  type SprintId,
  type Task,
  type TaskAttributeUpdate,
  type TaskId,
  type User,
  type UserId,
} from '@itera/domain';
import { find, onSprint, onTask, onToday } from '../changes';
import { createIdSource } from '../ids';
import { changed, type Change, type StoreSnapshot } from '../record-store';
import {
  applyChanges,
  type Records,
  type RecordsWithActivity,
} from '../records';
import { reviewSprint } from '../review-changes';

export type FixtureStateId =
  | 'planning-pick'
  | 'planning-shape'
  | 'planning-check'
  | 'today-morning'
  | 'today-daytime'
  | 'today-interrupt'
  | 'retro-start'
  | 'retro-reflect'
  | 'retro-before-complete'
  | 'backlog-capture'
  | 'backlog-detail'
  | 'backlog-recurrence'
  | 'empty'
  | 'before-settings';

/** A time in Tokyo in 2026, e.g. `jst('09-27 21:00')`. */
function jst(monthDayTime: string): Instant {
  const [date, time] = monthDayTime.split(' ');
  return instant(new Date(`2026-${date}T${time}:00+09:00`).toISOString());
}

/** A day of 2026, e.g. `date('09-28')`. */
function date(monthDay: string): LocalDate {
  return localDate(`2026-${monthDay}`);
}

type AreaName = 'work' | 'research' | 'study' | 'life';
type TaskName =
  | 'slides'
  | 'expense'
  | 'apiReview'
  | 'paper'
  | 'interview'
  | 'tax'
  | 'passport'
  | 'typescript'
  | 'bookshelf'
  | 'onboarding'
  | 'dataset'
  | 'cleaning'
  | 'reading'
  | 'dentist'
  | 'seminar';
type SprintName = 'previous' | 'current';

/** The IDs of the records the fixture names, for tests and the dev menu. */
export interface FixtureIds {
  readonly user: UserId;
  readonly area: Readonly<Record<AreaName, AreaId>>;
  readonly task: Readonly<Record<TaskName, TaskId>>;
  readonly sprint: Readonly<Record<SprintName, SprintId>>;
}

export interface Timeline {
  readonly ids: FixtureIds;
  readonly snapshots: ReadonlyMap<FixtureStateId, StoreSnapshot>;
}

const saturday: RecurrencePattern = { freq: 'weekly', daysOfWeek: [6] };
const sunday: RecurrencePattern = { freq: 'weekly', daysOfWeek: [0] };
const monWedFri: RecurrencePattern = { freq: 'weekly', daysOfWeek: [1, 3, 5] };

/** Plays the timeline and returns the snapshot of every fixture state. */
export function buildTimeline(): Timeline {
  // No randomness: an ID is its step's time and its place in the step.
  const ids = createIdSource((bytes) => bytes.fill(0));
  let now = jst('09-13 10:00');
  const user: User = {
    id: ids.newId('User', now),
    displayName: 'わたし',
    timeZone: timeZone('Asia/Tokyo'),
    weekStartsOn: 1,
  };
  // Filled in as the records are made.
  const area = named<AreaName, AreaId>('Area');
  const task = named<TaskName, TaskId>('Task');
  const sprint = named<SprintName, SprintId>('Sprint');
  let records: RecordsWithActivity = {
    user,
    areas: [],
    tasks: [],
    rules: [],
    occurrences: [],
    sprints: [],
    criteria: [],
    activities: [],
  };
  const snapshots = new Map<FixtureStateId, StoreSnapshot>();

  const newId = <Kind extends string>(kind: Kind) => ids.newId(kind, now);
  const idsOf =
    <Kind extends string>(kind: Kind) =>
    () =>
      newId(kind);

  /** Runs a change at a time. The fixture must be valid, so failure throws. */
  function at(time: string, change: Change, actor: Actor = 'user'): void {
    const next = jst(time);
    // Activity is appended in the order of the steps, so time never goes back.
    if (next < now)
      throw new Error(`Fixture step at ${time} goes back in time`);
    now = next;
    const result = change(records, {
      now,
      today: toLocalDate(now, user.timeZone),
      actor,
      newId,
    });
    if (!result.ok) {
      throw new Error(
        `Fixture step at ${time} failed: ${result.error.code} ${result.error.message}`,
      );
    }
    records = applyChanges(
      records,
      result.value.changes,
      result.value.activities,
    );
  }

  function snapshot(state: FixtureStateId, time: string): void {
    const clockNow = jst(time);
    snapshots.set(state, {
      records,
      clock: { now: clockNow, today: toLocalDate(clockNow, user.timeZone) },
    });
  }

  function get<T extends { readonly id: string }>(
    list: readonly T[],
    recordId: string,
  ): T {
    const found = find(list, recordId, 'record');
    if (!found.ok) throw new Error(found.error.message);
    return found.value;
  }
  const sprintOf = (sprintId: SprintId) => get(records.sprints, sprintId);
  const ruleOf = (taskId: TaskId) => {
    const ruleId: RecurrenceRuleId | undefined = get(
      records.tasks,
      taskId,
    ).recurrenceRuleId;
    if (ruleId === undefined) throw new Error(`no rule for ${taskId}`);
    return get(records.rules, ruleId);
  };
  const sprintTaskOf = (sprintId: SprintId, taskId: TaskId) => {
    const found = sprintOf(sprintId).tasks.find((t) => t.taskId === taskId);
    if (found === undefined) throw new Error(`no SprintTask for ${taskId}`);
    return found;
  };
  const occurrenceOf = (taskId: TaskId, date: string): Occurrence => {
    const found = records.occurrences.find(
      (o) => o.taskId === taskId && o.scheduledDate === date,
    );
    if (found === undefined) throw new Error(`no occurrence ${taskId} ${date}`);
    return found;
  };
  const selectionOf = (sprintId: SprintId, taskId: TaskId, date: string) => {
    const sprintTask = sprintTaskOf(sprintId, taskId);
    const found = sprintOf(sprintId).dailySelections.find(
      (s) => s.sprintTaskId === sprintTask.id && s.date === date,
    );
    if (found === undefined) throw new Error(`no selection ${taskId} ${date}`);
    return found.id;
  };

  // ------------------------------------------------------------ changes

  const newArea =
    (key: AreaName, name: string, color: AreaColor, order: number): Change =>
    (_, ctx) => {
      area[key] = ctx.newId('Area');
      return changed(
        createArea({ id: area[key], userId: user.id, name, color, order }, ctx),
        (a) => ({ areas: [a] }),
      );
    };

  const newTask =
    (key: TaskName, title: string, update: TaskAttributeUpdate = {}): Change =>
    (_, ctx) => {
      const taskId = ctx.newId('Task');
      task[key] = taskId;
      const created = createTask(
        { id: taskId, userId: user.id, title, via: 'backlog' },
        ctx,
      );
      if (!created.ok) return created;
      if (Object.keys(update).length === 0) {
        return changed(created, (t) => ({ tasks: [t] }));
      }
      const updated = updateTask(created.value.record, update, ctx);
      if (!updated.ok) return updated;
      return {
        ok: true,
        value: {
          changes: { tasks: [updated.value.record] },
          activities: [
            ...created.value.activities,
            ...updated.value.activities,
          ],
        },
      };
    };

  const estimate = (taskId: TaskId, hours: number) =>
    onTask(taskId, (t, ctx) => setEstimate(t, hours, ctx));

  const suggest = (
    taskId: TaskId,
    lo: number,
    hi: number,
    rationale: string,
    uncertainties: readonly string[] = [],
  ) =>
    onTask(taskId, (t, ctx) =>
      presentSuggestion(
        t,
        {
          id: ctx.newId('EstimateSuggestion'),
          lo,
          hi,
          rationale,
          uncertainties,
        },
        ctx,
      ),
    );

  const subtask = (taskId: TaskId, title: string, hours?: number) =>
    onTask(taskId, (t, ctx) =>
      addSubtask(
        t,
        {
          id: ctx.newId('Subtask'),
          title,
          ...(hours === undefined ? {} : { estimate: hours }),
        },
        ctx,
      ),
    );

  const recurring =
    (taskId: TaskId, pattern: RecurrencePattern, from: string): Change =>
    (r, ctx) => {
      const t = find(r.tasks, taskId, 'Task');
      if (!t.ok) return t;
      return changed(
        createRecurrenceRule(
          t.value,
          {
            id: ctx.newId('RecurrenceRule'),
            pattern,
            effectiveFrom: date(from),
          },
          ctx,
        ),
        ({ task: next, rule }) => ({ tasks: [next], rules: [rule] }),
      );
    };

  const plan =
    (key: SprintName, start: string): Change =>
    (r, ctx) => {
      const sprintId = ctx.newId('Sprint');
      sprint[key] = sprintId;
      return changed(
        startPlanning(
          {
            sprintId,
            user,
            start: date(start),
            sprints: r.sprints,
            recurring: r.rules.map((rule) => ({
              rule,
              task: get(r.tasks, rule.taskId),
            })),
            occurrences: r.occurrences,
            newOccurrenceId: idsOf('Occurrence'),
            newSprintTaskId: idsOf('SprintTask'),
          },
          ctx,
        ),
        ({ sprint: planned, occurrences }) => ({
          sprints: [planned],
          occurrences,
        }),
      );
    };

  const pick = (sprintId: SprintId, taskId: TaskId, carriedFrom?: SprintId) =>
    onSprint(sprintId, (s, ctx, r) => {
      const from =
        carriedFrom === undefined
          ? undefined
          : sprintOf(carriedFrom).tasks.find((t) => t.taskId === taskId);
      return selectTask(
        s,
        {
          sprintTaskId: ctx.newId('SprintTask'),
          task: get(r.tasks, taskId),
          ...(from === undefined ? {} : { carriedFrom: from }),
        },
        ctx,
      );
    });

  const goal = (sprintId: SprintId, areaId: AreaId, text: string) =>
    onSprint(sprintId, (s, ctx) => setGoalText(s, { areaId, text }, ctx));

  const activeCriterionOf = (r: Records) => {
    const active = activeCriterion(r.criteria);
    return active === undefined
      ? {}
      : { criterion: { id: active.id, policy: active.policy } };
  };

  const confirm = (sprintId: SprintId, applyCriterion: boolean) =>
    onSprint(sprintId, (s, ctx, r) =>
      confirmSprint(
        s,
        {
          sprints: r.sprints,
          tasks: r.tasks,
          areas: r.areas,
          ...activeCriterionOf(r),
          applyCriterion,
        },
        ctx,
      ),
    );

  const day = (sprintId: SprintId) =>
    onSprint(sprintId, (s, ctx, r) =>
      startDay(
        s,
        {
          today: ctx.today,
          occurrences: r.occurrences,
          newSelectionId: idsOf('DailySelection'),
        },
        ctx,
      ),
    );

  const toToday = (sprintId: SprintId, taskId: TaskId) =>
    onSprint(sprintId, (s, ctx) =>
      selectForToday(
        s,
        {
          selectionId: ctx.newId('DailySelection'),
          date: ctx.today,
          sprintTaskId: sprintTaskOf(sprintId, taskId).id,
        },
        ctx,
      ),
    );

  const selection = (sprintId: SprintId, taskId: TaskId, day: string) => ({
    selectionId: selectionOf(sprintId, taskId, `2026-${day}`),
  });

  const start = (sprintId: SprintId, taskId: TaskId, date: string) =>
    onSprint(sprintId, (s, ctx) =>
      startSelection(s, selection(sprintId, taskId, date), ctx),
    );

  const defer = (sprintId: SprintId, taskId: TaskId, date: string) =>
    onSprint(sprintId, (s, ctx) =>
      deferSelection(s, selection(sprintId, taskId, date), ctx),
    );

  const pause = (
    sprintId: SprintId,
    taskId: TaskId,
    date: string,
    actualHours: number,
  ) =>
    onSprint(sprintId, (s, ctx) =>
      pauseSelection(
        s,
        { ...selection(sprintId, taskId, date), actualHours },
        ctx,
      ),
    );

  const complete = (
    sprintId: SprintId,
    taskId: TaskId,
    date: string,
    actualHours?: number,
  ) =>
    onToday(sprintId, (s, ctx, r) => {
      const t: Task = get(r.tasks, taskId);
      const occurrence =
        t.recurrenceRuleId === undefined
          ? undefined
          : occurrenceOf(taskId, `2026-${date}`);
      return completeSelection(
        s,
        {
          ...selection(sprintId, taskId, date),
          today: ctx.today,
          ...(occurrence === undefined ? { task: t } : { occurrence }),
          ...(actualHours === undefined ? {} : { actualHours }),
        },
        ctx,
      );
    });

  const review =
    (sprintId: SprintId): Change =>
    (r, ctx) =>
      reviewSprint(get(r.sprints, sprintId))(r, ctx);

  // ------------------------------------------------------------ 9/13 setup

  // A person who has just started (#279): no records, on a Monday, so that
  // the first week can be run through (the clock of a state does not move).
  // `before-settings` is the same records before they have made their
  // settings: the user stands for what the settings are made from.
  snapshot('empty', '09-14 09:00');
  snapshot('before-settings', '09-14 09:00');

  at('09-13 10:00', newArea('work', '仕事', 1, 0));
  at('09-13 10:01', newArea('research', '研究', 2, 1));
  at('09-13 10:02', newArea('study', '学習', 3, 2));
  at('09-13 10:03', newArea('life', '生活', 4, 3));

  at('09-13 10:10', newTask('cleaning', '部屋の掃除', { areaId: area.life }));
  at('09-13 10:11', estimate(task.cleaning, 1));
  at('09-13 10:12', recurring(task.cleaning, saturday, '09-21'));
  at(
    '09-13 10:20',
    newTask('slides', 'ゼミ発表のスライドを作る', { areaId: area.research }),
  );
  at('09-13 10:21', estimate(task.slides, 3));
  at('09-13 10:30', newTask('expense', '経費精算', { areaId: area.work }));
  at('09-13 10:31', estimate(task.expense, 0.5));
  at(
    '09-13 10:40',
    newTask('apiReview', 'API 設計のレビュー', { areaId: area.work }),
  );
  at('09-13 10:41', estimate(task.apiReview, 2));

  // ------------------------------------------- Sprint 9/21–9/27 (previous)

  at('09-20 20:00', plan('previous', '09-21'));
  const previous = sprint.previous;
  at('09-20 20:05', pick(previous, task.slides));
  at('09-20 20:06', pick(previous, task.expense));
  at('09-20 20:07', pick(previous, task.apiReview));
  at('09-20 20:10', goal(previous, area.research, '発表の準備を終える'));
  at(
    '09-20 20:15',
    onSprint(previous, (s, ctx) => setAvailableHours(s, { hours: 15 }, ctx)),
  );
  at('09-20 20:20', confirm(previous, false));

  at('09-21 06:00', day(previous), 'system');
  at('09-22 06:00', day(previous), 'system');
  at('09-22 09:00', toToday(previous, task.slides));
  at('09-22 18:00', complete(previous, task.slides, '09-22', 3.5));
  at('09-23 06:00', day(previous), 'system');
  at('09-23 09:00', toToday(previous, task.expense));
  at('09-23 09:40', complete(previous, task.expense, '09-23', 0.5));
  at('09-24 06:00', day(previous), 'system');
  at('09-24 09:00', toToday(previous, task.apiReview));
  // The Backlog grows during the week.
  at(
    '09-24 12:00',
    newTask('paper', '関連論文を 3本読む', { areaId: area.research }),
  );
  at(
    '09-24 12:01',
    suggest(task.paper, 3, 5, '1本 1時間〜1時間30分', ['論文の長さ']),
  );
  at(
    '09-24 12:10',
    newTask('interview', '顧客インタビューの設計', {
      areaId: area.work,
      description: '来月の顧客インタビューに向けて、質問項目と対象者を決める。',
      due: date('10-09'),
    }),
  );
  at(
    '09-24 12:11',
    suggest(task.interview, 2, 3, '質問項目 1時間、対象者の選定 1〜2時間', [
      '対象者の人数',
    ]),
  );
  at('09-24 12:12', subtask(task.interview, '質問項目を洗い出す', 1));
  at('09-24 12:13', subtask(task.interview, '対象者に連絡する'));
  at(
    '09-24 12:20',
    newTask('tax', '住民税の支払い', {
      areaId: area.life,
      due: date('09-30'),
    }),
  );
  at('09-24 12:21', estimate(task.tax, 0.25));
  at(
    '09-24 12:30',
    newTask('passport', 'パスポートの更新', {
      areaId: area.life,
      due: date('09-25'),
    }),
  );
  at(
    '09-24 12:40',
    newTask('typescript', 'TypeScript 6 の変更点を読む', {
      areaId: area.study,
    }),
  );
  at('09-24 12:50', newTask('bookshelf', '本棚を整理する'));
  at('09-24 19:00', defer(previous, task.apiReview, '09-24'));

  at(
    '09-25 09:00',
    newTask('onboarding', '新メンバーのオンボーディング資料', {
      areaId: area.work,
      priority: 'high',
    }),
  );
  at(
    '09-25 09:01',
    suggest(task.onboarding, 3, 5, '既存資料の更新 2時間、新規 1〜3時間'),
  );
  at(
    '09-25 09:10',
    newTask('dataset', '実験データの前処理', {
      areaId: area.research,
      timeBasis: 'subtasks',
    }),
  );
  at('09-25 09:11', subtask(task.dataset, '欠損値を確認する', 1));
  at('09-25 09:12', subtask(task.dataset, '正規化のスクリプトを書く', 1.5));
  at('09-25 09:13', subtask(task.dataset, '結果を共有する'));
  at(
    '09-25 09:20',
    newTask('reading', '英語の多読 30分', { areaId: area.study }),
  );
  at('09-25 09:21', estimate(task.reading, 0.5));
  at('09-25 09:22', recurring(task.reading, monWedFri, '09-28'));

  at('09-26 06:00', day(previous), 'system');
  at('09-26 10:30', complete(previous, task.cleaning, '09-26', 1));
  at('09-27 06:00', day(previous), 'system');

  // 9/27 (Sun) evening: the person starts the Retro on the last day (F21).
  at('09-27 18:00', review(previous));
  at(
    '09-27 18:10',
    onSprint(previous, (s, ctx) =>
      setReflection(
        s,
        { text: '研究のタスクは提案の幅の上のほうまでかかった。' },
        ctx,
      ),
    ),
  );
  at(
    '09-27 18:15',
    onSprint(previous, (s, ctx) =>
      assessGoal(s, { areaId: area.research, assessment: 'achieved' }, ctx),
    ),
  );
  at(
    '09-27 18:20',
    onSprint(previous, (s, ctx) =>
      setImprovement(
        s,
        { text: '研究の見積もりは提案の多めの値で計画する' },
        ctx,
      ),
    ),
  );
  at('09-27 18:21', (r, ctx) =>
    changed(
      draftCriterion(
        sprintOf(previous),
        {
          criterionId: ctx.newId('PlanningCriterion'),
          policy: {
            scope: { kind: 'area', areaId: area.research },
            rangePolicy: 'hi',
          },
        },
        ctx,
      ),
      ({ sprint, criterion }) => ({ sprints: [sprint], criteria: [criterion] }),
    ),
  );
  at('09-27 18:30', (r, ctx) =>
    changed(
      completeRetro(sprintOf(previous), { criteria: r.criteria }, ctx),
      ({ sprint, criteria }) => ({ sprints: [sprint], criteria }),
    ),
  );

  // ------------------------------------------- Sprint 9/28–10/4: Planning

  at('09-27 20:00', plan('current', '09-28'));
  const current = sprint.current;
  at('09-27 20:05', pick(current, task.paper));
  at('09-27 20:06', pick(current, task.apiReview, previous));
  snapshot('planning-pick', '09-27 20:10');

  at('09-27 20:15', pick(current, task.dataset));
  at('09-27 20:16', pick(current, task.tax));
  at('09-27 20:17', pick(current, task.onboarding));
  at('09-27 20:20', goal(current, area.research, '先行研究を押さえる'));
  at('09-27 20:22', goal(current, area.work, 'API 設計のレビューを終える'));
  at(
    '09-27 20:24',
    onSprint(current, (s, ctx, r) =>
      setGoalLink(
        s,
        {
          sprintTaskId: sprintTaskOf(current, task.tax).id,
          task: get(r.tasks, task.tax),
          goalLink: 'unlinked',
        },
        ctx,
      ),
    ),
  );
  snapshot('planning-shape', '09-27 20:30');

  at(
    '09-27 20:40',
    // 17 hours rather than Scenario A's 18, so that the Check shows a total that
    // may exceed the available hours (13時間15分〜17時間15分 against 17時間).
    onSprint(current, (s, ctx) => setAvailableHours(s, { hours: 17 }, ctx)),
  );
  snapshot('planning-check', '09-27 20:45');

  at('09-27 21:00', confirm(current, true));

  // ----------------------------------------------- Sprint 9/28–10/4: days

  at('09-28 06:00', day(current), 'system');
  at('09-28 07:30', complete(current, task.reading, '09-28', 0.5));
  at('09-28 08:00', toToday(current, task.paper));
  at('09-28 20:00', defer(current, task.paper, '09-28'));

  at('09-29 06:00', day(current), 'system');
  at('09-29 08:00', toToday(current, task.paper));
  at('09-29 08:01', toToday(current, task.tax));
  at('09-29 10:00', complete(current, task.tax, '09-29', 0.25));
  // Quick capture: titles only.
  at('09-29 12:00', newTask('dentist', '歯医者の予約'));
  at(
    '09-29 12:05',
    newTask('seminar', '輪講の担当回を確認する', { areaId: area.research }),
  );
  snapshot('backlog-capture', '09-29 12:30');
  at('09-29 21:00', defer(current, task.paper, '09-29'));

  at('09-30 06:00', day(current), 'system');
  at('09-30 07:30', complete(current, task.reading, '09-30', 0.5));
  at('09-30 09:10', toToday(current, task.paper));
  at('09-30 09:15', start(current, task.paper, '09-30'));
  at('09-30 14:00', pause(current, task.paper, '09-30', 4.5));
  // Scenario C: during an active Sprint, 毎週 土 → 毎週 日 takes effect from
  // the next Sprint; this Sprint's 10/3 stays.
  at('09-30 20:00', (r, ctx) =>
    changed(
      changeRuleForNextSprint(
        {
          user,
          today: ctx.today,
          sprints: r.sprints,
          occurrences: r.occurrences.filter((o) => o.taskId === task.cleaning),
          newOccurrenceId: idsOf('Occurrence'),
          newSprintTaskId: idsOf('SprintTask'),
          task: get(r.tasks, task.cleaning),
          rule: ruleOf(task.cleaning),
          pattern: sunday,
        },
        ctx,
      ),
      ({ rule, sprint, generated, discarded }) => ({
        rules: [rule],
        ...(sprint === undefined ? {} : { sprints: [sprint] }),
        occurrences: generated,
        deleted: { occurrences: discarded },
      }),
    ),
  );
  snapshot('backlog-recurrence', '09-30 20:05');

  at('10-01 06:00', day(current), 'system');
  snapshot('today-morning', '10-01 07:30');
  // Scenario A step 11: the paper Task is only 「昨日の続き」 today; it is
  // not chosen again.
  at('10-01 09:00', toToday(current, task.dataset));
  at('10-01 09:01', toToday(current, task.apiReview));
  at('10-01 09:05', start(current, task.dataset, '10-01'));
  at('10-01 11:30', complete(current, task.apiReview, '10-01', 2));
  snapshot('today-daytime', '10-01 14:00');

  // Scenario B: 「今日へ」 from the Backlog detail, one operation.
  at(
    '10-01 14:30',
    onSprint(current, (s, ctx, r) =>
      addToToday(
        s,
        {
          sprintTaskId: ctx.newId('SprintTask'),
          task: get(r.tasks, task.interview),
          areas: r.areas,
          ...activeCriterionOf(r),
          via: 'backlogToToday',
          selectionId: ctx.newId('DailySelection'),
          date: ctx.today,
        },
        ctx,
      ),
    ),
  );
  at(
    '10-01 15:00',
    onSprint(current, (s, ctx) =>
      noteInterrupt(
        s,
        {
          id: ctx.newId('InterruptNote'),
          text: '障害の問い合わせに対応',
          minutes: 45,
          timeZone: user.timeZone,
        },
        ctx,
      ),
    ),
  );
  at(
    '10-01 15:40',
    onSprint(current, (s, ctx) =>
      noteInterrupt(
        s,
        {
          id: ctx.newId('InterruptNote'),
          text: '急ぎのレビュー依頼',
          minutes: 20,
          timeZone: user.timeZone,
        },
        ctx,
      ),
    ),
  );
  snapshot('today-interrupt', '10-01 16:00');

  at(
    '10-01 16:10',
    suggest(task.typescript, 1, 2, 'リリースノートと移行ガイド', [
      '試すコードの量',
    ]),
  );
  snapshot('backlog-detail', '10-01 16:30');

  at('10-01 18:00', pause(current, task.dataset, '10-01', 2));
  at('10-01 18:30', complete(current, task.interview, '10-01', 2.5));

  at('10-02 06:00', day(current), 'system');
  at(
    '10-02 07:30',
    onToday(current, (s, ctx) =>
      skipSelection(
        s,
        {
          ...selection(current, task.reading, '10-02'),
          occurrence: occurrenceOf(task.reading, '2026-10-02'),
        },
        ctx,
      ),
    ),
  );
  at('10-02 09:00', toToday(current, task.onboarding));
  at('10-02 17:00', complete(current, task.onboarding, '10-02', 4.5));

  at('10-03 06:00', day(current), 'system');
  at('10-03 10:30', complete(current, task.cleaning, '10-03', 1));
  at('10-04 06:00', day(current), 'system');

  // ---------------------------------------------------- 10/5 Review, Retro

  at('10-05 00:05', review(current), 'system');
  snapshot('retro-start', '10-05 08:00');

  at(
    '10-05 09:00',
    onSprint(current, (s, ctx) =>
      pinFact(
        s,
        {
          pin: { kind: 'sprintTask', id: sprintTaskOf(current, task.paper).id },
        },
        ctx,
      ),
    ),
  );
  at(
    '10-05 09:05',
    onSprint(current, (s, ctx) =>
      setReflection(
        s,
        {
          text: '論文は 3本まとめてだと手が止まる。割り込みがあった日は午後が崩れた。',
        },
        ctx,
      ),
    ),
  );
  at(
    '10-05 09:10',
    onSprint(current, (s, ctx) =>
      assessGoal(s, { areaId: area.research, assessment: 'partly' }, ctx),
    ),
  );
  snapshot('retro-reflect', '10-05 09:30');

  at(
    '10-05 09:40',
    onSprint(current, (s, ctx) =>
      assessGoal(s, { areaId: area.work, assessment: 'achieved' }, ctx),
    ),
  );
  at(
    '10-05 09:45',
    onSprint(current, (s, ctx) =>
      setImprovement(s, { text: '論文は 1本ずつタスクに分ける' }, ctx),
    ),
  );
  at(
    '10-05 09:50',
    onSprint(current, (s, ctx) =>
      decideCriterion(s, { decision: 'continue' }, ctx),
    ),
  );
  snapshot('retro-before-complete', '10-05 10:00');

  return {
    ids: {
      user: user.id,
      area: { ...area },
      task: { ...task },
      sprint: { ...sprint },
    },
    snapshots,
  };
}

/**
 * IDs by name, filled in as the records are made. Reading a name before its
 * record is made throws: a step out of order would otherwise pass
 * `undefined` on and quietly make a record without it.
 */
function named<Name extends string, Value>(kind: string): Record<Name, Value> {
  return new Proxy({} as Record<Name, Value>, {
    get(target, name) {
      if (typeof name === 'string' && !Object.hasOwn(target, name)) {
        throw new Error(`No ${kind} ${name} made yet`);
      }
      return Reflect.get(target, name);
    },
  });
}
