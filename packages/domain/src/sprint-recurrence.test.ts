import { describe, expect, it } from 'vitest';
import { completeOccurrence, type Occurrence } from './occurrence';
import { excludeFromPlan, selectTask, startPlanning } from './planning';
import { createRecurrenceRule, recurrenceOf } from './recurrence';
import { omit } from './shared/record';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import type { Sprint } from './sprint';
import { completeTask } from './task';
import { completeFromBacklog } from './today';
import {
  changeRuleForNextSprint,
  createRuleForNextSprint,
  endRuleForNextSprint,
} from './sprint-recurrence';
import { at, ctx, ids, newTask, sprintFixture, unwrap, user } from './testing';

const d = localDate;
const saturday = { freq: 'weekly', daysOfWeek: [6] } as const;
const sunday = { freq: 'weekly', daysOfWeek: [0] } as const;

/**
 * 9/28 week is active with its Saturday done; the 10/5 week is already in
 * Planning (the previous Retro is still open) with its Saturday generated.
 */
function setUp(options: { completeOct3?: boolean } = {}) {
  const { task, rule } = unwrap(
    createRecurrenceRule(
      newTask('部屋の掃除', 'task-clean'),
      { id: id('rule-1'), pattern: saturday, effectiveFrom: d('2026-09-28') },
      ctx,
    ),
  );
  const newOccurrenceId = ids<'Occurrence'>('occ');
  const current = unwrap(
    startPlanning(
      {
        sprintId: id('sprint-2026-09-28'),
        user,
        start: d('2026-09-28'),
        sprints: [],
        recurring: [{ task, rule }],
        occurrences: [],
        newOccurrenceId,
        newSprintTaskId: ids('st-a'),
      },
      ctx,
    ),
  );
  const [oct3] = current.occurrences;
  if (oct3 === undefined) throw new Error('no occurrence');
  const done =
    options.completeOct3 === false
      ? oct3
      : unwrap(completeOccurrence(oct3, ctx));
  const active: Sprint = { ...current.sprint, state: 'review' };
  const next = unwrap(
    startPlanning(
      {
        sprintId: id('sprint-2026-10-05'),
        user,
        start: d('2026-10-05'),
        sprints: [active],
        recurring: [{ task, rule }],
        occurrences: [done],
        newOccurrenceId,
        newSprintTaskId: ids('st-b'),
      },
      ctx,
    ),
  );
  const occurrences: Occurrence[] = [done, ...next.occurrences];
  return {
    task,
    rule,
    active,
    draft: next.sprint,
    occurrences,
    newOccurrenceId,
  };
}

