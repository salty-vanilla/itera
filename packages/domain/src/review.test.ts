import { describe, expect, it } from 'vitest';
import * as domain from './index';
import type { PlanningCriterion } from './criterion';
import { generateOccurrences, type Occurrence } from './occurrence';
import type { CriterionPolicy } from './planning-value';
import { createRecurrenceRule } from './recurrence';
import {
  assessGoal,
  completeRetro,
  decideCriterion,
  draftCriterion,
  dropCriterionDraft,
  enterReview,
  previousImprovement,
  setImprovement,
  setReflection,
  togglePin,
} from './review';
import { id } from './shared/ids';
import { instant, localDate } from './shared/time';
import type { Sprint, SprintTask } from './sprint';
import { recordActualTime } from './today';
import {
  ctx,
  ids,
  newTask,
  researchId,
  sprintFixture,
  unwrap,
  userId,
} from './testing';

const d = localDate;
const system = {
  now: instant('2026-10-04T15:00:00.000Z'),
  actor: 'system' as const,
};
const policy: CriterionPolicy = {
  scope: { kind: 'area', areaId: researchId },
  rangePolicy: 'hi',
};

function planned(taskId: string, extra: Partial<SprintTask> = {}): SprintTask {
  return {
    id: id(`st-${taskId}`),
    taskId: id(taskId),
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: 'planned',
    ...extra,
  };
}

function recurringOccurrences(): readonly Occurrence[] {
  const { rule } = unwrap(
    createRecurrenceRule(
      newTask('ストレッチ', 'task-stretch'),
      {
        id: id('rule-s'),
        pattern: { freq: 'weekly', daysOfWeek: [2, 4] },
        effectiveFrom: d('2026-09-28'),
      },
      ctx,
    ),
  );
  return unwrap(
    generateOccurrences(
      rule,
      {
        start: d('2026-09-28'),
        end: d('2026-10-04'),
        existing: [],
        newOccurrenceId: ids('occ'),
      },
      ctx,
    ),
  );
}

function active(extra: Partial<Sprint> = {}): Sprint {
  const occurrences = recurringOccurrences();
  return sprintFixture('2026-09-28', 'active', {
    tasks: [
      planned('task-open'),
      planned('task-done', { outcome: 'done' }),
      planned('task-stretch', {
        goalLink: 'unlinked',
        occurrenceIds: occurrences.map((o) => o.id),
      }),
    ],
    goals: [{ areaId: researchId, text: 'g', plannedText: 'g' }],
    dailySelections: [
      {
        id: id('sel-open'),
        date: d('2026-10-04'),
        sprintTaskId: id('st-task-open'),
        origin: 'manual',
        resolution: 'selected',
        selectedAt: ctx.now,
      },
    ],
    ...extra,
  });
}

function reviewed(extra: Partial<Sprint> = {}) {
  const occurrences = recurringOccurrences();
  const [tue] = occurrences;
  const done = tue === undefined ? [] : [{ ...tue, state: 'done' as const }];
  return unwrap(
    enterReview(
      active(extra),
      {
        today: d('2026-10-05'),
        occurrences: [...done, ...occurrences.slice(1)],
      },
      system,
    ),
  );
}

