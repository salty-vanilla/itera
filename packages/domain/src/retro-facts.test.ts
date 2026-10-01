import { describe, expect, it } from 'vitest';
import { setEstimate } from './estimate';
import type { Occurrence } from './occurrence';
import { carryCount, criterionResult, retroFacts } from './retro-facts';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import type { ActualTime, DailySelection, Sprint, SprintTask } from './sprint';
import { updateTask } from './task';
import {
  ctx,
  newTask,
  research,
  researchId,
  sprintFixture,
  unwrap,
  work,
  workId,
} from './testing';

const d = localDate;
const snapshot = (lo: number, hi: number) => ({
  value: {
    base: 'suggestion' as const,
    lo,
    hi,
    criterionApplied: false,
    computedAt: ctx.now,
  },
  timeBasis: 'task' as const,
});

function st(taskId: string, extra: Partial<SprintTask> = {}): SprintTask {
  return {
    id: id(`st-${taskId}`),
    taskId: id(taskId),
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: 'planned',
    planSnapshot: snapshot(2, 3),
    ...extra,
  };
}

function occurrence(
  oid: string,
  state: Occurrence['state'],
  date: string,
): Occurrence {
  return {
    id: id(oid),
    taskId: id('task-clean'),
    ruleId: id('rule-1'),
    scheduledDate: d(date),
    ruleVersion: 1,
    materializedAt: ctx.now,
    state,
    stateChangedAt: ctx.now,
  };
}

function selection(
  sid: string,
  stId: string,
  date: string,
  resolution: DailySelection['resolution'],
): DailySelection {
  return {
    id: id(sid),
    date: d(date),
    sprintTaskId: id(stId),
    origin: 'manual',
    resolution,
    selectedAt: ctx.now,
  };
}

function reviewSprint(): Sprint {
  return sprintFixture('2026-09-28', 'review', {
    plannedAvailableHours: 18,
    availableHours: 15,
    goals: [
      {
        areaId: researchId,
        text: '2 本だけ読む',
        plannedText: '3 本読む',
        selfAssessment: 'partly',
      },
    ],
    areaSnapshot: [
      { areaId: workId, name: '仕事', order: 0 },
      { areaId: researchId, name: '研究', order: 1 },
    ],
    tasks: [
      st('task-paper', {
        outcome: 'carriedOver',
        planSnapshot: snapshot(5, 5),
      }),
      st('task-done', { outcome: 'done' }),
      st('task-interview', {
        origin: 'midSprint',
        goalLink: 'unlinked',
        outcome: 'done',
        planSnapshot: snapshot(2, 3),
      }),
      st('task-removed', { outcome: 'removed' }),
      st('task-clean', {
        goalLink: 'unlinked',
        outcome: 'done',
        occurrenceIds: [id('occ-1'), id('occ-2'), id('occ-3')],
        planSnapshot: snapshot(3, 3),
      }),
    ],
    dailySelections: [
      selection('s1', 'st-task-paper', '2026-09-28', 'deferred'),
      selection('s2', 'st-task-paper', '2026-09-29', 'deferred'),
      selection('s3', 'st-task-paper', '2026-09-30', 'paused'),
    ],
    actualTimes: [
      {
        sprintTaskId: id('st-task-paper'),
        hours: 4.5,
        date: d('2026-09-30'),
        via: 'pause',
        recordedAt: ctx.now,
      },
    ],
    interrupts: [
      { id: id('int-1'), at: ctx.now, text: '急な会議', minutes: 30 },
    ],
  });
}

const occurrences = [
  occurrence('occ-1', 'done', '2026-09-29'),
  occurrence('occ-2', 'skipped', '2026-10-01'),
  occurrence('occ-3', 'missed', '2026-10-03'),
  occurrence('occ-x', 'excluded', '2026-10-04'), // left out in Planning (F2)
];

