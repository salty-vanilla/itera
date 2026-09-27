// Scenario C of docs/domain/domain-model.md (部屋の掃除, weekly). Sprints
// are Monday–Sunday weeks of 2026. The first test follows the rule and its
// occurrences alone (steps 1–5, 8; #21); the second runs steps 6–9 with
// Sprint records (#22); the third runs steps 2–3 through Today (#23). Closing a Sprint comes with #24, so closed Sprints
// are fixtures here.
import { describe, expect, it } from 'vitest';
import {
  completeOccurrence,
  excludeOccurrence,
  generateOccurrences,
  skipOccurrence,
  type Occurrence,
} from './occurrence';
import {
  changeRecurrenceRule,
  createRecurrenceRule,
  nextOccurrence,
  recurrenceSummary,
  type RecurrenceRule,
} from './recurrence';
import { id } from './shared/ids';
import { addDays, localDate } from './shared/time';
import { confirmSprint, excludeFromPlan, startPlanning } from './planning';
import { projectFrom, type Sprint } from './sprint';
import { retroFacts } from './retro-facts';
import { changeRuleForNextSprint } from './sprint-recurrence';
import { completeSelection, skipSelection, startDay } from './today';
import { at, ids, newTask, sprintFixture, unwrap, user } from './testing';

const d = localDate;
const saturday = { freq: 'weekly', daysOfWeek: [6] } as const;
const sunday = { freq: 'weekly', daysOfWeek: [0] } as const;

