// Scenario A of docs/domain/domain-model.md (関連論文を 3 本読む), steps 3–5:
// Planning, the research Goal, and confirming with the criterion
// 「研究の推定幅 → 上限」 applied. Sprint 9/28 (Mon) – 10/4 (Sun); the
// previous Sprint (9/21–9/27) is closed.
import { describe, expect, it } from 'vitest';
import { renameArea } from './area';
import { presentSuggestion } from './estimate';
import {
  confirmSprint,
  selectTask,
  setAvailableHours,
  setGoalText,
  startPlanning,
  type ActiveCriterion,
} from './planning';
import { id } from './shared/ids';
import { localDate } from './shared/time';
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
      ).map((t) => t.id),
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
  });
});
