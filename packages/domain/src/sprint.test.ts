import { describe, expect, it } from 'vitest';
import { renameArea } from './area';
import { localDate } from './shared/time';
import {
  nextUnconfirmedSprintStart,
  projectFrom,
  sprintAreaName,
  weekStartOf,
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