describe('changeRuleForNextSprint (F1, F7)', () => {
  it('F7: rebuilds the draft’s occurrences; the confirmed Sprint keeps its own', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    expect(draft.tasks).toMatchObject([
      { occurrenceIds: ['occ-2'], outcome: 'draft' },
    ]);

    const result = changeRuleForNextSprint(
      {
        task,
        rule,
        pattern: sunday,
        user,
        today: d('2026-10-04'),
        sprints: [active, draft],
        occurrences,
        newOccurrenceId,
        newSprintTaskId: ids('st-new'),
      },
      at('2026-10-04T10:00:00.000Z'),
    );
    const applied = unwrap(result);
    expect(applied.rule.versions.at(-1)).toEqual({
      version: 2,
      pattern: sunday,
      effectiveFrom: '2026-10-05',
    });
    expect(applied.discarded).toEqual(['occ-2']);
    expect(
      applied.generated.map((o) => [o.scheduledDate, o.ruleVersion]),
    ).toEqual([['2026-10-11', 2]]);
    expect(applied.sprint?.tasks).toMatchObject([
      { id: 'st-new-1', occurrenceIds: ['occ-3'], outcome: 'draft' },
    ]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'recurrenceRuleChanged',
      'occurrenceDiscarded',
      'occurrenceGenerated',
      'sprintTaskUnselected',
      'sprintTaskAdded',
    ]);
    // The 9/28 week (not in Planning) is untouched: its 10/3 stays done on v1.
    expect(occurrences[0]).toMatchObject({
      scheduledDate: '2026-10-03',
      ruleVersion: 1,
      state: 'done',
    });
  });

  it('F7: occurrences left out in the draft are rebuilt too, included by default', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    const [, oct10] = occurrences;
    if (oct10 === undefined) throw new Error('no occurrence');
    const excluded = unwrap(excludeFromPlan(draft, oct10, ctx));
    const applied = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: sunday,
          user,
          today: d('2026-10-04'),
          sprints: [active, excluded.sprint],
          occurrences: [occurrences[0] as Occurrence, excluded.occurrence],
          newOccurrenceId,
          newSprintTaskId: ids('st-new'),
        },
        ctx,
      ),
    );
    expect(applied.discarded).toEqual([oct10.id]);
    expect(applied.sprint?.tasks).toMatchObject([{ outcome: 'draft' }]);
  });

  it('F1: without a draft, the change starts after the active Sprint and nothing is rebuilt', () => {
    const { task, rule, active, occurrences, newOccurrenceId } = setUp();
    const applied = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: sunday,
          user,
          today: d('2026-09-30'),
          sprints: [{ ...active, state: 'active' }],
          occurrences: occurrences.slice(0, 1),
          newOccurrenceId,
          newSprintTaskId: ids('st-new'),
        },
        ctx,
      ),
    );
    expect(applied.rule.versions.at(-1)?.effectiveFrom).toBe('2026-10-05');
    expect(applied).not.toHaveProperty('sprint');
    expect(applied.discarded).toEqual([]);
  });

  it('changing to the same pattern changes nothing', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    const result = changeRuleForNextSprint(
      {
        task,
        rule,
        pattern: saturday,
        user,
        today: d('2026-10-04'),
        sprints: [active, draft],
        occurrences,
        newOccurrenceId,
        newSprintTaskId: ids('st-new'),
      },
      ctx,
    );
    expect(result.ok && result.value).toEqual({
      record: {
        rule,
        effectiveFrom: '2026-10-05',
        discarded: [],
        generated: [],
      },
      activities: [],
    });
  });
});

describe('changeRuleForNextSprint (F39)', () => {
  it('F39 / invariant 31: changes before the draft is confirmed replace one version and rebuild only the draft', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    const change = (
      state: { rule: typeof rule; sprint: Sprint; occurrences: Occurrence[] },
      pattern: Parameters<typeof changeRuleForNextSprint>[0]['pattern'],
    ) => {
      const result = changeRuleForNextSprint(
        {
          task,
          rule: state.rule,
          pattern,
          user,
          today: d('2026-10-04'),
          sprints: [active, state.sprint],
          occurrences: state.occurrences,
          newOccurrenceId,
          newSprintTaskId: ids('st-new'),
        },
        ctx,
      );
      const applied = unwrap(result);
      const gone = new Set(applied.discarded);
      return {
        result,
        rule: applied.rule,
        sprint: applied.sprint ?? state.sprint,
        occurrences: [
          ...state.occurrences.filter((o) => !gone.has(o.id)),
          ...applied.generated,
        ],
      };
    };
    const first = change({ rule, sprint: draft, occurrences }, sunday);
    const second = change(first, { freq: 'weekly', daysOfWeek: [0, 3] });
    expect(second.rule.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(second.rule.versions.at(-1)).toEqual({
      version: 2,
      pattern: { freq: 'weekly', daysOfWeek: [0, 3] },
      effectiveFrom: '2026-10-05',
    });
    expect(
      second.occurrences.map((o) => [o.scheduledDate, o.ruleVersion, o.state]),
    ).toEqual([
      ['2026-10-03', 1, 'done'],
      ['2026-10-07', 2, 'pending'],
      ['2026-10-11', 2, 'pending'],
    ]);

    // Back to Saturdays: the draft is rebuilt from version 1 again.
    const back = change(second, saturday);
    expect(back.rule).toEqual(rule);
    expect(
      back.occurrences.map((o) => [o.scheduledDate, o.ruleVersion, o.state]),
    ).toEqual([
      ['2026-10-03', 1, 'done'],
      ['2026-10-10', 1, 'pending'],
    ]);
    expect(back.result.ok && back.result.value.activities[0]).toMatchObject({
      kind: 'recurrenceRuleChanged',
      version: 1,
      effectiveFrom: '2026-10-05',
    });
    // The confirmed Sprint's occurrence is the same record throughout.
    expect(back.occurrences[0]).toBe(occurrences[0]);
  });
});

