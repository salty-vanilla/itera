import { describe, expect, it } from 'vitest';
import type { Occurrence } from './occurrence';
import { carryCount, retroFacts } from './retro-facts';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import type { DailySelection, Sprint, SprintTask } from './sprint';
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