describe('Scenario C — 部屋の掃除（毎週の繰り返し）', () => {
  it('keeps each occurrence on the rule version it was generated with', () => {
    let n = 0;
    const newOccurrenceId = () => id<'Occurrence'>(`occ-${++n}`);
    let occurrences: Occurrence[] = [];

    const plan = (rule: RecurrenceRule, start: string, when: string) => {
      const generated = unwrap(
        generateOccurrences(
          rule,
          {
            start: d(start),
            end: addDays(d(start), 6),
            existing: occurrences,
            newOccurrenceId,
          },
          at(when),
        ),
      );
      occurrences = [...occurrences, ...generated];
      return generated;
    };
    const update = (next: Occurrence) => {
      occurrences = occurrences.map((o) => (o.id === next.id ? next : o));
    };
    const byDate = (date: string) => {
      const found = occurrences.find((o) => o.scheduledDate === date);
      if (found === undefined) throw new Error(`no occurrence on ${date}`);
      return found;
    };

    // 1. Created on Sunday 8/2 as 毎週 土, taking effect from the 8/3 week.
    //    No occurrence yet; Backlog shows 「毎週 土 · 次は 8/8 (土)」.
    let rule = unwrap(
      createRecurrenceRule(
        newTask('部屋の掃除'),
        { id: id('rule-1'), pattern: saturday, effectiveFrom: d('2026-08-03') },
        at('2026-08-02T00:00:00.000Z'),
      ),
    ).rule;
    expect(occurrences).toEqual([]);
    expect(
      recurrenceSummary(rule, occurrences, {
        today: d('2026-08-02'),
        projectFrom: d('2026-08-02'),
      }),
    ).toEqual({
      pattern: saturday,
      next: { scheduledDate: '2026-08-08', ruleVersion: 1, generated: false },
    });

    // 2. The 8/3 and 8/10 weeks generate 8/8 and 8/15; both are done.
    for (const [start, day] of [
      ['2026-08-03', '2026-08-08'],
      ['2026-08-10', '2026-08-15'],
    ] as const) {
      const [occurrence] = plan(rule, start, `${start}T00:00:00.000Z`);
      expect(occurrence).toMatchObject({ scheduledDate: day, ruleVersion: 1 });
      update(
        unwrap(completeOccurrence(byDate(day), at(`${day}T01:00:00.000Z`))),
      );
    }

    // 3. The 8/17 week's 8/22 is skipped. The rule does not change.
    plan(rule, '2026-08-17', '2026-08-17T00:00:00.000Z');
    const ruleBeforeSkip = rule;
    update(
      unwrap(
        skipOccurrence(byDate('2026-08-22'), at('2026-08-22T01:00:00.000Z')),
      ),
    );
    expect(rule).toBe(ruleBeforeSkip);

    // 4. On 8/24, before that week's Planning, change to 毎週 日.
    //    The next unconfirmed Sprint is the 8/24 week.
    const change = changeRecurrenceRule(
      rule,
      { pattern: sunday, effectiveFrom: d('2026-08-24') },
      at('2026-08-24T00:00:00.000Z'),
    );
    rule = unwrap(change);
    expect(change.ok && change.value.activities[0]?.kind).toBe(
      'recurrenceRuleChanged',
    );
    expect(
      rule.versions.map((v) => [v.version, v.effectiveFrom, v.effectiveTo]),
    ).toEqual([
      [1, '2026-08-03', '2026-08-23'],
      [2, '2026-08-24', undefined],
    ]);

    // 5. The past occurrences stay on v1 (Saturdays).
    expect(
      occurrences.map((o) => [o.scheduledDate, o.ruleVersion, o.state]),
    ).toEqual([
      ['2026-08-08', 1, 'done'],
      ['2026-08-15', 1, 'done'],
      ['2026-08-22', 1, 'skipped'],
    ]);

    // (6, 7 — Planning of the 8/24 and 8/31 weeks, set up for step 8.)
    expect(plan(rule, '2026-08-24', '2026-08-24T01:00:00.000Z')).toMatchObject([
      { scheduledDate: '2026-08-30', ruleVersion: 2 },
    ]);
    plan(rule, '2026-08-31', '2026-08-31T00:00:00.000Z');
    update(
      unwrap(
        excludeOccurrence(byDate('2026-09-06'), at('2026-08-31T00:05:00.000Z')),
      ),
    );

    // 8. On Wednesday 9/2, mid-Sprint, change back to 毎週 土 from the next
    //    Sprint (9/7). The current Sprint keeps its occurrences, and no 9/5
    //    (Saturday) occurrence appears. Backlog: 「次の Sprint から反映」
    //    「次は 9/12 (土)」.
    const snapshot = JSON.stringify(occurrences);
    rule = unwrap(
      changeRecurrenceRule(
        rule,
        { pattern: saturday, effectiveFrom: d('2026-09-07') },
        at('2026-09-02T00:00:00.000Z'),
      ),
    );
    expect(JSON.stringify(occurrences)).toBe(snapshot);
    expect(
      rule.versions.map((v) => [v.version, v.effectiveFrom, v.effectiveTo]),
    ).toEqual([
      [1, '2026-08-03', '2026-08-23'],
      [2, '2026-08-24', '2026-09-06'],
      [3, '2026-09-07', undefined],
    ]);
    // Generating the current Sprint (8/31–9/6) again adds nothing: 9/5 is
    // still v2 (Sundays), so no Saturday occurrence appears.
    expect(plan(rule, '2026-08-31', '2026-09-02T00:01:00.000Z')).toEqual([]);
    expect(occurrences.some((o) => o.scheduledDate === '2026-09-05')).toBe(
      false,
    );
    const options = { today: d('2026-09-02'), projectFrom: d('2026-09-07') };
    expect(nextOccurrence(rule, occurrences, options)).toEqual({
      scheduledDate: '2026-09-12',
      ruleVersion: 3,
      generated: false,
    });
    expect(recurrenceSummary(rule, occurrences, options)).toMatchObject({
      pattern: sunday,
      upcoming: { pattern: saturday, effectiveFrom: '2026-09-07' },
    });

    // (9 — the 9/7 week's Planning generates 9/12 on v3.)
    expect(plan(rule, '2026-09-07', '2026-09-07T00:00:00.000Z')).toMatchObject([
      { scheduledDate: '2026-09-12', ruleVersion: 3, state: 'pending' },
    ]);
  });
});