describe('changeRuleForNextSprint — guards and edges', () => {
  function change(
    input: Partial<Parameters<typeof changeRuleForNextSprint>[0]>,
    base = setUp(),
  ) {
    return changeRuleForNextSprint(
      {
        task: base.task,
        rule: base.rule,
        pattern: sunday,
        user,
        today: d('2026-10-04'),
        sprints: [base.active, base.draft],
        occurrences: base.occurrences,
        newOccurrenceId: base.newOccurrenceId,
        newSprintTaskId: ids('st-new'),
        ...input,
      },
      ctx,
    );
  }

  it('invariant 31: a pending occurrence of the confirmed Sprint is neither discarded nor moved', () => {
    const base = setUp({ completeOct3: false });
    const applied = unwrap(change({}, base));
    expect(base.occurrences[0]).toMatchObject({
      state: 'pending',
      ruleVersion: 1,
    });
    expect(applied.discarded).toEqual(['occ-2']);
    expect(applied.effectiveFrom).toBe('2026-10-05');
  });

  it('F7: a draft whose generation made none of the old version still gets the new one', () => {
    // A monthly rule on the 15th has no date in the 10/5 week.
    const { task, rule } = unwrap(
      createRecurrenceRule(
        newTask('請求書', 'task-bill'),
        {
          id: id('rule-bill'),
          pattern: { freq: 'monthly', dayOfMonth: 15 },
          effectiveFrom: d('2026-09-28'),
        },
        ctx,
      ),
    );
    const draft = sprintFixture('2026-10-05', 'planning');
    const applied = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: { freq: 'weekly', daysOfWeek: [1] },
          user,
          today: d('2026-10-04'),
          sprints: [sprintFixture('2026-09-28', 'review'), draft],
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st'),
        },
        ctx,
      ),
    );
    expect(
      applied.generated.map((o) => [o.scheduledDate, o.ruleVersion]),
    ).toEqual([['2026-10-05', 2]]);
    expect(applied.sprint?.tasks).toMatchObject([
      { taskId: 'task-bill', outcome: 'draft' },
    ]);
  });

  it('refuses a rule of another Task or a Task that is not active', () => {
    const base = setUp();
    const other = {
      ...newTask('別', 'task-other'),
      recurrenceRuleId: base.rule.id,
    };
    expect(change({ task: other }, base)).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
    const archived = { ...base.task, lifecycle: 'archived' as const };
    expect(change({ task: archived }, base)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('a rule created for a later Sprint is changed from its own start', () => {
    const { task, rule } = unwrap(
      createRecurrenceRule(
        newTask('読書', 'task-read'),
        {
          id: id('rule-read'),
          pattern: saturday,
          effectiveFrom: d('2026-10-12'),
        },
        ctx,
      ),
    );
    const applied = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: sunday,
          user,
          today: d('2026-10-01'),
          sprints: [sprintFixture('2026-09-28', 'active')],
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st'),
        },
        ctx,
      ),
    );
    expect(applied.effectiveFrom).toBe('2026-10-12');
    // Version 1 has not taken effect, so it is replaced (F39).
    expect(applied.rule.versions).toEqual([
      { version: 1, pattern: sunday, effectiveFrom: '2026-10-12' },
    ]);
  });
});

