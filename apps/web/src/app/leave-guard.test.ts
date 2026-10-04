import { describe, expect, it } from 'vitest';
import { createUnsavedTyping } from '@/lib/unsaved-typing';
import { takesAway } from './leave-guard';

// Which moves take a field with typing not saved away (#332).

const at = (pathname: string, search: object = {}) => ({ pathname, search });

describe('takesAway', () => {
  it('lets every move go while nothing is unsaved', () => {
    const unsaved = createUnsavedTyping();
    expect(takesAway(unsaved, at('/retro'), at('/today'))).toBe(false);
  });

  it('stops another screen, and another stage of the same screen', () => {
    const unsaved = createUnsavedTyping();
    unsaved.mark({}, []);
    expect(takesAway(unsaved, at('/retro'), at('/today'))).toBe(true);
    expect(
      takesAway(
        unsaved,
        at('/retro', { stage: 'reflect' }),
        at('/retro', { stage: 'handoff' }),
      ),
    ).toBe(true);
  });

  it('lets a Task detail open and close over a field of the screen', () => {
    const unsaved = createUnsavedTyping();
    unsaved.mark({}, []);
    expect(
      takesAway(unsaved, at('/sprint'), at('/sprint', { task: 'task_1' })),
    ).toBe(false);
    expect(
      takesAway(unsaved, at('/sprint', { task: 'task_1' }), at('/sprint')),
    ).toBe(false);
  });

  it('stops closing or switching a Task detail with a field in it', () => {
    const unsaved = createUnsavedTyping();
    unsaved.mark({}, ['task']);
    expect(
      takesAway(unsaved, at('/backlog', { task: 'task_1' }), at('/backlog')),
    ).toBe(true);
    expect(
      takesAway(
        unsaved,
        at('/backlog', { task: 'task_1' }),
        at('/backlog', { task: 'task_2' }),
      ),
    ).toBe(true);
  });

  it('does not tell the same search apart by the order of its keys', () => {
    const unsaved = createUnsavedTyping();
    unsaved.mark({}, []);
    expect(
      takesAway(
        unsaved,
        at('/today', { day: '2026-10-04', fixture: 'a' }),
        at('/today', { fixture: 'a', day: '2026-10-04' }),
      ),
    ).toBe(false);
  });

  it('lets the move to sign in go: nothing can be saved without a session', () => {
    const unsaved = createUnsavedTyping();
    unsaved.mark({}, []);
    expect(takesAway(unsaved, at('/retro'), at('/sign-in'))).toBe(false);
  });
});
