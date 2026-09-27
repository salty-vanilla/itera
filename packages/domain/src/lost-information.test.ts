// 「現在状態だけでは失われる情報」 (docs/domain/domain-model.md): each of the
// 20 items, except the Agent's plan proposals (PlanProposal is out of the
// MVP scope), can be read back from the records after a week has run.
import { describe, expect, it } from 'vitest';
import { renameArea } from './area';
import { completeRetro, decideCriterion, enterReview } from './review';
import type { PlanningCriterion } from './criterion';
import { adoptSuggestion, presentSuggestion, setEstimate } from './estimate';
import type { Occurrence } from './occurrence';
import {
  confirmSprint,
  excludeFromPlan,
  selectTask,
  setAvailableHours,
  setGoalText,
  startPlanning,
  type ActiveCriterion,
} from './planning';
import { createRecurrenceRule } from './recurrence';
import { carryCount, retroFacts } from './retro-facts';
import type { Activity } from './shared/activity';
import type { CommandResult } from './shared/command';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import { sprintAreaName, type SprintTask } from './sprint';
import { changeRuleForNextSprint } from './sprint-recurrence';
import { updateTask } from './task';
import {
  addToToday,
  completeSelection,
  deferSelection,
  noteInterrupt,
  pauseSelection,
  removeFromToday,
  selectForToday,
  startDay,
  startSelection,
} from './today';
import { deferralStreak } from './today-view';
import {
  at,
  ids,
  newTask,
  research,
  researchId,
  sprintFixture,
  user,
  userId,
  work,
  workId,
} from './testing';

const d = localDate;