function tasks() {
  return [
    unwrap(
      updateTask(
        newTask('関連論文を 3 本読む', 'task-paper'),
        { areaId: researchId },
        ctx,
      ),
    ),
    unwrap(
      updateTask(
        newTask('発表の準備', 'task-done'),
        { areaId: researchId },
        ctx,
      ),
    ),
    unwrap(
      updateTask(
        newTask('顧客インタビューの設計', 'task-interview'),
        { areaId: workId },
        ctx,
      ),
    ),
    newTask('外した', 'task-removed'),
    newTask('部屋の掃除', 'task-clean'),
  ];
}

describe('retroFacts', () => {
  it('derives the week’s facts from the records', () => {
    const facts = retroFacts(reviewSprint(), {
      tasks: tasks(),
      areas: [research, work],
      occurrences,
      sprints: [],
    });
    expect(facts.carriedOver.map((f) => f.taskId)).toEqual(['task-paper']);
    expect(facts.completed.map((f) => f.taskId)).toEqual([
      'task-done',
      'task-interview',
    ]);
    expect(facts.removed.map((f) => f.taskId)).toEqual(['task-removed']);
    expect(facts.midSprint.map((f) => f.taskId)).toEqual(['task-interview']);
    expect(facts.interrupts).toHaveLength(1);
    expect(facts.availableHours).toEqual({ planned: 18, current: 15 });
    expect(facts.actualHours).toBe(4.5);
    // Scenario A's line: 持ち越し、計画値 5h · 実績 4.5h、2回続けて見送り、今日はここまで.
    const paper = facts.tasks.find((f) => f.taskId === 'task-paper');
    expect(paper).toMatchObject({
      outcome: 'carriedOver',
      plan: { value: { lo: 5, hi: 5 } },
      actualHours: 4.5,
      deferredDates: ['2026-09-28', '2026-09-29'],
      longestDeferralRun: ['2026-09-28', '2026-09-29'],
      pausedDates: ['2026-09-30'],
    });
    // Totals: confirmed plan vs with the mid-Sprint addition (removed ones out).
    // Confirmed plan: paper 5 + done 2–3 + removed 2–3 + clean 3 (the
    // removed one was in the plan at confirm).
    expect(facts.plannedTotal.atConfirm).toMatchObject({ lo: 12, hi: 14 });
    expect(facts.plannedTotal.withAdditions).toMatchObject({ lo: 12, hi: 14 });
  });

  it('per Area: Goal (planned vs now, the person’s judgement), linked and unlinked Tasks', () => {
    const facts = retroFacts(reviewSprint(), {
      tasks: tasks(),
      areas: [research, work],
      occurrences,
      sprints: [],
    });
    const researchFacts = facts.areas.find((a) => a.areaId === researchId);
    expect(researchFacts).toMatchObject({
      name: '研究',
      goal: {
        text: '2 本だけ読む',
        plannedText: '3 本読む',
        changedSinceConfirm: true,
        selfAssessment: 'partly',
      },
    });
    expect(researchFacts?.linked.map((f) => f.taskId)).toEqual([
      'task-paper',
      'task-done',
    ]);
    const work_ = facts.areas.find((a) => a.areaId === workId);
    expect(work_?.unlinked.map((f) => f.taskId)).toEqual(['task-interview']);
  });

  it('F2: occurrences left out in Planning do not appear', () => {
    const facts = retroFacts(reviewSprint(), {
      tasks: tasks(),
      areas: [],
      occurrences,
      sprints: [],
    });
    expect(facts.occurrences.done.map((o) => o.id)).toEqual(['occ-1']);
    expect(facts.occurrences.skipped.map((o) => o.id)).toEqual(['occ-2']);
    expect(facts.occurrences.missed.map((o) => o.id)).toEqual(['occ-3']);
    const all = [
      ...facts.occurrences.done,
      ...facts.occurrences.skipped,
      ...facts.occurrences.missed,
    ];
    expect(all.some((o) => o.id === 'occ-x')).toBe(false);
  });

  it('invariant 40: derived without changing any record, and without any score', () => {
    const sprint = reviewSprint();
    const before = JSON.stringify({ sprint, occurrences });
    const facts = retroFacts(sprint, {
      tasks: tasks(),
      areas: [research, work],
      occurrences,
      sprints: [],
    });
    expect(JSON.stringify({ sprint, occurrences })).toBe(before);
    expect(JSON.stringify(facts)).not.toMatch(/score|rate|productivity/i);
  });

  it('持ち越し回数 follows the carriedFrom chain across Sprints', () => {
    const s1 = sprintFixture('2026-09-14', 'closed', {
      tasks: [st('a', { id: id('st-1'), outcome: 'carriedOver' })],
    });
    const s2 = sprintFixture('2026-09-21', 'closed', {
      tasks: [
        st('a', {
          id: id('st-2'),
          outcome: 'carriedOver',
          carriedFrom: id('st-1'),
        }),
      ],
    });
    const now = st('a', { id: id('st-3'), carriedFrom: id('st-2') });
    expect(carryCount(now, [s1, s2])).toBe(2);
    expect(carryCount(st('b'), [s1, s2])).toBe(0);
  });
});