describe('createRuleForNextSprint (F15)', () => {
  function create(sprints: readonly Sprint[], today: string) {
    return createRuleForNextSprint(
      {
        task: newTask('ストレッチ', 'task-stretch'),
        ruleId: id('rule-s'),
        pattern: { freq: 'weekly', daysOfWeek: [1, 3] },
        user,
        today: d(today),
        sprints,
        occurrences: [],
        newOccurrenceId: ids('occ'),
        newSprintTaskId: ids('st'),
      },
      ctx,
    );
  }

  it('while a draft is open, generates its period and includes it', () => {
    const result = create(
      [
        sprintFixture('2026-09-28', 'active'),
        sprintFixture('2026-10-05', 'planning'),
      ],
      '2026-10-02',
    );
    const applied = unwrap(result);
    expect(applied.task.recurrenceRuleId).toBe('rule-s');
    expect(applied.effectiveFrom).toBe('2026-10-05');
    expect(applied.generated.map((o) => o.scheduledDate)).toEqual([
      '2026-10-05',
      '2026-10-07',
    ]);
    expect(applied.sprint?.tasks).toMatchObject([
      { taskId: 'task-stretch', outcome: 'draft', goalLink: 'unlinked' },
    ]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'recurrenceRuleCreated',
      'occurrenceGenerated',
      'occurrenceGenerated',
      'sprintTaskAdded',
    ]);
  });

  it('without a draft, only makes the rule, starting after the active Sprint', () => {
    const applied = unwrap(
      create([sprintFixture('2026-09-28', 'active')], '2026-09-30'),
    );
    expect(applied.effectiveFrom).toBe('2026-10-05');
    expect(applied.generated).toEqual([]);
    expect(applied).not.toHaveProperty('sprint');
  });

  it('replaces a one-off draft of the same Task with the recurring one (F15)', () => {
    const task = newTask('ジムに行く', 'task-gym');
    const draft = sprintFixture('2026-10-05', 'planning', {
      tasks: [
        {
          id: id('st-gym'),
          taskId: task.id,
          origin: 'planning',
          addedAt: ctx.now,
          goalLink: 'linked',
          outcome: 'draft',
          carriedFrom: id('st-last-week'),
        },
      ],
    });
    const applied = unwrap(
      createRuleForNextSprint(
        {
          task,
          ruleId: id('rule-gym'),
          pattern: { freq: 'weekly', daysOfWeek: [2, 4] },
          user,
          today: d('2026-10-04'),
          sprints: [sprintFixture('2026-09-28', 'review'), draft],
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st'),
        },
        ctx,
      ),
    );
    // The carry-over link and the Goal link of the one-off draft are not
    // kept: the Task now joins as a recurring one.
    expect(applied.sprint?.tasks).toEqual([
      expect.objectContaining({
        taskId: 'task-gym',
        occurrenceIds: ['occ-1', 'occ-2'],
        goalLink: 'unlinked',
        outcome: 'draft',
      }),
    ]);
    expect(applied.sprint?.tasks[0]).not.toHaveProperty('carriedFrom');
  });
});