describe('現在状態だけでは失われる情報', () => {
  it('can all be read back from the records', () => {
    const log: Activity[] = [];
    const run = <T>(result: CommandResult<T>): T => {
      if (!result.ok)
        throw new Error(`${result.error.code}: ${result.error.message}`);
      log.push(...result.value.activities);
      return result.value.record;
    };

    // --- Backlog ---
    let paper = run(
      updateTask(
        newTask('関連論文を読む', 'task-paper'),
        { areaId: researchId },
        at('2026-09-20T00:00:00.000Z'),
      ),
    );
    paper = run(
      presentSuggestion(
        paper,
        { id: id('sug-paper'), lo: 3, hi: 5, rationale: '', uncertainties: [] },
        at('2026-09-20T00:01:00.000Z'),
      ),
    );
    let memo = run(
      updateTask(
        newTask('議事録', 'task-memo'),
        { areaId: workId },
        at('2026-09-20T00:02:00.000Z'),
      ),
    );
    memo = run(
      presentSuggestion(
        memo,
        { id: id('sug-memo'), lo: 1, hi: 2, rationale: '', uncertainties: [] },
        at('2026-09-20T00:03:00.000Z'),
      ),
    );
    memo = run(
      adoptSuggestion(
        memo,
        id('sug-memo'),
        'hi',
        at('2026-09-20T00:04:00.000Z'),
      ),
    );
    memo = run(setEstimate(memo, 1.5, at('2026-09-20T00:05:00.000Z')));
    const created = run(
      createRecurrenceRule(
        newTask('部屋の掃除', 'task-clean'),
        {
          id: id('rule-clean'),
          pattern: { freq: 'weekly', daysOfWeek: [6, 0] },
          effectiveFrom: d('2026-09-28'),
        },
        at('2026-09-20T00:06:00.000Z'),
      ),
    );
    let rule = created.rule;
    const clean = created.task;

    // --- Previous Sprint: paper was carried over ---
    const carried: SprintTask = {
      id: id('st-paper-old'),
      taskId: paper.id,
      origin: 'planning',
      addedAt: at('2026-09-21T00:00:00.000Z').now,
      goalLink: 'linked',
      outcome: 'carriedOver',
    };
    const previous = sprintFixture('2026-09-21', 'closed', {
      tasks: [carried],
    });

    // --- Planning ---
    const criterion: ActiveCriterion = {
      id: id('crit-1'),
      policy: {
        scope: { kind: 'area', areaId: researchId },
        rangePolicy: 'hi',
      },
    };
    const planned = run(
      startPlanning(
        {
          sprintId: id('sprint-2026-09-28'),
          user,
          start: d('2026-09-28'),
          sprints: [previous],
          recurring: [{ task: clean, rule }],
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st-rec'),
        },
        at('2026-09-27T12:00:00.000Z'),
      ),
    );
    let sprint = planned.sprint;
    let occurrences: Occurrence[] = [...planned.occurrences];
    const sunday = occurrences.find(
      (o) => o.scheduledDate === '2026-10-04',
    ) as Occurrence;
    const excluded = run(
      excludeFromPlan(sprint, sunday, at('2026-09-27T12:01:00.000Z')),
    );
    sprint = excluded.sprint;
    occurrences = occurrences.map((o) =>
      o.id === sunday.id ? excluded.occurrence : o,
    );
    sprint = run(
      selectTask(
        sprint,
        { sprintTaskId: id('st-paper'), task: paper, carriedFrom: carried },
        at('2026-09-27T12:02:00.000Z'),
      ),
    );
    sprint = run(
      setGoalText(
        sprint,
        { areaId: researchId, text: '3 本読む' },
        at('2026-09-27T12:03:00.000Z'),
      ),
    );
    sprint = run(
      setAvailableHours(sprint, { hours: 18 }, at('2026-09-27T12:04:00.000Z')),
    );
    sprint = run(
      confirmSprint(
        sprint,
        {
          sprints: [previous, sprint],
          tasks: [paper, clean],
          areas: [research, work],
          criterion,
          applyCriterion: true,
        },
        at('2026-09-27T12:05:00.000Z'),
      ),
    );

    // --- During the Sprint ---
    sprint = run(
      setGoalText(
        sprint,
        { areaId: researchId, text: '2 本だけ読む' },
        at('2026-09-29T00:00:00.000Z'),
      ),
    );
    sprint = run(
      setAvailableHours(sprint, { hours: 14 }, at('2026-09-29T00:01:00.000Z')),
    );
    const renamed = run(
      renameArea(research, '研究・論文', at('2026-09-29T00:02:00.000Z')),
    );
    sprint = run(
      addToToday(
        sprint,
        {
          sprintTaskId: id('st-memo'),
          selectionId: id('sel-memo'),
          date: d('2026-09-29'),
          task: memo,
          areas: [research, work],
          via: 'backlogToToday',
          criterion,
        },
        at('2026-09-29T00:03:00.000Z'),
      ),
    );
    sprint = run(
      selectForToday(
        sprint,
        {
          selectionId: id('sel-p1'),
          date: d('2026-09-29'),
          sprintTaskId: id('st-paper'),
        },
        at('2026-09-29T00:04:00.000Z'),
      ),
    );
    sprint = run(
      startSelection(
        sprint,
        { selectionId: id('sel-p1') },
        at('2026-09-29T00:05:00.000Z'),
      ),
    );
    sprint = run(
      pauseSelection(
        sprint,
        { selectionId: id('sel-p1'), actualHours: 2 },
        at('2026-09-29T05:00:00.000Z'),
      ),
    );
    sprint = run(
      selectForToday(
        sprint,
        {
          selectionId: id('sel-p2'),
          date: d('2026-09-30'),
          sprintTaskId: id('st-paper'),
        },
        at('2026-09-30T00:00:00.000Z'),
      ),
    );
    sprint = run(
      deferSelection(
        sprint,
        { selectionId: id('sel-p2') },
        at('2026-09-30T09:00:00.000Z'),
      ),
    );
    // (7 is read here, before the later choices.)
    const streakAfterDeferral = deferralStreak([previous, sprint], paper.id);
    // 10/1: chosen and taken off again (今日から外す). 10/2: chosen and left
    // open; the next day's start marks it unresolved.
    sprint = run(
      selectForToday(
        sprint,
        {
          selectionId: id('sel-p3'),
          date: d('2026-10-01'),
          sprintTaskId: id('st-paper'),
        },
        at('2026-10-01T00:00:00.000Z'),
      ),
    );
    sprint = run(
      removeFromToday(
        sprint,
        { selectionId: id('sel-p3') },
        at('2026-10-01T00:10:00.000Z'),
      ),
    );
    sprint = run(
      selectForToday(
        sprint,
        {
          selectionId: id('sel-p4'),
          date: d('2026-10-02'),
          sprintTaskId: id('st-paper'),
        },
        at('2026-10-02T00:00:00.000Z'),
      ),
    );
    const memoDone = run(
      completeSelection(
        sprint,
        { selectionId: id('sel-memo'), task: memo, today: d('2026-09-29') },
        at('2026-09-29T10:00:00.000Z'),
      ),
    );
    sprint = memoDone.sprint;
    sprint = run(
      noteInterrupt(
        sprint,
        { id: id('int-1'), text: '急な会議', minutes: 30 },
        at('2026-09-30T02:00:00.000Z'),
      ),
    );
    const ruleChange = run(
      changeRuleForNextSprint(
        {
          task: clean,
          rule,
          pattern: { freq: 'weekly', daysOfWeek: [0] },
          user,
          today: d('2026-10-01'),
          sprints: [previous, sprint],
          occurrences,
          newOccurrenceId: ids('occ-x'),
          newSprintTaskId: ids('st-x'),
        },
        at('2026-10-01T00:00:00.000Z'),
      ),
    );
    rule = ruleChange.rule;
    sprint = run(
      startDay(
        sprint,
        { today: d('2026-10-03'), occurrences, newSelectionId: ids('sel-sys') },
        { ...at('2026-10-02T15:00:00.000Z'), actor: 'system' },
      ),
    );
    const saturday = occurrences.find(
      (o) => o.scheduledDate === '2026-10-03',
    ) as Occurrence;
    const cleaned = run(
      completeSelection(
        sprint,
        {
          selectionId: id('sel-sys-1'),
          occurrence: saturday,
          today: d('2026-10-03'),
        },
        at('2026-10-03T01:00:00.000Z'),
      ),
    );
    sprint = cleaned.sprint;
    occurrences = occurrences.map((o) =>
      o.id === saturday.id ? (cleaned.occurrence as Occurrence) : o,
    );

    // --- Review and Retro ---
    const reviewed = run(
      enterReview(
        sprint,
        { today: d('2026-10-05'), occurrences },
        { ...at('2026-10-04T15:00:00.000Z'), actor: 'system' },
      ),
    );
    sprint = reviewed.sprint;
    sprint = run(
      decideCriterion(
        sprint,
        { decision: 'end' },
        at('2026-10-05T01:00:00.000Z'),
      ),
    );
    const activeCrit: PlanningCriterion = {
      id: criterion.id,
      userId,
      policy: criterion.policy,
      sourceSprintId: previous.id,
      state: 'active',
      createdAt: at('2026-09-20T00:00:00.000Z').now,
    };
    const closed = run(
      completeRetro(
        sprint,
        { criteria: [activeCrit] },
        at('2026-10-05T02:00:00.000Z'),
      ),
    );
    sprint = closed.sprint;
    const facts = retroFacts(sprint, {
      tasks: [paper, memoDone.task ?? memo, clean],
      areas: [renamed, work],
      occurrences,
      sprints: [previous, sprint],
    });
    const stPaper = sprint.tasks.find((t) => t.id === 'st-paper') as SprintTask;
    const stMemo = sprint.tasks.find((t) => t.id === 'st-memo') as SprintTask;
    const of = (kind: Activity['kind']) => log.filter((a) => a.kind === kind);

    // 1. Sprint に入れた日時と経路
    expect(stPaper).toMatchObject({
      origin: 'planning',
      addedAt: '2026-09-27T12:02:00.000Z',
    });
    expect(stMemo).toMatchObject({
      origin: 'midSprint',
      addedAt: '2026-09-29T00:03:00.000Z',
    });
    expect(
      of('sprintTaskAdded').map((a) =>
        a.kind === 'sprintTaskAdded' ? a.via : '',
      ),
    ).toEqual(['recurring', 'carryOver', 'backlogToToday']);
    // 2. 計画時（追加時）の Estimate・提案・計画値
    expect(stPaper.planSnapshot).toMatchObject({
      suggestion: { lo: 3, hi: 5 },
      value: { lo: 5, hi: 5 },
    });
    expect(stMemo.planSnapshot).toMatchObject({
      estimateHours: 1.5,
      value: { base: 'estimate', lo: 1.5 },
    });
    // 3. 提案が出ていたことと採否
    expect(memo.suggestions[0]?.state).toBe('adopted');
    expect(paper.suggestions[0]?.state).toBe('presented');
    // 4. Estimate の変更
    expect(
      of('estimateChanged').map((a) =>
        a.kind === 'estimateChanged' ? [a.from, a.to] : [],
      ),
    ).toEqual([
      [null, 2],
      [2, 1.5],
    ]);
    // 5. 今日へ選んだこと / 6. 見送った・外した・ここまでにした・未処理の違い / 8. 開始したこと
    expect(
      sprint.dailySelections.map((s) => [s.date, s.sprintTaskId, s.resolution]),
    ).toEqual([
      ['2026-09-29', 'st-memo', 'done'],
      ['2026-09-29', 'st-paper', 'paused'],
      ['2026-09-30', 'st-paper', 'deferred'],
      ['2026-10-01', 'st-paper', 'removed'],
      ['2026-10-02', 'st-paper', 'unresolved'],
      ['2026-10-03', sprint.tasks[0]?.id, 'done'],
    ]);
    // Unresolved is only ever the system's mark (invariant 24).
    expect(
      log.filter((a) => a.kind === 'todayUnresolved').map((a) => a.actor),
    ).toEqual(['system']);
    expect(sprint.dailySelections[1]?.startedAt).toBe(
      '2026-09-29T00:05:00.000Z',
    );
    // 7. 連続見送りの回数: 1 after 9/30; 外す on 10/1 then breaks the run.
    expect(streakAfterDeferral).toBe(1);
    expect(deferralStreak([previous, sprint], paper.id)).toBe(0);
    // 9. いつ・どの Sprint で・どこから完了したか
    expect(stMemo.outcome).toBe('done');
    expect(sprint.dailySelections[0]).toMatchObject({
      origin: 'midSprint',
      resolution: 'done',
      resolvedAt: '2026-09-29T10:00:00.000Z',
    });
    // 10. 未完了のまま使った時間
    expect(sprint.actualTimes).toMatchObject([
      { sprintTaskId: 'st-paper', hours: 2, via: 'pause' },
    ]);
    // 11. 持ち越しの回数
    expect(stPaper.outcome).toBe('carriedOver');
    expect(carryCount(stPaper, [previous, sprint])).toBe(1);
    // 12. 繰り返しの過去の回 / 13. 今週は計画しなかった回
    expect(occurrences.map((o) => [o.scheduledDate, o.state])).toEqual([
      ['2026-10-03', 'done'],
      ['2026-10-04', 'excluded'],
    ]);
    expect(facts.occurrences.done.map((o) => o.scheduledDate)).toEqual([
      '2026-10-03',
    ]);
    // 14. ルール変更前の回の意味
    expect(occurrences[0]?.ruleVersion).toBe(1);
    expect(rule.versions.map((v) => v.version)).toEqual([1, 2]);
    // 15. Goal の文 / 16. 可用時間
    expect(sprint.goals[0]).toMatchObject({
      text: '2 本だけ読む',
      plannedText: '3 本読む',
    });
    expect(sprint).toMatchObject({
      plannedAvailableHours: 18,
      availableHours: 14,
    });
    expect(of('goalTextChanged')).toHaveLength(2);
    expect(of('availableHoursChanged')).toHaveLength(2);
    // 17. Area の名前
    expect(sprintAreaName(sprint, researchId, [renamed])).toBe('研究');
    // 18. 計画基準を適用したか / 19. 基準の継続・終了・置換
    expect(sprint.criterionUse).toEqual({
      criterionId: 'crit-1',
      appliedAtConfirm: true,
      retroDecision: 'end',
    });
    expect(closed.criteria).toEqual([{ ...activeCrit, state: 'ended' }]);
    // 20. 割り込み（Agent 案の採否は PlanProposal なので対象外）
    expect(facts.interrupts).toMatchObject([{ text: '急な会議', minutes: 30 }]);
    expect(of('interruptNoted')).toHaveLength(1);
  });
});