describe('retroFacts — fixes from acceptance (#24)', () => {
  it('F17: a deferral completed the same day breaks the longest run, as in Today', () => {
    const sprint = sprintFixture('2026-09-28', 'review', {
      tasks: [st('task-paper')],
      dailySelections: [
        selection('a', 'st-task-paper', '2026-09-28', 'deferred'),
        {
          ...selection('b', 'st-task-paper', '2026-09-29', 'done'),
          closedBefore: { resolution: 'deferred', at: ctx.now },
        },
        selection('c', 'st-task-paper', '2026-09-30', 'deferred'),
      ],
    });
    const fact = retroFacts(sprint, {
      tasks: tasks(),
      areas: [],
      occurrences: [],
      sprints: [],
    }).tasks[0];
    expect(fact?.deferredDates).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
    expect(fact?.longestDeferralRun).toEqual(['2026-09-28']);
  });

  it('F24: occurrences done or skipped before their Task was removed stay facts', () => {
    const sprint = sprintFixture('2026-09-28', 'review', {
      tasks: [
        st('task-clean', {
          outcome: 'removed',
          goalLink: 'unlinked',
          occurrenceIds: [id('occ-1'), id('occ-2'), id('occ-x')],
        }),
      ],
    });
    const facts = retroFacts(sprint, {
      tasks: tasks(),
      areas: [],
      occurrences: [
        occurrence('occ-1', 'done', '2026-09-29'),
        occurrence('occ-2', 'skipped', '2026-10-01'),
        occurrence('occ-x', 'excluded', '2026-10-03'), // left out at removal (F14)
      ],
      sprints: [],
    });
    expect(facts.occurrences.done.map((o) => o.id)).toEqual(['occ-1']);
    expect(facts.occurrences.skipped.map((o) => o.id)).toEqual(['occ-2']);
    expect(facts.occurrences.missed).toEqual([]);
  });

  it('lists Areas in the Sprint’s order, Tasks without an Area last', () => {
    const facts = retroFacts(reviewSprint(), {
      tasks: tasks(),
      areas: [research, work],
      occurrences,
      sprints: [],
    });
    expect(facts.areas.map((a) => a.areaId)).toEqual([
      workId,
      researchId,
      null,
    ]);
  });
});