describe('Scenario C — steps 6–9 with Sprint records', () => {
  it('includes the week’s occurrence, excludes one in Planning, and a mid-Sprint change waits', () => {
    const newOccurrenceId = ids<'Occurrence'>('occ');
    const newSprintTaskId = ids<'SprintTask'>('st');
    let occurrences: Occurrence[] = [];
    const replace = (next: Occurrence) => {
      occurrences = occurrences.map((o) => (o.id === next.id ? next : o));
    };
    const task = newTask('部屋の掃除');
    // v1 (Saturdays) → v2 (Sundays from 8/24), as in steps 1–4.
    const created = unwrap(
      createRecurrenceRule(
        task,
        { id: id('rule-1'), pattern: saturday, effectiveFrom: d('2026-08-03') },
        at('2026-08-02T00:00:00.000Z'),
      ),
    );
    let rule = unwrap(
      changeRecurrenceRule(
        created.rule,
        { pattern: sunday, effectiveFrom: d('2026-08-24') },
        at('2026-08-24T00:00:00.000Z'),
      ),
    );
    const recurringTask = created.task;
    const closed = sprintFixture('2026-08-17', 'closed');

    const planWeek = (
      start: string,
      sprints: readonly Sprint[],
      when: string,
    ) => {
      const started = unwrap(
        startPlanning(
          {
            sprintId: id(`sprint-${start}`),
            user,
            start: d(start),
            sprints,
            recurring: [{ task: recurringTask, rule }],
            occurrences,
            newOccurrenceId,
            newSprintTaskId,
          },
          at(when),
        ),
      );
      occurrences = [...occurrences, ...started.occurrences];
      return started;
    };
    const confirm = (
      sprint: Sprint,
      sprints: readonly Sprint[],
      when: string,
    ) =>
      unwrap(
        confirmSprint(
          sprint,
          { sprints, tasks: [recurringTask], areas: [], applyCriterion: false },
          at(when),
        ),
      );

    // 6. The 8/24 week: 8/30 (Sun, v2) is generated and included by
    //    default; after confirm it is planned (Today shows it on 8/30, #23).
    const week24 = planWeek('2026-08-24', [closed], '2026-08-24T01:00:00.000Z');
    expect(week24.occurrences).toMatchObject([
      { scheduledDate: '2026-08-30', ruleVersion: 2, state: 'pending' },
    ]);
    const active24 = confirm(
      week24.sprint,
      [closed, week24.sprint],
      '2026-08-24T02:00:00.000Z',
    );
    expect(active24.tasks).toMatchObject([
      {
        outcome: 'planned',
        goalLink: 'unlinked',
        planSnapshot: { occurrenceCount: 1 },
      },
    ]);

    // 7. The 8/31 week: 9/6 is generated, then left out. The draft
    //    SprintTask disappears before confirm; the occurrence stays excluded.
    const closed24: Sprint = { ...active24, state: 'closed' };
    const week31 = planWeek(
      '2026-08-31',
      [closed, closed24],
      '2026-08-31T00:00:00.000Z',
    );
    const [sep6] = week31.occurrences;
    if (sep6 === undefined) throw new Error('no 9/6');
    const excluded = unwrap(
      excludeFromPlan(week31.sprint, sep6, at('2026-08-31T00:05:00.000Z')),
    );
    replace(excluded.occurrence);
    expect(excluded.sprint.tasks).toEqual([]);
    const active31 = confirm(
      excluded.sprint,
      [closed, closed24, excluded.sprint],
      '2026-08-31T00:10:00.000Z',
    );
    expect(occurrences.find((o) => o.id === sep6.id)?.state).toBe('excluded');
    // F2: the week's Retro facts do not show the excluded 9/6.
    const week31Facts = retroFacts(active31, {
      tasks: [recurringTask],
      areas: [],
      occurrences,
      sprints: [],
    });
    expect(week31Facts.occurrences).toEqual({
      done: [],
      skipped: [],
      missed: [],
    });

    // 8. 9/2 (Wed), mid-Sprint: back to 毎週 土. It waits for the next
    //    Sprint (9/7); the current Sprint and its occurrences stay as they are.
    const before = JSON.stringify({ active31, occurrences });
    const changed = unwrap(
      changeRuleForNextSprint(
        {
          task: recurringTask,
          rule,
          pattern: saturday,
          user,
          today: d('2026-09-02'),
          sprints: [closed, closed24, active31],
          occurrences,
          newOccurrenceId,
          newSprintTaskId,
        },
        at('2026-09-02T00:00:00.000Z'),
      ),
    );
    rule = changed.rule;
    expect(rule.versions.at(-1)).toMatchObject({
      version: 3,
      effectiveFrom: '2026-09-07',
    });
    expect(changed).not.toHaveProperty('sprint');
    expect(JSON.stringify({ active31, occurrences })).toBe(before);
    expect(occurrences.some((o) => o.scheduledDate === '2026-09-05')).toBe(
      false,
    );
    const sprints = [closed, closed24, active31];
    expect(
      nextOccurrence(rule, occurrences, {
        today: d('2026-09-02'),
        projectFrom: projectFrom(sprints, d('2026-09-02')),
      }),
    ).toMatchObject({ scheduledDate: '2026-09-12', ruleVersion: 3 });

    // 9. The 9/7 week: 9/12 (Sat, v3) is generated and included by default.
    const week7 = planWeek(
      '2026-09-07',
      [closed, closed24, { ...active31, state: 'review' }],
      '2026-09-07T00:00:00.000Z',
    );
    expect(week7.occurrences).toMatchObject([
      { scheduledDate: '2026-09-12', ruleVersion: 3, state: 'pending' },
    ]);
    expect(week7.sprint.tasks).toMatchObject([
      { outcome: 'draft', occurrenceIds: [week7.occurrences[0]?.id] },
    ]);
  });
});

