// Scenario C of docs/domain/domain-model.md (部屋の掃除, weekly), steps
// 1–5 and 8. Sprints are Monday–Sunday weeks of 2026. The Sprint records
// themselves come with #22; here each Sprint is just its period, and the
// Planning start is when its occurrences are generated.
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
import { at, newTask, unwrap } from './testing';

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