describe('criterionResult', () => {
  const applied = (lo: number, hi: number) => ({
    value: {
      base: 'suggestion' as const,
      lo,
      hi,
      criterionApplied: true,
      computedAt: ctx.now,
    },
    timeBasis: 'task' as const,
  });

  function facts(tasks: SprintTask[]) {
    const sprint = sprintFixture('2026-09-28', 'review', {
      tasks,
      actualTimes: [
        {
          sprintTaskId: id('st-a'),
          hours: 4.5,
          date: d('2026-09-30'),
          via: 'pause',
          recordedAt: ctx.now,
        },
      ],
    });
    return retroFacts(sprint, {
      tasks: [newTask('a'), newTask('b'), newTask('c'), newTask('r')],
      areas: [research, work],
      occurrences: [],
      sprints: [sprint],
    });
  }

  it('collects the Tasks the criterion set, and what became of them', () => {
    const result = criterionResult(
      facts([
        st('a', { outcome: 'carriedOver', planSnapshot: applied(5, 5) }),
        st('b', { outcome: 'done', planSnapshot: applied(3, 3) }),
        st('c', { outcome: 'done' }),
        st('r', { outcome: 'removed', planSnapshot: applied(2, 2) }),
      ]),
    );
    expect(result.tasks.map((t) => t.taskId)).toEqual(['a', 'b']);
    expect(result.carriedOver.map((t) => t.taskId)).toEqual(['a']);
    expect(result.done.map((t) => t.taskId)).toEqual(['b']);
    expect(result.planned).toMatchObject({ lo: 8, hi: 8 });
    expect(result.actualHours).toBe(4.5);
  });

  it('leaves recurring Tasks out: they are counted by occurrence (F20)', () => {
    const result = criterionResult(
      facts([
        st('a', {
          outcome: 'done',
          occurrenceIds: [id('occ-1')],
          planSnapshot: applied(1, 1),
        }),
        st('b', { outcome: 'done', planSnapshot: applied(3, 3) }),
      ]),
    );
    expect(result.tasks.map((t) => t.taskId)).toEqual(['b']);
    expect(result.done.map((t) => t.taskId)).toEqual(['b']);
  });

  it('is empty when the criterion set no value', () => {
    const result = criterionResult(facts([st('c', { outcome: 'done' })]));
    expect(result.tasks).toEqual([]);
    expect(result.actualHours).toBe(0);
  });
});

describe('retroFacts — occurrences as facts (#56)', () => {
  it('gives each occurrence its SprintTask, actual time and the day it was done', () => {
    const base = reviewSprint();
    const sprint: Sprint = {
      ...base,
      // Done a day early (F18), with 30 minutes recorded.
      dailySelections: [
        ...base.dailySelections,
        {
          ...selection('s-occ', 'st-task-clean', '2026-09-28', 'done'),
          occurrenceId: id('occ-1'),
        },
      ],
      actualTimes: [
        ...base.actualTimes,
        {
          sprintTaskId: id('st-task-clean'),
          occurrenceId: id('occ-1'),
          hours: 0.5,
          date: d('2026-09-28'),
          via: 'completion',
          recordedAt: ctx.now,
        },
      ],
    };
    const facts = retroFacts(sprint, {
      tasks: tasks(),
      areas: [research, work],
      occurrences,
      sprints: [sprint],
    });
    const all = facts.occurrences.all;
    // Excluded ones stay out (F2).
    expect(all.map((f) => f.occurrence.id)).toEqual([
      'occ-1',
      'occ-2',
      'occ-3',
    ]);
    expect(all[0]).toMatchObject({
      sprintTaskId: 'st-task-clean',
      actualHours: 0.5,
      doneOn: '2026-09-28',
    });
    expect(all[1]?.doneOn).toBeUndefined();
    expect(all[1]?.actualHours).toBe(0);
  });
});

