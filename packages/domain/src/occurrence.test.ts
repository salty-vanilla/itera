import { describe, expect, it } from 'vitest';
import {
  completeOccurrence,
  excludeOccurrence,
  generateOccurrences,
  includeOccurrence,
  missOccurrence,
  reopenOccurrence,
  skipOccurrence,
  type Occurrence,
  type OccurrenceState,
} from './occurrence';
import {
  changeRecurrenceRule,
  createRecurrenceRule,
  type RecurrenceRule,
} from './recurrence';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import { at, ctx, newTask, unwrap } from './testing';

const d = localDate;

function weeklySaturday(): RecurrenceRule {
  return unwrap(
    createRecurrenceRule(
      newTask('部屋の掃除'),
      {
        id: id('rule-1'),
        pattern: { freq: 'weekly', daysOfWeek: [6] },
        effectiveFrom: d('2026-08-03'),
      },
      ctx,
    ),
  ).rule;
}

function ids() {
  let n = 0;
  return () => id<'Occurrence'>(`occ-${++n}`);
}

function generate(
  rule: RecurrenceRule,
  start: string,
  end: string,
  existing: readonly Occurrence[] = [],
  newOccurrenceId = ids(),
): readonly Occurrence[] {
  return unwrap(
    generateOccurrences(
      rule,
      { start: d(start), end: d(end), existing, newOccurrenceId },
      ctx,
    ),
  );
}

function pending(): Occurrence {
  const [occurrence] = generate(weeklySaturday(), '2026-08-03', '2026-08-09');
  if (occurrence === undefined) throw new Error('no occurrence');
  return occurrence;
}

describe('Occurrence generation', () => {
  it('generates pending occurrences with the date and rule version fixed', () => {
    const result = generateOccurrences(
      weeklySaturday(),
      {
        start: d('2026-08-03'),
        end: d('2026-08-16'),
        existing: [],
        newOccurrenceId: ids(),
      },
      at('2026-08-03T00:00:00.000Z'),
    );
    expect(unwrap(result)).toEqual([
      {
        id: 'occ-1',
        taskId: 'task-1',
        ruleId: 'rule-1',
        scheduledDate: '2026-08-08',
        ruleVersion: 1,
        materializedAt: '2026-08-03T00:00:00.000Z',
        state: 'pending',
        stateChangedAt: '2026-08-03T00:00:00.000Z',
      },
      expect.objectContaining({ id: 'occ-2', scheduledDate: '2026-08-15' }),
    ]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'occurrenceGenerated',
      'occurrenceGenerated',
    ]);
  });

  it('invariant 32: only the given period is generated, nothing ahead', () => {
    const occurrences = generate(weeklySaturday(), '2026-08-03', '2026-08-09');
    expect(occurrences.map((o) => o.scheduledDate)).toEqual(['2026-08-08']);
  });

  it('does not generate a date that already has an occurrence', () => {
    const rule = weeklySaturday();
    const first = generate(rule, '2026-08-03', '2026-08-09');
    const again = generate(rule, '2026-08-03', '2026-08-16', first, () =>
      id('occ-new'),
    );
    expect(again.map((o) => o.scheduledDate)).toEqual(['2026-08-15']);
  });

  it('rejects a period that ends before it starts', () => {
    expect(
      generateOccurrences(
        weeklySaturday(),
        {
          start: d('2026-08-09'),
          end: d('2026-08-03'),
          existing: [],
          newOccurrenceId: ids(),
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('invariant 31: a rule change never moves a generated occurrence', () => {
    const rule = weeklySaturday();
    const generated = generate(rule, '2026-08-03', '2026-08-23');
    const frozen = structuredCloneJson(generated);

    const changed = unwrap(
      changeRecurrenceRule(
        rule,
        { freq: 'weekly', daysOfWeek: [0] },
        d('2026-08-24'),
        ctx,
      ),
    );
    expect(generated).toEqual(frozen);
    // Regenerating the same days keeps them; the next period uses v2.
    const later = generate(changed, '2026-08-03', '2026-08-30', generated);
    expect(later.map((o) => [o.scheduledDate, o.ruleVersion])).toEqual([
      ['2026-08-30', 2],
    ]);
  });
});

describe('Occurrence transitions', () => {
  const cases: [string, (o: Occurrence) => Occurrence, OccurrenceState][] = [
    ['exclude', (o) => unwrap(excludeOccurrence(o, ctx)), 'excluded'],
    ['complete', (o) => unwrap(completeOccurrence(o, ctx)), 'done'],
    ['skip', (o) => unwrap(skipOccurrence(o, ctx)), 'skipped'],
    ['miss', (o) => unwrap(missOccurrence(o, ctx)), 'missed'],
  ];
  it.each(cases)('pending → %s', (_, apply, state) => {
    const next = apply(pending());
    expect(next.state).toBe(state);
    expect(next.stateChangedAt).toBe(ctx.now);
  });

  it('invariant 33: an excluded occurrence stays as a record and can be included again', () => {
    const excluded = unwrap(excludeOccurrence(pending(), ctx));
    expect(excluded).toMatchObject({
      scheduledDate: '2026-08-08',
      state: 'excluded',
    });
    expect(unwrap(includeOccurrence(excluded, ctx)).state).toBe('pending');
  });

  it('done and skipped can be undone back to pending', () => {
    const done = unwrap(completeOccurrence(pending(), ctx));
    expect(unwrap(reopenOccurrence(done, ctx)).state).toBe('pending');
    const skipped = unwrap(skipOccurrence(pending(), ctx));
    const result = reopenOccurrence(skipped, ctx);
    expect(unwrap(result).state).toBe('pending');
    expect(result.ok && result.value.activities[0]).toMatchObject({
      kind: 'occurrenceReopened',
      occurrenceId: 'occ-1',
      scheduledDate: '2026-08-08',
    });
  });

  it('rejects transitions the state diagram does not have', () => {
    const done = unwrap(completeOccurrence(pending(), ctx));
    const excluded = unwrap(excludeOccurrence(pending(), ctx));
    const missed = unwrap(missOccurrence(pending(), ctx));
    for (const result of [
      skipOccurrence(done, ctx),
      completeOccurrence(excluded, ctx),
      excludeOccurrence(done, ctx),
      reopenOccurrence(missed, ctx),
      reopenOccurrence(excluded, ctx),
      includeOccurrence(pending(), ctx),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'invalidTransition' },
      });
    }
  });

  it('invariant 30: completing or skipping changes the occurrence, not the rule', () => {
    const rule = weeklySaturday();
    const before = structuredCloneJson(rule);
    const [occurrence] = generate(rule, '2026-08-03', '2026-08-09');
    if (occurrence === undefined) throw new Error('no occurrence');
    unwrap(skipOccurrence(occurrence, ctx));
    unwrap(completeOccurrence(occurrence, ctx));
    expect(rule).toEqual(before);
    expect(rule).not.toHaveProperty('completedAt');
  });
});

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