describe('enterReview', () => {
  it('wraps the week up: carried over, recurring closed as done (F20), missed, unresolved', () => {
    const result = reviewed();
    const sprint = result.sprint;
    expect(sprint.state).toBe('review');
    expect(sprint.tasks.map((t) => [t.taskId, t.outcome])).toEqual([
      ['task-open', 'carriedOver'],
      ['task-done', 'done'],
      ['task-stretch', 'done'],
    ]);
    // Tuesday was done; Thursday was still pending and is now missed.
    expect(result.occurrences.map((o) => [o.scheduledDate, o.state])).toEqual([
      ['2026-10-01', 'missed'],
    ]);
    expect(sprint.dailySelections[0]?.resolution).toBe('unresolved');
    expect(sprint.retro).toEqual({
      startedAt: system.now,
      pins: [],
      reflection: '',
    });
  });

  it('F21: the person may start on the last day; the system only after the end', () => {
    expect(
      enterReview(active(), { today: d('2026-10-04'), occurrences: [] }, ctx),
    ).toMatchObject({ ok: true });
    expect(
      enterReview(active(), { today: d('2026-10-03'), occurrences: [] }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
    expect(
      enterReview(
        active(),
        { today: d('2026-10-04'), occurrences: [] },
        system,
      ),
    ).toMatchObject({ ok: false });
  });

  it('only from active', () => {
    const sprint = reviewed().sprint;
    expect(
      enterReview(sprint, { today: d('2026-10-06'), occurrences: [] }, system),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe('F35: enterReview links drafts of the next Sprint to their carry-over', () => {
  const draft = (taskId: string, extra: Partial<SprintTask> = {}) =>
    planned(taskId, { id: id(`next-${taskId}`), outcome: 'draft', ...extra });
  const nextSprint = (tasks: readonly SprintTask[]): Sprint =>
    sprintFixture('2026-10-05', 'planning', {
      previousSprintId: active().id,
      tasks,
    });

  it('links a draft chosen on its own, as the system (invariant 20: nothing is added)', () => {
    const next = nextSprint([draft('task-open'), draft('task-new')]);
    const result = enterReview(
      active(),
      { today: d('2026-10-04'), occurrences: [], next },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const linked = result.value.record.next;
    expect(linked?.tasks.map((t) => [t.taskId, t.carriedFrom])).toEqual([
      ['task-open', 'st-task-open'],
      ['task-new', undefined],
    ]);
    expect(
      result.value.activities.filter((a) => a.kind === 'sprintTaskCarryLinked'),
    ).toEqual([
      {
        kind: 'sprintTaskCarryLinked',
        at: ctx.now,
        actor: 'system',
        sprintId: next.id,
        sprintTaskId: id('next-task-open'),
        taskId: id('task-open'),
        carriedFrom: id('st-task-open'),
      },
    ]);
  });

  it('leaves Tasks that were done, recurring or already linked as they are', () => {
    const next = nextSprint([
      draft('task-done'),
      draft('task-stretch', { occurrenceIds: [] }),
      draft('task-open', { carriedFrom: id('st-older') }),
    ]);
    const result = unwrap(
      enterReview(
        active(),
        { today: d('2026-10-05'), occurrences: [], next },
        system,
      ),
    );
    expect(result.next).toEqual(next);
  });

  it('without a next Sprint in Planning, nothing else changes', () => {
    expect(reviewed().next).toBeUndefined();
  });

  it('refuses a next Sprint that is not the draft after this one', () => {
    const input = { today: d('2026-10-05'), occurrences: [] };
    expect(
      enterReview(
        active(),
        { ...input, next: { ...nextSprint([]), state: 'active' } },
        system,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    expect(
      enterReview(
        active(),
        { ...input, next: { ...nextSprint([]), previousSprintId: id('x') } },
        system,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });
});

describe('Retro', () => {
  it('invariant 19: Goals are judged by the person only, and can be left unjudged', () => {
    const sprint = reviewed().sprint;
    expect(sprint.goals[0]).not.toHaveProperty('selfAssessment');
    const judged = unwrap(
      assessGoal(sprint, { areaId: researchId, assessment: 'partly' }, ctx),
    );
    expect(judged.goals[0]?.selfAssessment).toBe('partly');
    const cleared = unwrap(
      assessGoal(judged, { areaId: researchId, assessment: null }, ctx),
    );
    expect(cleared.goals[0]).not.toHaveProperty('selfAssessment');
    expect(
      assessGoal(active(), { areaId: researchId, assessment: 'achieved' }, ctx),
    ).toMatchObject({
      ok: false,
    });
  });

  it('pins facts and toggles them off', () => {
    const pin = { kind: 'sprintTask' as const, id: 'st-task-open' };
    let sprint = unwrap(togglePin(reviewed().sprint, { pin }, ctx));
    expect(sprint.retro?.pins).toEqual([pin]);
    sprint = unwrap(togglePin(sprint, { pin }, ctx));
    expect(sprint.retro?.pins).toEqual([]);
  });

  it('invariant 38: one improvement text per Retro; a criterion is optional and separate', () => {
    let sprint = unwrap(
      setReflection(reviewed().sprint, { text: '見送りが多かった' }, ctx),
    );
    sprint = unwrap(setImprovement(sprint, { text: '1 本ずつに分ける' }, ctx));
    sprint = unwrap(
      setImprovement(sprint, { text: '論文を 1 本ずつに分ける' }, ctx),
    );
    expect(sprint.retro).toMatchObject({
      reflection: '見送りが多かった',
      improvement: { text: '論文を 1 本ずつに分ける' },
    });
    expect(sprint.retro?.improvement).not.toHaveProperty('criterionId');

    const drafted = unwrap(
      draftCriterion(sprint, { criterionId: id('crit-2'), policy }, ctx),
    );
    expect(drafted.criterion).toEqual({
      id: 'crit-2',
      userId,
      policy,
      sourceSprintId: sprint.id,
      state: 'draft',
      createdAt: ctx.now,
    });
    expect(drafted.sprint.retro?.improvement?.criterionId).toBe('crit-2');
    // 0..1 per improvement.
    expect(
      draftCriterion(
        drafted.sprint,
        { criterionId: id('crit-3'), policy },
        ctx,
      ),
    ).toMatchObject({ ok: false });
    // The text cannot be removed while a criterion hangs on it.
    expect(setImprovement(drafted.sprint, { text: '' }, ctx)).toMatchObject({
      ok: false,
    });
    const dropped = unwrap(dropCriterionDraft(drafted.sprint, ctx));
    expect(dropped.dropped).toBe('crit-2');
    expect(dropped.sprint.retro?.improvement).toEqual({
      text: '論文を 1 本ずつに分ける',
    });
  });

  it('a criterion needs an improvement to come from', () => {
    expect(
      draftCriterion(reviewed().sprint, { criterionId: id('c'), policy }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });
});

describe('completeRetro and criteria', () => {
  const activeCriterion: PlanningCriterion = {
    id: id('crit-1'),
    userId,
    policy,
    sourceSprintId: id('sprint-2026-09-21'),
    state: 'active',
    createdAt: ctx.now,
  };

  function withUse(appliedAtConfirm: boolean) {
    return reviewed({
      criterionUse: { criterionId: activeCriterion.id, appliedAtConfirm },
    }).sprint;
  }

  it('invariant 36: a Sprint with a criterion cannot complete its Retro without a decision, applied or not', () => {
    for (const appliedAtConfirm of [true, false]) {
      const sprint = withUse(appliedAtConfirm);
      expect(
        completeRetro(sprint, { criteria: [activeCriterion] }, ctx),
      ).toMatchObject({
        ok: false,
        error: { code: 'invalidTransition' },
      });
      const decided = unwrap(
        decideCriterion(sprint, { decision: 'continue' }, ctx),
      );
      const done = unwrap(
        completeRetro(decided, { criteria: [activeCriterion] }, ctx),
      );
      expect(done.sprint.state).toBe('closed');
      expect(done.sprint.retro?.completedAt).toBe(ctx.now);
      expect(done.criteria).toEqual([]); // continue: stays active
    }
  });

  it('end: the active criterion ends', () => {
    const decided = unwrap(
      decideCriterion(withUse(true), { decision: 'end' }, ctx),
    );
    const done = unwrap(
      completeRetro(decided, { criteria: [activeCriterion] }, ctx),
    );
    expect(done.criteria).toEqual([{ ...activeCriterion, state: 'ended' }]);
  });

  it('replace: the draft of this Retro takes over (invariant 35: still one active)', () => {
    let sprint = unwrap(
      setImprovement(withUse(true), { text: '研究は中央で計画する' }, ctx),
    );
    expect(decideCriterion(sprint, { decision: 'replace' }, ctx)).toMatchObject(
      { ok: false },
    );
    const drafted = unwrap(
      draftCriterion(
        sprint,
        {
          criterionId: id('crit-2'),
          policy: { ...policy, rangePolicy: 'mid' },
        },
        ctx,
      ),
    );
    sprint = unwrap(
      decideCriterion(drafted.sprint, { decision: 'replace' }, ctx),
    );
    const done = unwrap(
      completeRetro(
        sprint,
        { criteria: [activeCriterion, drafted.criterion] },
        ctx,
      ),
    );
    expect(done.criteria).toEqual([
      { ...activeCriterion, state: 'replaced', replacedBy: 'crit-2' },
      { ...drafted.criterion, state: 'active' },
    ]);
    expect(done.criteria.filter((c) => c.state === 'active')).toHaveLength(1);
  });

  it('invariant 35: continuing with a draft would make two active, so it is refused', () => {
    const sprint = unwrap(setImprovement(withUse(false), { text: 'x' }, ctx));
    const drafted = unwrap(
      draftCriterion(sprint, { criterionId: id('crit-2'), policy }, ctx),
    );
    const decided = unwrap(
      decideCriterion(drafted.sprint, { decision: 'continue' }, ctx),
    );
    expect(
      completeRetro(
        decided,
        { criteria: [activeCriterion, drafted.criterion] },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('without a criterion, a draft becomes active; without either, nothing changes', () => {
    const plain = unwrap(
      setImprovement(reviewed().sprint, { text: '研究は上限で' }, ctx),
    );
    const drafted = unwrap(
      draftCriterion(plain, { criterionId: id('crit-1'), policy }, ctx),
    );
    const done = unwrap(
      completeRetro(drafted.sprint, { criteria: [drafted.criterion] }, ctx),
    );
    expect(done.criteria).toEqual([{ ...drafted.criterion, state: 'active' }]);

    const nothing = unwrap(
      completeRetro(reviewed().sprint, { criteria: [] }, ctx),
    );
    expect(nothing.criteria).toEqual([]);
    expect(nothing.sprint.state).toBe('closed');
  });

  it('dropping the draft clears a replace decision that relied on it', () => {
    let sprint = unwrap(setImprovement(withUse(true), { text: 'x' }, ctx));
    sprint = unwrap(
      draftCriterion(sprint, { criterionId: id('crit-2'), policy }, ctx),
    ).sprint;
    sprint = unwrap(decideCriterion(sprint, { decision: 'replace' }, ctx));
    const dropped = unwrap(dropCriterionDraft(sprint, ctx)).sprint;
    expect(dropped.criterionUse).not.toHaveProperty('retroDecision');
  });

  it('invariant 37: no command changes whether the criterion was applied', () => {
    const decided = unwrap(
      decideCriterion(withUse(false), { decision: 'end' }, ctx),
    );
    expect(decided.criterionUse?.appliedAtConfirm).toBe(false);
    // Nothing like setCriterionApplied / unapplyCriterion exists.
    const names = Object.keys(domain).filter(
      (n) => /criterion/i.test(n) && /appl/i.test(n),
    );
    expect(names).toEqual([]);
  });

  it('previousImprovement is shown at the next Planning', () => {
    const closed = unwrap(
      completeRetro(
        unwrap(setImprovement(reviewed().sprint, { text: '1 本ずつ' }, ctx)),
        { criteria: [] },
        ctx,
      ),
    ).sprint;
    const next = sprintFixture('2026-10-05', 'planning', {
      previousSprintId: closed.id,
    });
    expect(previousImprovement(next, [closed, next])).toEqual({
      text: '1 本ずつ',
    });
  });
});

describe('F22: actual time in Review', () => {
  it('can be added in Review, not after the Retro is complete', () => {
    const sprint = reviewed().sprint;
    const input = {
      sprintTaskId: id<'SprintTask'>('st-task-open'),
      hours: 2,
      date: d('2026-10-01'),
    };
    expect(
      unwrap(recordActualTime(sprint, input, ctx)).actualTimes,
    ).toHaveLength(1);
    const closed = unwrap(completeRetro(sprint, { criteria: [] }, ctx)).sprint;
    expect(recordActualTime(closed, input, ctx)).toMatchObject({ ok: false });
  });
});

describe('fixes from acceptance (#24)', () => {
  const activeCriterion: PlanningCriterion = {
    id: id('crit-1'),
    userId,
    policy,
    sourceSprintId: id('sprint-2026-09-21'),
    state: 'active',
    createdAt: ctx.now,
  };

  it('F23: when the person starts the Retro, missed and unresolved are the system’s marks', () => {
    const occurrences = recurringOccurrences();
    const result = enterReview(
      active(),
      { today: d('2026-10-04'), occurrences },
      ctx,
    );
    const kinds = result.ok
      ? result.value.activities.map((a) => [a.kind, a.actor])
      : [];
    expect(kinds).toEqual([
      ['occurrenceMissed', 'system'],
      ['occurrenceMissed', 'system'],
      ['todayUnresolved', 'system'],
      ['sprintReviewStarted', 'user'],
    ]);
  });

  it('invariants 19 and 36: only the person judges a Goal and decides on the criterion', () => {
    const sprint = reviewed({
      criterionUse: { criterionId: activeCriterion.id, appliedAtConfirm: true },
    }).sprint;
    for (const actor of ['system', 'agent'] as const) {
      const other = { ...ctx, actor };
      expect(
        assessGoal(
          sprint,
          { areaId: researchId, assessment: 'achieved' },
          other,
        ),
      ).toMatchObject({ ok: false });
      expect(decideCriterion(sprint, { decision: 'end' }, other)).toMatchObject(
        { ok: false },
      );
    }
  });

  it('the same judgement or decision again appends nothing', () => {
    let sprint = reviewed({
      criterionUse: { criterionId: activeCriterion.id, appliedAtConfirm: true },
    }).sprint;
    sprint = unwrap(
      assessGoal(sprint, { areaId: researchId, assessment: 'partly' }, ctx),
    );
    sprint = unwrap(decideCriterion(sprint, { decision: 'end' }, ctx));
    const again = assessGoal(
      sprint,
      { areaId: researchId, assessment: 'partly' },
      ctx,
    );
    expect(again.ok && again.value.activities).toEqual([]);
    const decided = decideCriterion(sprint, { decision: 'end' }, ctx);
    expect(decided.ok && decided.value.activities).toEqual([]);
  });

  it('end with a draft: the old one ends and the draft becomes active', () => {
    let sprint = reviewed({
      criterionUse: { criterionId: activeCriterion.id, appliedAtConfirm: true },
    }).sprint;
    sprint = unwrap(setImprovement(sprint, { text: 'x' }, ctx));
    const drafted = unwrap(
      draftCriterion(sprint, { criterionId: id('crit-2'), policy }, ctx),
    );
    sprint = unwrap(decideCriterion(drafted.sprint, { decision: 'end' }, ctx));
    const done = unwrap(
      completeRetro(
        sprint,
        { criteria: [activeCriterion, drafted.criterion] },
        ctx,
      ),
    );
    expect(done.criteria).toEqual([
      { ...activeCriterion, state: 'ended' },
      { ...drafted.criterion, state: 'active' },
    ]);
  });

  it('the Sprint’s criterion must be the active one', () => {
    let sprint = reviewed({
      criterionUse: { criterionId: activeCriterion.id, appliedAtConfirm: true },
    }).sprint;
    sprint = unwrap(decideCriterion(sprint, { decision: 'continue' }, ctx));
    expect(
      completeRetro(
        sprint,
        { criteria: [{ ...activeCriterion, state: 'ended' }] },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'notFound' } });
  });
});