describe('retroFacts — the plan against what happened (#167)', () => {
  const input = () => ({
    tasks: tasks(),
    areas: [research, work],
    occurrences,
    sprints: [],
  });

  it('invariant 40: the interrupts’ minutes are summed apart from the actual time', () => {
    const sprint: Sprint = {
      ...reviewSprint(),
      interrupts: [
        { id: id('int-1'), at: ctx.now, text: '障害の問い合わせ', minutes: 45 },
        { id: id('int-2'), at: ctx.now, text: 'レビュー依頼', minutes: 20 },
        { id: id('int-3'), at: ctx.now, text: '電話' },
      ],
    };
    const facts = retroFacts(sprint, input());
    expect(facts.interruptTime).toEqual({ minutes: 65, withoutMinutes: 1 });
    // The actual time is the Tasks' only.
    expect(facts.actualHours).toBe(4.5);
  });

  it('invariant 15: compares the planned total, with the mid-Sprint additions, with the hours entered when planning', () => {
    // 12–14h against 18h planned (15h now): the upper end fits.
    expect(retroFacts(reviewSprint(), input()).capacity).toEqual({
      availableHours: 18,
      remaining: { lo: 4, hi: 6 },
      status: 'within',
    });
    // The mid-Sprint addition counts (invariant 15): 12–14h against 11h.
    const over = retroFacts(
      { ...reviewSprint(), plannedAvailableHours: 11 },
      input(),
    );
    expect(over.capacity?.status).toBe('exceeds');
    // No hours entered when planning: nothing to compare with.
    const none = retroFacts(
      sprintFixture('2026-09-28', 'review', { tasks: reviewSprint().tasks }),
      input(),
    );
    expect(none.capacity).toBeUndefined();
  });

  it('each Task’s actual time against its planning value, only when both are there', () => {
    const sprint = reviewSprint();
    const facts = retroFacts(
      {
        ...sprint,
        actualTimes: [
          ...sprint.actualTimes,
          {
            sprintTaskId: id('st-task-done'),
            hours: 3.5,
            date: d('2026-09-30'),
            via: 'later',
            recordedAt: ctx.now,
          },
        ],
      },
      input(),
    );
    const of = (taskId: string) =>
      facts.tasks.find((f) => f.taskId === taskId)?.actualVsPlan;
    // 4.5h against 5h.
    expect(of('task-paper')).toEqual({ lo: -0.5, hi: -0.5 });
    // 3.5h against 2–3h: 0.5h over the upper end, 1.5h over the lower.
    expect(of('task-done')).toEqual({ lo: 0.5, hi: 1.5 });
    // No actual time entered: no difference.
    expect(of('task-interview')).toBeUndefined();
  });

  it('below a range, and nothing against an unestimated value', () => {
    const sprint = reviewSprint();
    const actual = (sprintTaskId: string, hours: number): ActualTime => ({
      sprintTaskId: id(sprintTaskId),
      hours,
      date: d('2026-09-30'),
      via: 'later',
      recordedAt: ctx.now,
    });
    const facts = retroFacts(
      {
        ...sprint,
        tasks: sprint.tasks.map((t) =>
          t.taskId === 'task-interview'
            ? {
                ...t,
                planSnapshot: {
                  value: {
                    base: 'none' as const,
                    criterionApplied: false as const,
                    computedAt: ctx.now,
                  },
                  timeBasis: 'task' as const,
                },
              }
            : t,
        ),
        actualTimes: [
          actual('st-task-done', 1.5),
          actual('st-task-interview', 2),
        ],
      },
      input(),
    );
    const of = (taskId: string) =>
      facts.tasks.find((f) => f.taskId === taskId)?.actualVsPlan;
    // 1.5h against 2–3h: 0.5h under the lower end.
    expect(of('task-done')).toEqual({ lo: -1.5, hi: -0.5 });
    expect(of('task-interview')).toBeUndefined();
  });

  it('invariant 16: the difference is against the plan fixed at confirm, not the Estimate now', () => {
    const changed = input().tasks.map((t) =>
      t.id === 'task-paper' ? unwrap(setEstimate(t, 8, ctx)) : t,
    );
    const paper = retroFacts(reviewSprint(), {
      ...input(),
      tasks: changed,
    }).tasks.find((f) => f.taskId === 'task-paper');
    expect(paper?.estimateNow).toBe(8);
    // Still 4.5h against the 5h fixed in the plan.
    expect(paper?.actualVsPlan).toEqual({ lo: -0.5, hi: -0.5 });
  });
});
