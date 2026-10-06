import { describe, expect, it } from 'vitest';
import { renameArea } from './area';
import { instant, localDate } from './shared/time';
import {
  isCounted,
  isInConfirmedPlan,
  nextUnconfirmedSprintStart,
  occurrenceValue,
  projectFrom,
  sprintAreaName,
  sprintNumber,
  weekStartOf,
  type PlanSnapshot,
  type SprintTaskOutcome,
} from './sprint';
import {
  ctx,
  research,
  researchId,
  sprintFixture,
  unwrap,
  user,
} from './testing';

const d = localDate;

describe('sprintAreaName (F5)', () => {
  const renamed = unwrap(renameArea(research, '研究・論文', ctx));

  it('Planning uses the current name', () => {
    const draft = sprintFixture('2026-09-28', 'planning');
    expect(sprintAreaName(draft, researchId, [renamed])).toBe('研究・論文');
  });

  it('a confirmed Sprint keeps the confirmed name for its whole life', () => {
    for (const state of ['active', 'review', 'closed'] as const) {
      const sprint = sprintFixture('2026-09-28', state, {
        areaSnapshot: [{ areaId: researchId, name: '研究', order: 1 }],
      });
      expect(sprintAreaName(sprint, researchId, [renamed])).toBe('研究');
    }
  });
});

describe('weekStartOf', () => {
  it('follows the user’s week start', () => {
    expect(weekStartOf(d('2026-10-01'), user)).toBe('2026-09-28');
    expect(weekStartOf(d('2026-10-01'), { ...user, weekStartsOn: 0 })).toBe(
      '2026-09-27',
    );
    expect(weekStartOf(d('2026-09-28'), user)).toBe('2026-09-28');
  });
});

describe('nextUnconfirmedSprintStart (F1)', () => {
  it('is the draft’s start when a Sprint is in Planning', () => {
    const sprints = [
      sprintFixture('2026-09-28', 'active'),
      sprintFixture('2026-10-05', 'planning'),
    ];
    expect(nextUnconfirmedSprintStart(sprints, user, d('2026-10-01'))).toBe(
      '2026-10-05',
    );
  });

  it('is the day after the active Sprint otherwise', () => {
    const sprints = [sprintFixture('2026-09-28', 'active')];
    expect(nextUnconfirmedSprintStart(sprints, user, d('2026-10-01'))).toBe(
      '2026-10-05',
    );
  });

  it('is this week when the last Sprint ended before it, or when there is none', () => {
    const old = [sprintFixture('2026-09-07', 'closed')];
    expect(nextUnconfirmedSprintStart(old, user, d('2026-10-01'))).toBe(
      '2026-09-28',
    );
    expect(nextUnconfirmedSprintStart([], user, d('2026-10-01'))).toBe(
      '2026-09-28',
    );
  });
});

describe('projectFrom', () => {
  it('is the first day after every generated Sprint period, or today', () => {
    const sprints = [
      sprintFixture('2026-09-28', 'active'),
      sprintFixture('2026-10-05', 'planning'),
    ];
    expect(projectFrom(sprints, d('2026-10-01'))).toBe('2026-10-12');
    expect(
      projectFrom([sprintFixture('2026-09-07', 'closed')], d('2026-10-01')),
    ).toBe('2026-10-01');
    expect(projectFrom([], d('2026-10-01'))).toBe('2026-10-01');
  });
});

describe('sprintNumber (F25)', () => {
  it('numbers Sprints by start, from 1, whatever their order in the list', () => {
    const a = sprintFixture('2026-09-14', 'closed');
    const b = sprintFixture('2026-09-21', 'closed');
    const c = sprintFixture('2026-09-28', 'planning');
    const all = [c, a, b];
    expect([a, b, c].map((s) => sprintNumber(s, all))).toEqual([1, 2, 3]);
  });
});

describe('isInConfirmedPlan (F20, F32, #349)', () => {
  const outcomes: readonly SprintTaskOutcome[] = [
    'draft',
    'planned',
    'done',
    'removed',
    'carriedOver',
  ];

  it('counts planned, done and carried over; not removed or a draft', () => {
    expect(
      outcomes.filter((outcome) => isInConfirmedPlan({ outcome })),
    ).toEqual(['planned', 'done', 'carriedOver']);
  });

  it('is isCounted with the carried over, in a confirmed Sprint (no drafts)', () => {
    const confirmed = outcomes.filter((outcome) => outcome !== 'draft');
    for (const outcome of confirmed) {
      const task = { outcome } as Parameters<typeof isCounted>[0];
      expect(isInConfirmedPlan(task)).toBe(
        isCounted(task) || outcome === 'carriedOver',
      );
    }
  });
});

describe('occurrenceValue (invariant 16, #349)', () => {
  const computedAt = instant('2026-09-28T00:00:00.000Z');
  const snapshot = (extra: Partial<PlanSnapshot>): PlanSnapshot => ({
    value: {
      base: 'estimate',
      lo: 3,
      hi: 6,
      criterionApplied: false,
      computedAt,
    },
    timeBasis: 'task',
    ...extra,
  });

  it('a recurring SprintTask: one occurrence’s share of the planned value', () => {
    expect(occurrenceValue(snapshot({ occurrenceCount: 3 }))).toEqual({
      base: 'estimate',
      lo: 1,
      hi: 2,
      criterionApplied: false,
      computedAt,
    });
  });

  it('any other value as it is', () => {
    const single = snapshot({});
    expect(occurrenceValue(single)).toBe(single.value);
    const once = snapshot({ occurrenceCount: 1 });
    expect(occurrenceValue(once)).toBe(once.value);
    const none = snapshot({
      value: { base: 'none', criterionApplied: false, computedAt },
      occurrenceCount: 3,
    });
    expect(occurrenceValue(none)).toBe(none.value);
  });
});