describe('endRuleForNextSprint (F41)', () => {
  it('ends before the draft and takes the rule out of it; the Task and past occurrences remain', () => {
    const { task, rule, active, draft, occurrences } = setUp();
    const result = endRuleForNextSprint(
      {
        task,
        rule,
        user,
        today: d('2026-10-04'),
        sprints: [active, draft],
        occurrences,
      },
      ctx,
    );
    const ended = unwrap(result);
    // Off the rule: one-off for the Sprints after it. The rule keeps the Task.
    expect(ended.task).toEqual(omit(task, 'recurrenceRuleId'));
    expect(ended.removed).toBe(false);
    expect(ended.rule.taskId).toBe(task.id);
    expect(ended.rule?.versions).toEqual([
      {
        version: 1,
        pattern: saturday,
        effectiveFrom: '2026-09-28',
        effectiveTo: '2026-10-04',
      },
    ]);
    expect(ended.discarded).toEqual(['occ-2']);
    expect(ended.sprint?.tasks).toEqual([]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'recurrenceRuleEnded',
      'occurrenceDiscarded',
      'sprintTaskUnselected',
    ]);
    // The 9/28 week is untouched (invariant 31).
    expect(occurrences[0]).toMatchObject({ state: 'done', ruleVersion: 1 });
  });

  it('without a draft, ends with the active Sprint and changes no Sprint', () => {
    const { task, rule, active, occurrences } = setUp({ completeOct3: false });
    const ended = unwrap(
      endRuleForNextSprint(
        {
          task,
          rule,
          user,
          today: d('2026-09-30'),
          sprints: [{ ...active, state: 'active' }],
          occurrences: occurrences.slice(0, 1),
        },
        ctx,
      ),
    );
    // The pending 10/3 of the running week stays (invariant 31).
    expect(ended.rule?.versions.at(-1)?.effectiveTo).toBe('2026-10-04');
    expect(ended.discarded).toEqual([]);
    expect(ended).not.toHaveProperty('sprint');
  });

  it('F39: a change not in effect yet is dropped with the draft', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    const changed = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: sunday,
          user,
          today: d('2026-10-04'),
          sprints: [active, draft],
          occurrences,
          newOccurrenceId,
          newSprintTaskId: ids('st-new'),
        },
        ctx,
      ),
    );
    const ended = unwrap(
      endRuleForNextSprint(
        {
          task,
          rule: changed.rule,
          user,
          today: d('2026-10-04'),
          sprints: [active, changed.sprint ?? draft],
          occurrences: [occurrences[0]!, ...changed.generated],
        },
        ctx,
      ),
    );
    expect(ended.rule?.versions).toEqual([
      {
        version: 1,
        pattern: saturday,
        effectiveFrom: '2026-09-28',
        effectiveTo: '2026-10-04',
      },
    ]);
    expect(ended.discarded).toEqual(changed.generated.map((o) => o.id));
    expect(ended.sprint?.tasks).toEqual([]);
  });

  it('a rule just made, with only draft occurrences, is removed: the Task is one-off again', () => {
    const sprints = [
      sprintFixture('2026-09-28', 'active'),
      sprintFixture('2026-10-05', 'planning'),
    ];
    const created = unwrap(
      createRuleForNextSprint(
        {
          task: newTask('ストレッチ', 'task-stretch'),
          ruleId: id('rule-s'),
          pattern: { freq: 'weekly', daysOfWeek: [1, 3] },
          user,
          today: d('2026-10-02'),
          sprints,
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st'),
        },
        ctx,
      ),
    );
    const result = endRuleForNextSprint(
      {
        task: created.task,
        rule: created.rule,
        user,
        today: d('2026-10-02'),
        sprints: [sprints[0]!, created.sprint!],
        occurrences: created.generated,
      },
      ctx,
    );
    const removed = unwrap(result);
    expect(removed.task).not.toHaveProperty('recurrenceRuleId');
    expect(removed).toMatchObject({ removed: true, rule: { id: 'rule-s' } });
    expect(removed.discarded).toEqual(['occ-1', 'occ-2']);
    expect(removed.sprint?.tasks).toEqual([]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'recurrenceRuleRemoved',
      'occurrenceDiscarded',
      'occurrenceDiscarded',
      'sprintTaskUnselected',
    ]);
  });

  it('a rule just made without a draft is removed too', () => {
    const created = unwrap(
      createRuleForNextSprint(
        {
          task: newTask('ストレッチ', 'task-stretch'),
          ruleId: id('rule-s'),
          pattern: { freq: 'daily' },
          user,
          today: d('2026-09-30'),
          sprints: [sprintFixture('2026-09-28', 'active')],
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st'),
        },
        ctx,
      ),
    );
    const removed = unwrap(
      endRuleForNextSprint(
        {
          task: created.task,
          rule: created.rule,
          user,
          today: d('2026-09-30'),
          sprints: [sprintFixture('2026-09-28', 'active')],
          occurrences: [],
        },
        ctx,
      ),
    );
    expect(removed.task).not.toHaveProperty('recurrenceRuleId');
    expect(removed.removed).toBe(true);
    expect(removed).not.toHaveProperty('sprint');
    expect(removed.discarded).toEqual([]);
  });

  it('refuses a rule of another Task, a Task not active, or a rule already ended', () => {
    const { task, rule, active, occurrences } = setUp();
    const end = (input: Partial<Parameters<typeof endRuleForNextSprint>[0]>) =>
      endRuleForNextSprint(
        {
          task,
          rule,
          user,
          today: d('2026-09-30'),
          sprints: [{ ...active, state: 'active' }],
          occurrences: occurrences.slice(0, 1),
          ...input,
        },
        ctx,
      );
    expect(end({ task: newTask('別', 'task-other') })).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
    expect(end({ task: { ...task, lifecycle: 'archived' } })).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    const ended = unwrap(end({}));
    // Ended, the rule is off the Task; ending it again is refused either way.
    expect(end({ task: ended.task, rule: ended.rule })).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
    expect(end({ rule: ended.rule })).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('a later Planning generates no occurrence of an ended rule', () => {
    const { task, rule, active, occurrences } = setUp({ completeOct3: false });
    const ended = unwrap(
      endRuleForNextSprint(
        {
          task,
          rule,
          user,
          today: d('2026-09-30'),
          sprints: [{ ...active, state: 'active' }],
          occurrences: occurrences.slice(0, 1),
        },
        ctx,
      ),
    );
    const next = unwrap(
      startPlanning(
        {
          sprintId: id('sprint-2026-10-05'),
          user,
          start: d('2026-10-05'),
          sprints: [{ ...active, state: 'review' }],
          recurring: [{ task: ended.task, rule: ended.rule }],
          occurrences: occurrences.slice(0, 1),
          newOccurrenceId: ids('occ-later'),
          newSprintTaskId: ids('st-later'),
        },
        ctx,
      ),
    );
    expect(next.occurrences).toEqual([]);
    expect(next.sprint.tasks).toEqual([]);
    // The Task is one-off there: it can be chosen like any other (F41).
    const chosen = unwrap(
      selectTask(
        next.sprint,
        {
          sprintTaskId: id('st-one-off'),
          task: ended.task,
        },
        ctx,
      ),
    );
    expect(chosen.tasks).toMatchObject([{ taskId: task.id, outcome: 'draft' }]);
    expect(chosen.tasks[0]).not.toHaveProperty('occurrenceIds');
  });

  it('this Sprint’s occurrences stay done one by one: no completion from the Backlog until it ends', () => {
    const { task, rule, active, occurrences } = setUp({ completeOct3: false });
    const running: Sprint = {
      ...active,
      state: 'active',
      tasks: active.tasks.map((t) => ({ ...t, outcome: 'planned' })),
    };
    const ended = unwrap(
      endRuleForNextSprint(
        {
          task,
          rule,
          user,
          today: d('2026-09-30'),
          sprints: [running],
          occurrences: occurrences.slice(0, 1),
        },
        ctx,
      ),
    );
    expect(
      completeFromBacklog(
        running,
        { task: ended.task, date: d('2026-09-30'), selectionId: id('sel') },
        ctx,
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'recurringTaskCannotComplete' },
    });
    // After its last day the Task is one-off: it completes as a whole.
    expect(completeTask(ended.task, ctx).ok).toBe(true);
  });

  it('after its last day the Task can be made recurring again, with a rule of its own', () => {
    const { task, rule, active, occurrences } = setUp({ completeOct3: false });
    const ended = unwrap(
      endRuleForNextSprint(
        {
          task,
          rule,
          user,
          today: d('2026-09-30'),
          sprints: [{ ...active, state: 'active' }],
          occurrences: occurrences.slice(0, 1),
        },
        ctx,
      ),
    );
    const again = unwrap(
      createRuleForNextSprint(
        {
          task: ended.task,
          ruleId: id('rule-2'),
          pattern: sunday,
          user,
          today: d('2026-10-06'),
          sprints: [{ ...active, state: 'closed' }],
          occurrences: [],
          newOccurrenceId: ids('occ-again'),
          newSprintTaskId: ids('st-again'),
        },
        ctx,
      ),
    );
    expect(again.task.recurrenceRuleId).toBe('rule-2');
    // The Backlog follows the Task's own rule, not the ended one.
    const rules = [ended.rule, again.rule];
    expect(recurrenceOf(again.task, rules, d('2026-10-06'))).toBe(again.rule);
    expect(again.rule.versions[0]?.effectiveFrom).toBe('2026-10-05');
  });

  it('recurrenceOf: the Backlog shows an ended rule until its last day', () => {
    const { task, rule, active, occurrences } = setUp({ completeOct3: false });
    const ended = unwrap(
      endRuleForNextSprint(
        {
          task,
          rule,
          user,
          today: d('2026-09-30'),
          sprints: [{ ...active, state: 'active' }],
          occurrences: occurrences.slice(0, 1),
        },
        ctx,
      ),
    );
    expect(recurrenceOf(ended.task, [ended.rule], d('2026-10-04'))).toBe(
      ended.rule,
    );
    expect(
      recurrenceOf(ended.task, [ended.rule], d('2026-10-05')),
    ).toBeUndefined();
    expect(recurrenceOf(task, [rule], d('2027-01-01'))).toBe(rule);
  });
});

describe('sprintFixture', () => {
  it('is a one-week period', () => {
    expect(sprintFixture('2026-09-28', 'planning')).toMatchObject({
      start: '2026-09-28',
      end: '2026-10-04',
    });
  });
});
