// Scenario A of docs/domain/domain-model.md (関連論文を 3 本読む), steps 3–5:
// Planning, the research Goal, and confirming with the criterion
// 「研究の推定幅 → 上限」 applied. Sprint 9/28 (Mon) – 10/4 (Sun); the
// previous Sprint (9/21–9/27) is closed.
import { describe, expect, it } from 'vitest';
import { renameArea } from './area';
import { presentSuggestion } from './estimate';
import {
  carryOverCandidates,
  confirmSprint,
  selectTask,
  setAvailableHours,
  setGoalText,
  startPlanning,
  type ActiveCriterion,
} from './planning';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import { retroFacts } from './retro-facts';
import {
  completeRetro,
  decideCriterion,
  enterReview,
  pinFact,
  previousImprovement,
  setImprovement,
  setReflection,
} from './review';
import { sprintAreaName } from './sprint';
import {
  deferSelection,
  pauseSelection,
  selectForToday,
  startDay,
  startSelection,
} from './today';
import { deferralStreak, yesterdaysContinuation } from './today-view';
import { createTask, updateTask } from './task';
import {
  at,
  ids,
  research,
  researchId,
  sprintFixture,
  unwrap,
  user,
  userId,
  work,
} from './testing';

describe('Scenario A — 関連論文を 3 本読む（Planning と確定）', () => {
  it('plans 5h from the 3–5h suggestion without touching the Estimate', () => {
    const criterion: ActiveCriterion = {
      id: id('criterion-research-hi'),
      policy: {
        scope: { kind: 'area', areaId: researchId },
        rangePolicy: 'hi',
      },
    };
    const previous = sprintFixture('2026-09-21', 'closed');

    // 1–2 (before this Issue): the Task, in 研究, with a 3–5h suggestion.
    let task = unwrap(
      createTask(
        {
          id: id('task-paper'),
          userId,
          title: '関連論文を 3 本読む',
          via: 'backlog',
        },
        at('2026-09-26T00:00:00.000Z'),
      ),
    );
    task = unwrap(
      updateTask(task, { areaId: researchId }, at('2026-09-26T00:01:00.000Z')),
    );
    task = unwrap(
      presentSuggestion(
        task,
        {
          id: id('sug-1'),
          lo: 3,
          hi: 5,
          rationale: '1 本 1–1.5h',
          uncertainties: [],
        },
        at('2026-09-26T00:02:00.000Z'),
      ),
    );

    // 3. Planning で選ぶ: SprintTask (draft, planning, linked). Before
    //    confirm, Planning shows the current Area name.
    let sprint = unwrap(
      startPlanning(
        {
          sprintId: id('sprint-2026-09-28'),
          user,
          start: localDate('2026-09-28'),
          sprints: [previous],
          recurring: [],
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st'),
        },
        at('2026-09-27T12:00:00.000Z'),
      ),
    ).sprint;
    sprint = unwrap(
      selectTask(
        sprint,
        { sprintTaskId: id('st-paper'), task },
        at('2026-09-27T12:01:00.000Z'),
      ),
    );
    expect(sprint.tasks[0]).toMatchObject({
      outcome: 'draft',
      origin: 'planning',
      goalLink: 'linked',
    });
    const renamedBefore = unwrap(
      renameArea(research, '研究（仮）', at('2026-09-27T12:02:00.000Z')),
    );
    expect(sprintAreaName(sprint, researchId, [renamedBefore])).toBe(
      '研究（仮）',
    );

    // 4. 研究の Goal を書く. The Task itself does not change.
    const taskBefore = task;
    sprint = unwrap(
      setGoalText(
        sprint,
        { areaId: researchId, text: '先行研究を押さえる' },
        at('2026-09-27T12:03:00.000Z'),
      ),
    );
    expect(task).toBe(taskBefore);

    // 5. 基準を適用して確定 with 18h available.
    sprint = unwrap(
      setAvailableHours(sprint, { hours: 18 }, at('2026-09-27T12:04:00.000Z')),
    );
    const confirmed = confirmSprint(
      sprint,
      {
        sprints: [previous, sprint],
        tasks: [task],
        areas: [research, work],
        criterion,
        applyCriterion: true,
      },
      at('2026-09-27T12:05:00.000Z'),
    );
    sprint = unwrap(confirmed);
    expect(sprint).toMatchObject({
      state: 'active',
      criterionUse: {
        criterionId: 'criterion-research-hi',
        appliedAtConfirm: true,
      },
      plannedAvailableHours: 18,
      goals: [{ areaId: researchId, plannedText: '先行研究を押さえる' }],
    });
    expect(sprint.tasks[0]).toMatchObject({
      outcome: 'planned',
      goalLink: 'linked',
      planSnapshot: {
        // 「Estimate 提案 3–5h / 今回は 5h で計画」
        value: { base: 'suggestion', lo: 5, hi: 5, criterionApplied: true },
        suggestion: { lo: 3, hi: 5 },
      },
    });
    expect(sprint.tasks[0]?.planSnapshot).not.toHaveProperty('estimateHours');
    // The suggestion was not adopted, so the Estimate stays empty.
    expect(task).not.toHaveProperty('estimate');

    // From here the Sprint's screens use 「研究」, whatever the Area is renamed to.
    const renamedAfter = unwrap(
      renameArea(research, '研究・論文', at('2026-09-29T00:00:00.000Z')),
    );
    expect(sprintAreaName(sprint, researchId, [renamedAfter])).toBe('研究');

    // --- Today (steps 6–12, #23) ---
    const system = (iso: string) => ({ ...at(iso), actor: 'system' as const });
    const day = (date: string, iso: string) =>
      unwrap(
        startDay(
          sprint,
          {
            today: localDate(date),
            occurrences: [],
            newSelectionId: ids('sys'),
          },
          system(iso),
        ),
      );
    const pick = (selId: string, date: string, iso: string) =>
      unwrap(
        selectForToday(
          sprint,
          {
            selectionId: id(selId),
            date: localDate(date),
            sprintTaskId: id('st-paper'),
          },
          at(iso),
        ),
      );

    // 6–7. 9/28 (Mon): 今日へ, then 今日は見送る. The SprintTask stays planned.
    sprint = day('2026-09-28', '2026-09-27T15:00:00.000Z');
    sprint = pick('sel-0928', '2026-09-28', '2026-09-28T00:00:00.000Z');
    sprint = unwrap(
      deferSelection(
        sprint,
        { selectionId: id('sel-0928') },
        at('2026-09-28T09:00:00.000Z'),
      ),
    );
    expect(sprint.tasks[0]?.outcome).toBe('planned');

    // 8. 9/29 (Tue): chosen again (a new DailySelection) and deferred → 「2回続けて見送り」.
    sprint = day('2026-09-29', '2026-09-28T15:00:00.000Z');
    sprint = pick('sel-0929', '2026-09-29', '2026-09-29T00:00:00.000Z');
    sprint = unwrap(
      deferSelection(
        sprint,
        { selectionId: id('sel-0929') },
        at('2026-09-29T09:00:00.000Z'),
      ),
    );
    expect(deferralStreak([previous, sprint], task.id)).toBe(2);

    // 9–10. 9/30 (Wed): start, 4.5h, 今日はここまで. Still planned; the run is broken.
    sprint = day('2026-09-30', '2026-09-29T15:00:00.000Z');
    sprint = pick('sel-0930', '2026-09-30', '2026-09-30T00:00:00.000Z');
    sprint = unwrap(
      startSelection(
        sprint,
        { selectionId: id('sel-0930') },
        at('2026-09-30T00:10:00.000Z'),
      ),
    );
    sprint = unwrap(
      pauseSelection(
        sprint,
        { selectionId: id('sel-0930'), actualHours: 4.5 },
        at('2026-09-30T05:00:00.000Z'),
      ),
    );
    expect(sprint.tasks[0]?.outcome).toBe('planned');
    expect(sprint.actualTimes).toMatchObject([
      {
        sprintTaskId: 'st-paper',
        hours: 4.5,
        date: '2026-09-30',
        via: 'pause',
      },
    ]);
    expect(deferralStreak([previous, sprint], task.id)).toBe(0);

    // 11. 10/1 (Thu) morning: no DailySelection is made; 「昨日の続き」 on top.
    sprint = day('2026-10-01', '2026-09-30T15:00:00.000Z');
    expect(
      sprint.dailySelections.filter((s) => s.date === '2026-10-01'),
    ).toEqual([]);
    expect(
      yesterdaysContinuation(
        sprint,
        [previous, sprint],
        localDate('2026-10-01'),
      ).map((c) => c.sprintTask.id),
    ).toEqual(['st-paper']);

    // 12. 10/2–10/4: not chosen. No DailySelection, no effect on the run,
    //     and no 「昨日の続き」 without a pause the day before.
    for (const [date, iso] of [
      ['2026-10-02', '2026-10-01T15:00:00.000Z'],
      ['2026-10-03', '2026-10-02T15:00:00.000Z'],
      ['2026-10-04', '2026-10-03T15:00:00.000Z'],
    ] as const) {
      sprint = day(date, iso);
      expect(
        yesterdaysContinuation(sprint, [previous, sprint], localDate(date)),
      ).toEqual([]);
    }
    expect(sprint.dailySelections.map((s) => [s.date, s.resolution])).toEqual([
      ['2026-09-28', 'deferred'],
      ['2026-09-29', 'deferred'],
      ['2026-09-30', 'paused'],
    ]);
    expect(deferralStreak([previous, sprint], task.id)).toBe(0);

    // --- Review, Retro and the next Planning (steps 13–15, #24) ---
    // 13. 10/5: the system moves the Sprint to Review; the Task is carried
    //     over and stays active in the Backlog.
    const reviewed = unwrap(
      enterReview(
        sprint,
        { today: localDate('2026-10-05'), occurrences: [] },
        { ...at('2026-10-04T15:00:00.000Z'), actor: 'system' },
      ),
    );
    sprint = reviewed.sprint;
    expect(sprint.state).toBe('review');
    expect(sprint.tasks[0]?.outcome).toBe('carriedOver');
    expect(task.lifecycle).toBe('active');
    // Retro facts: 持ち越し、提案 3–5h · 計画値 5h · 実績 4.5h、2回続けて見送り
    // （9/28・9/29）、9/30 は「今日はここまで」.
    const facts = retroFacts(sprint, {
      tasks: [task],
      areas: [research, work],
      occurrences: [],
      sprints: [previous, sprint],
    });
    expect(facts.carriedOver).toHaveLength(1);
    expect(facts.carriedOver[0]).toMatchObject({
      plan: {
        suggestion: { lo: 3, hi: 5 },
        value: { lo: 5, hi: 5, criterionApplied: true },
      },
      actualHours: 4.5,
      longestDeferralRun: ['2026-09-28', '2026-09-29'],
      pausedDates: ['2026-09-30'],
    });

    // 14. Retro: 「1 本ずつに分ける」, the criterion continues, Retro complete → Closed.
    const retroAt = at('2026-10-05T01:00:00.000Z');
    sprint = unwrap(
      pinFact(sprint, { pin: { kind: 'sprintTask', id: 'st-paper' } }, retroAt),
    );
    sprint = unwrap(
      setReflection(sprint, { text: '3 本まとめてだと手が止まる' }, retroAt),
    );
    sprint = unwrap(
      setImprovement(sprint, { text: '1 本ずつに分ける' }, retroAt),
    );
    sprint = unwrap(decideCriterion(sprint, { decision: 'continue' }, retroAt));
    const activeCrit = {
      id: criterion.id,
      userId,
      policy: criterion.policy,
      sourceSprintId: previous.id,
      state: 'active' as const,
      createdAt: at('2026-09-27T00:00:00.000Z').now,
    };
    const completed = unwrap(
      completeRetro(sprint, { criteria: [activeCrit] }, retroAt),
    );
    sprint = completed.sprint;
    expect(sprint.state).toBe('closed');
    expect(sprint.retro).toMatchObject({
      pins: [{ kind: 'sprintTask', id: 'st-paper' }],
      reflection: '3 本まとめてだと手が止まる',
      improvement: { text: '1 本ずつに分ける' },
    });
    expect(completed.criteria).toEqual([]); // continues, still active

    // 15. The next Planning: the Task is only a carry-over candidate, the
    //     improvement is shown at the entrance, and choosing it links back.
    const next = unwrap(
      startPlanning(
        {
          sprintId: id('sprint-2026-10-05'),
          user,
          start: localDate('2026-10-05'),
          sprints: [previous, sprint],
          recurring: [],
          occurrences: [],
          newOccurrenceId: ids('occ-n'),
          newSprintTaskId: ids('st-n'),
        },
        at('2026-10-05T02:00:00.000Z'),
      ),
    ).sprint;
    expect(next.tasks).toEqual([]);
    expect(previousImprovement(next, [previous, sprint, next])?.text).toBe(
      '1 本ずつに分ける',
    );
    const [candidate] = carryOverCandidates(sprint, next, [task]);
    expect(candidate?.taskId).toBe(task.id);
    const chosen = unwrap(
      selectTask(
        next,
        {
          sprintTaskId: id('st-paper-2'),
          task,
          ...(candidate === undefined ? {} : { carriedFrom: candidate }),
        },
        at('2026-10-05T02:05:00.000Z'),
      ),
    );
    expect(chosen.tasks[0]).toMatchObject({
      carriedFrom: 'st-paper',
      outcome: 'draft',
    });
    // Splitting the Task is the person's call; nothing splits it automatically.
    expect(chosen.tasks).toHaveLength(1);
    // With the Retro complete, the next Sprint can be confirmed (invariant 12).
    const confirmedNext = unwrap(
      confirmSprint(
        chosen,
        {
          sprints: [previous, sprint, chosen],
          tasks: [task],
          areas: [research, work],
          criterion,
          applyCriterion: true,
        },
        at('2026-10-05T02:10:00.000Z'),
      ),
    );
    expect(confirmedNext.state).toBe('active');
  });
});
