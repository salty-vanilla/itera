import {
  addSubtask,
  createArea,
  createTask,
  id,
  instant,
  isPositiveHours,
  renameArea,
  setUpUser,
  timeZone,
  validatePattern,
  type AreaId,
  type CommandContext,
  type RecurrencePattern,
  type SubtaskId,
  type TaskId,
  type UserId,
} from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  improvementHoldsCriterion,
  isBlank,
  positiveMinutes,
  readAreaName,
  readDisplayName,
  readGoalText,
  readImprovementText,
  readInterruptText,
  readSubtaskTitle,
  readTaskTitle,
  sameWords,
  trimText,
  weeklyNeedsADay,
} from './value-rules';

// The rules of this module are copies of the domain's: the same input has
// to be judged the same way. The domain is reached from here and from no
// other file of `src/lib` that is not a test (ADR 0005).

const ctx: CommandContext = {
  now: instant('2026-10-05T00:00:00.000Z'),
  actor: 'user',
};
const userId = id<'User'>('u') as UserId;

/** Empty, only spaces (also full-width and a tab), and spaces around. */
const TEXTS = [
  '',
  ' ',
  '   ',
  '\t\n',
  '　',
  'a',
  ' a',
  'a ',
  '  論文を書く  ',
  '　研究　',
  'a b',
];

/** What the domain keeps of a text, or `undefined` when it refuses it. */
const keptByDomain = (title: string): string | undefined => {
  const made = createTask(
    { id: id<'Task'>('t') as TaskId, userId, title, via: 'backlog' },
    ctx,
  );
  return made.ok ? made.value.record.title : undefined;
};

describe('the texts that must not be empty', () => {
  it.each(TEXTS)('a Task title %j is read as createTask keeps it', (text) => {
    expect(readTaskTitle(text)).toBe(keptByDomain(text));
  });

  it.each(TEXTS)(
    'a Subtask title %j is read as addSubtask keeps it',
    (text) => {
      const task = createTask(
        { id: id<'Task'>('t') as TaskId, userId, title: 't', via: 'backlog' },
        ctx,
      );
      if (!task.ok) throw new Error('the Task is made');
      const added = addSubtask(
        task.value.record,
        { id: id<'Subtask'>('s') as SubtaskId, title: text },
        ctx,
      );
      expect(readSubtaskTitle(text)).toBe(
        added.ok ? added.value.record.subtasks[0]?.title : undefined,
      );
    },
  );

  it.each(TEXTS)('an Area name %j is read as createArea keeps it', (text) => {
    const input = {
      id: id<'Area'>('a') as AreaId,
      userId,
      name: text,
      color: 1,
      order: 0,
    } as const;
    const made = createArea(input, ctx);
    expect(readAreaName(text)).toBe(
      made.ok ? made.value.record.name : undefined,
    );
    // renameArea judges the new name the same way.
    if (made.ok) {
      const kept = createArea({ ...input, name: 'old' }, ctx);
      if (!kept.ok) throw new Error('the Area is made');
      const renamed = renameArea(kept.value.record, text, ctx);
      expect(readAreaName(text)).toBe(
        renamed.ok ? renamed.value.record.name : undefined,
      );
    }
  });

  it.each(TEXTS)('a display name %j is read as setUpUser keeps it', (text) => {
    const set = setUpUser(null, {
      id: userId,
      displayName: text,
      timeZone: timeZone('Asia/Tokyo'),
      weekStartsOn: 1,
    });
    expect(readDisplayName(text)).toBe(
      set.ok ? set.value.user.displayName : undefined,
    );
  });

  // `noteInterrupt` and `editInterrupt` need a running Sprint; their test is
  // in `packages/domain`. The same line is `input.text.trim()` and `''`.
  it('an interrupt note is the text without the spaces around it, not empty', () => {
    expect(readInterruptText('  電話  ')).toBe('電話');
    expect(readInterruptText('')).toBeUndefined();
    expect(readInterruptText(' \t ')).toBeUndefined();
  });
});

describe('the texts that may be empty', () => {
  it('a Goal and 次に試すこと are kept without the spaces around them', () => {
    expect(readGoalText('  論文を 3章まで  ')).toBe('論文を 3章まで');
    expect(readImprovementText('　 1本ずつ 　')).toBe('1本ずつ');
  });

  it('empty is the empty text, which takes the Goal or 次に試すこと away', () => {
    expect(readGoalText('   ')).toBe('');
    expect(readImprovementText('')).toBe('');
  });

  it('taking away 次に試すこと that a criterion was made from is held back', () => {
    expect(improvementHoldsCriterion('  ', true)).toBe(true);
    expect(improvementHoldsCriterion('', true)).toBe(true);
    expect(improvementHoldsCriterion('1本ずつ', true)).toBe(false);
    expect(improvementHoldsCriterion('', false)).toBe(false);
  });
});

describe('spaces', () => {
  it.each(TEXTS)('%j is blank when nothing is left of it', (text) => {
    expect(isBlank(text)).toBe(trimText(text) === '');
    expect(isBlank(text)).toBe(keptByDomain(text) === undefined);
  });

  it('two texts are the same words whatever spaces are around them', () => {
    expect(sameWords(' a ', 'a')).toBe(true);
    expect(sameWords('a', 'a b')).toBe(false);
    expect(sameWords('', '  ')).toBe(true);
    // Spaces inside stay.
    expect(sameWords('a  b', 'a b')).toBe(false);
  });
});

describe('a time of at least a minute', () => {
  it('keeps a positive number of minutes', () => {
    expect(positiveMinutes(1)).toBe(1);
    expect(positiveMinutes(90)).toBe(90);
  });

  it('is null for 0, a negative time and what is not a number', () => {
    expect(positiveMinutes(0)).toBeNull();
    expect(positiveMinutes(-5)).toBeNull();
    expect(positiveMinutes(Number.NaN)).toBeNull();
    expect(positiveMinutes(Number.POSITIVE_INFINITY)).toBeNull();
    expect(positiveMinutes(null)).toBeNull();
  });

  it('leaves nothing typed as it is', () => {
    expect(positiveMinutes(undefined)).toBeUndefined();
  });

  it.each([0, -1, -0.5, 0.5, 1, 90, 1 / 3, Number.NaN, Infinity])(
    '%j minutes is accepted as the domain accepts the hours of it',
    (minutes) => {
      expect(positiveMinutes(minutes) !== null).toBe(
        isPositiveHours(minutes / 60),
      );
    },
  );
});

describe('a weekly rule', () => {
  const pattern = (days: readonly number[]) =>
    ({ freq: 'weekly', daysOfWeek: days }) as unknown as RecurrencePattern;

  it('needs a weekday, as validatePattern says', () => {
    expect(weeklyNeedsADay('weekly', [])).toBe(true);
    expect(validatePattern(pattern([]))).not.toBeNull();
    expect(weeklyNeedsADay('weekly', [1])).toBe(false);
    expect(validatePattern(pattern([1]))).toBeNull();
  });

  it('asks nothing of the other frequencies', () => {
    expect(weeklyNeedsADay('daily', [])).toBe(false);
    expect(weeklyNeedsADay('weekdays', [])).toBe(false);
    expect(weeklyNeedsADay('monthly', [])).toBe(false);
  });
});