describe('Scenario C — steps 2–3 in Today', () => {
  it('each week’s occurrence appears in Today on its day; done and skipped go to the occurrence', () => {
    const newOccurrenceId = ids<'Occurrence'>('occ');
    const created = unwrap(
      createRecurrenceRule(
        newTask('部屋の掃除'),
        { id: id('rule-1'), pattern: saturday, effectiveFrom: d('2026-08-03') },
        at('2026-08-02T00:00:00.000Z'),
      ),
    );
    const task = created.task;
    const rule = created.rule;
    let occurrences: Occurrence[] = [];
    let sprints: Sprint[] = [];

    const runWeek = (
      start: string,
      day: string,
      action: 'complete' | 'skip',
    ) => {
      const started = unwrap(
        startPlanning(
          {
            sprintId: id(`sprint-${start}`),
            user,
            start: d(start),
            sprints,
            recurring: [{ task, rule }],
            occurrences,
            newOccurrenceId,
            newSprintTaskId: ids(`st-${start}`),
          },
          at(`${start}T00:00:00.000Z`),
        ),
      );
      occurrences = [...occurrences, ...started.occurrences];
      let sprint = unwrap(
        confirmSprint(
          started.sprint,
          { sprints, tasks: [task], areas: [], applyCriterion: false },
          at(`${start}T00:10:00.000Z`),
        ),
      );
      // On the day, the system puts the occurrence into Today (当日の繰り返し).
      sprint = unwrap(
        startDay(
          sprint,
          { today: d(day), occurrences, newSelectionId: ids(`sel-${day}`) },
          { ...at(`${day}T00:00:00.000Z`), actor: 'system' },
        ),
      );
      const [selection] = sprint.dailySelections;
      expect(selection).toMatchObject({ date: day, origin: 'recurringToday' });
      const occurrence = occurrences.find(
        (o) => o.id === selection?.occurrenceId,
      );
      if (selection === undefined || occurrence === undefined) {
        throw new Error('no selection');
      }
      const change = unwrap(
        action === 'complete'
          ? completeSelection(
              sprint,
              { selectionId: selection.id, occurrence, today: d(day) },
              at(`${day}T01:00:00.000Z`),
            )
          : skipSelection(
              sprint,
              { selectionId: selection.id, occurrence },
              at(`${day}T01:00:00.000Z`),
            ),
      );
      occurrences = occurrences.map((o) =>
        o.id === change.occurrence?.id ? change.occurrence : o,
      );
      sprints = [...sprints, { ...change.sprint, state: 'closed' }];
      return change;
    };

    // 2. 8/8 and 8/15 are done (occurrence and DailySelection).
    for (const [start, day] of [
      ['2026-08-03', '2026-08-08'],
      ['2026-08-10', '2026-08-15'],
    ] as const) {
      const change = runWeek(start, day, 'complete');
      expect(change.occurrence?.state).toBe('done');
      expect(change.sprint.dailySelections[0]?.resolution).toBe('done');
      expect(change).not.toHaveProperty('task');
    }

    // 3. 8/22 is skipped; the rule does not change.
    const skipped = runWeek('2026-08-17', '2026-08-22', 'skip');
    expect(skipped.occurrence?.state).toBe('skipped');
    expect(skipped.sprint.dailySelections[0]?.resolution).toBe('skipped');
    // The rule is not an input of skipping at all: skip changes only the
    // occurrence and the selection (invariant 30).
    expect(skipped).not.toHaveProperty('rule');
    expect(occurrences.map((o) => [o.scheduledDate, o.state])).toEqual([
      ['2026-08-08', 'done'],
      ['2026-08-15', 'done'],
      ['2026-08-22', 'skipped'],
    ]);
    // Retro of the 8/17 week: 「8/22 の回をスキップ」.
    const week17 = sprints.at(-1);
    if (week17 === undefined) throw new Error('no Sprint');
    const facts = retroFacts(week17, {
      tasks: [task],
      areas: [],
      occurrences,
      sprints,
    });
    expect(facts.occurrences.skipped.map((o) => o.scheduledDate)).toEqual([
      '2026-08-22',
    ]);
  });
});
