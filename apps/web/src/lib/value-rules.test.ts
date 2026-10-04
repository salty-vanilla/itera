import {
  addSubtask,
  createArea,
  createTask,
  editInterrupt,
  id,
  instant,
  isPositiveHours,
  localDate,
  noteInterrupt,
  renameArea,
  setGoalText,
  setImprovement,
  setUpUser,
  timeZone,
  validatePattern,
  type AreaId,
  type CommandContext,
  type InterruptNoteId,
  type RecurrencePattern,
  type RetroImprovement,
  type Sprint,
  type SubtaskId,
  type TaskId,
  type UserId,
} from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  goalIsFixed,
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
const zone = timeZone('Asia/Tokyo');
const noteId = id<'InterruptNote'>('n') as InterruptNoteId;

/** A Sprint of the week of `ctx.now`, with only what a rule here looks at. */
const sprintOf = (parts: Partial<Sprint>): Sprint => ({
  id: id<'Sprint'>('s'),
  userId,
  start: localDate('2026-10-05'),
  end: localDate('2026-10-11'),
  state: 'planning',
  goals: [],
  tasks: [],
  areaSnapshot: [],
  dailySelections: [],
  actualTimes: [],
  interrupts: [],
  ...parts,
});

/** A Sprint in its Retro, with the 次に試すこと it has. */
const retroOf = (improvement: RetroImprovement): Sprint =>
  sprintOf({
    state: 'review',
    retro: {
      startedAt: ctx.now,
      pins: [],
      reflection: '',
      improvement,
    },
  });

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
  });

  it.each(TEXTS)('an Area name %j is read as renameArea keeps it', (text) => {
    const kept = createArea(
      {
        id: id<'Area'>('a') as AreaId,
        userId,
        name: 'old',
        color: 1,
        order: 0,
      },
      ctx,
    );
    if (!kept.ok) throw new Error('the Area is made');
    const renamed = renameArea(kept.value.record, text, ctx);
    expect(readAreaName(text)).toBe(
      renamed.ok ? renamed.value.record.name : undefined,
    );
  });

  it.each(TEXTS)('a display name %j is read as setUpUser keeps it', (text) => {
    const set = setUpUser(null, {
      id: userId,
      displayName: text,
      timeZone: zone,
      weekStartsOn: 1,
    });
    expect(readDisplayName(text)).toBe(
      set.ok ? set.value.user.displayName : undefined,
    );
  });

  it.each(TEXTS)(
    'an interrupt note %j is read as noteInterrupt keeps it',
    (text) => {
      const noted = noteInterrupt(
        sprintOf({ state: 'active' }),
        { id: noteId, text, timeZone: zone },
        ctx,
      );
      expect(readInterruptText(text)).toBe(
        noted.ok ? noted.value.record.interrupts[0]?.text : undefined,
      );
    },
  );

  it.each(TEXTS)(
    'an interrupt note %j is read as editInterrupt keeps it',
    (text) => {
      const edited = editInterrupt(
        sprintOf({
          state: 'active',
          interrupts: [{ id: noteId, at: ctx.now, text: 'old' }],
        }),
        { id: noteId, text },
        ctx,
      );
      expect(readInterruptText(text)).toBe(
        edited.ok ? edited.value.record.interrupts[0]?.text : undefined,
      );
    },
  );
});

describe('the texts that may be empty', () => {
  const areaId = id<'Area'>('a') as AreaId;

  it.each(TEXTS)('a Goal %j is read as setGoalText keeps it', (text) => {
    const set = setGoalText(
      sprintOf({ state: 'planning' }),
      { areaId, text },
      ctx,
    );
    if (!set.ok) throw new Error('a Goal is set while planning');
    expect(readGoalText(text)).toBe(set.value.record.goals[0]?.text ?? '');
  });

  it.each(TEXTS)(
    'a Goal %j is fixed once confirmed as setGoalText says',
    (text) => {
      const set = setGoalText(
        sprintOf({ state: 'active', goals: [{ areaId, text: 'old' }] }),
        { areaId, text },
        ctx,
      );
      // The screen asks `removable` (false once confirmed) from the record.
      expect(goalIsFixed(text, false)).toBe(!set.ok);
      expect(goalIsFixed(text, true)).toBe(false);
    },
  );

  it.each(TEXTS)(
    '次に試すこと %j is read as setImprovement keeps it',
    (text) => {
      const set = setImprovement(retroOf({ text: 'old' }), { text }, ctx);
      if (!set.ok) throw new Error('it is set in a Retro');
      expect(readImprovementText(text)).toBe(
        set.value.record.retro?.improvement?.text ?? '',
      );
    },
  );

  it.each(TEXTS)(
    '次に試すこと %j is held while a criterion was made from it',
    (text) => {
      const set = setImprovement(
        retroOf({ text: 'old', criterionId: id<'PlanningCriterion'>('c') }),
        { text },
        ctx,
      );
      // Only taking it away is refused: what is not empty is another text.
      expect(improvementHoldsCriterion(text, true)).toBe(!set.ok);
      expect(improvementHoldsCriterion(text, false)).toBe(false);
    },
  );
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
