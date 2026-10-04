import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Saved } from '@/api/use-operation';
import { savedOver } from '@/test/saved';
import { sameWords, useDraftField } from './use-draft-field';

function setup(initial = 'saved') {
  return renderHook(({ read }) => useDraftField(read), {
    initialProps: { read: initial },
  });
}

describe('useDraftField', () => {
  it('shows the value as read, and the one read after it while nothing is typed', () => {
    const { result, rerender } = setup();
    expect(result.current.value).toBe('saved');
    rerender({ read: 'from another device' });
    expect(result.current.value).toBe('from another device');
    expect(result.current.edited).toBe(false);
  });

  it('keeps what is typed when the read changes, and compares with what the field showed when typing began', () => {
    const { result, rerender } = setup();
    act(() => result.current.set('typed'));
    rerender({ read: 'from another device' });
    expect(result.current.value).toBe('typed');
    expect(result.current.base).toBe('saved');
    expect(result.current.edited).toBe(true);
  });

  it('is not edited when what was typed is back to what the field showed', () => {
    const { result } = setup();
    act(() => result.current.set('typed'));
    act(() => result.current.set('saved'));
    expect(result.current.edited).toBe(false);
  });

  it('goes back to the value as read on leaving without an edit', () => {
    const { result, rerender } = setup();
    act(() => result.current.set('typed'));
    act(() => result.current.set('saved'));
    let edited = true;
    act(() => {
      edited = result.current.leave();
    });
    expect(edited).toBe(false);
    rerender({ read: 'from another device' });
    expect(result.current.value).toBe('from another device');
  });

  it('keeps an edit on leaving, for the caller to save', () => {
    const { result } = setup();
    act(() => result.current.set('typed'));
    let edited = false;
    act(() => {
      edited = result.current.leave();
    });
    expect(edited).toBe(true);
    expect(result.current.value).toBe('typed');
  });

  it('shows what was sent until the read changes, then follows the read', async () => {
    const { result, rerender } = setup();
    act(() => result.current.set('typed'));
    await act(async () => result.current.hold(Promise.resolve(true)));
    expect(result.current.value).toBe('typed');
    // Sent, and not an edit to send again.
    expect(result.current.edited).toBe(false);
    expect(result.current.base).toBe('typed');
    rerender({ read: 'typed' });
    rerender({ read: 'later, from another device' });
    expect(result.current.value).toBe('later, from another device');
  });

  it('gives the typing back to the person when the save fails', async () => {
    const { result } = setup();
    act(() => result.current.set('typed'));
    await act(async () => result.current.hold(Promise.resolve(false)));
    expect(result.current.value).toBe('typed');
    expect(result.current.edited).toBe(true);
  });

  it('follows the read again once it comes back with typing a failed save gave back (sent again, or saved after all: #320)', async () => {
    const { result, rerender } = setup();
    act(() => result.current.set('typed'));
    await act(async () => result.current.hold(Promise.resolve(false)));
    rerender({ read: 'typed' });
    expect(result.current.value).toBe('typed');
    expect(result.current.edited).toBe(false);
    rerender({ read: 'from another device' });
    expect(result.current.value).toBe('from another device');
  });

  it('keeps typing a failed save gave back while the read is something else', async () => {
    const { result, rerender } = setup();
    act(() => result.current.set('typed'));
    await act(async () => result.current.hold(Promise.resolve(false)));
    rerender({ read: 'from another device' });
    expect(result.current.value).toBe('typed');
    expect(result.current.edited).toBe(true);
  });

  it('says the save failed while the typing it gave back is not in the records (#332)', async () => {
    const { result, rerender } = setup();
    act(() => result.current.set('typed'));
    expect(result.current.saveFailed).toBe(false);
    await act(async () => result.current.hold(Promise.resolve(false)));
    expect(result.current.saveFailed).toBe(true);
    rerender({ read: 'from another device' });
    expect(result.current.saveFailed).toBe(true);
    // Saved again: the read comes back with the typing.
    rerender({ read: 'typed' });
    expect(result.current.saveFailed).toBe(false);
  });

  it('no longer says the save failed once it is typed in again, or sent again', async () => {
    const { result } = setup();
    act(() => result.current.set('typed'));
    await act(async () => result.current.hold(Promise.resolve(false)));
    act(() => result.current.set('typed more'));
    expect(result.current.saveFailed).toBe(false);
    await act(async () => result.current.hold(Promise.resolve(false)));
    expect(result.current.saveFailed).toBe(true);
    let answer: (ok: boolean) => void = () => {};
    act(() => result.current.hold(new Promise<boolean>((r) => (answer = r))));
    expect(result.current.saveFailed).toBe(false);
    await act(async () => answer(true));
    expect(result.current.saveFailed).toBe(false);
  });

  it('is unsaved from a failed save until the typing is saved, also when the read does not change for it', async () => {
    const { result, rerender } = setup();
    act(() => result.current.set('mine'));
    await act(async () => result.current.hold(Promise.resolve(false)));
    expect(result.current.unsaved).toBe(true);
    rerender({ read: 'from another device' });
    // Typed over to the other device's words and saved: the read does not
    // change for it.
    act(() => result.current.set('from another device'));
    expect(result.current.unsaved).toBe(true);
    await act(async () => result.current.hold(Promise.resolve(true)));
    expect(result.current.unsaved).toBe(false);
  });

  it('does not say the save failed once the typing is dropped', async () => {
    const { result } = setup();
    act(() => result.current.set('typed'));
    await act(async () => result.current.hold(Promise.resolve(false)));
    act(() => result.current.drop());
    expect(result.current.saveFailed).toBe(false);
  });

  it('shows a value put in by an operation until the read changes, without an edit', () => {
    const { result, rerender } = setup();
    act(() => result.current.put('adopted'));
    expect(result.current.value).toBe('adopted');
    expect(result.current.edited).toBe(false);
    rerender({ read: 'adopted' });
    rerender({ read: 'other' });
    expect(result.current.value).toBe('other');
  });

  it('drops the typing', () => {
    const { result } = setup();
    act(() => result.current.set('typed'));
    act(() => result.current.drop());
    expect(result.current.value).toBe('saved');
  });
});

describe('useDraftField with words that are the same around spaces', () => {
  it('is not an edit to type spaces around the words, and goes back to following the read', () => {
    const { result, rerender } = renderHook(
      ({ read }) => useDraftField(read, sameWords),
      { initialProps: { read: 'saved' } },
    );
    act(() => result.current.set('saved '));
    expect(result.current.edited).toBe(false);
    act(() => {
      result.current.leave();
    });
    rerender({ read: 'from another device' });
    expect(result.current.value).toBe('from another device');
  });
});

describe('useDraftField when the read changes while typing', () => {
  it('shows what was sent until the read changes from what it was when sent, and gives it back on a failure', async () => {
    const { result, rerender } = setup();
    act(() => result.current.set('typed'));
    // The read changes (a read that was on its way) before the save is sent.
    rerender({ read: 'read in between' });
    await act(async () => result.current.hold(Promise.resolve(false)));
    // Not dropped by the earlier change: the person's typing is kept.
    expect(result.current.value).toBe('typed');
    expect(result.current.edited).toBe(true);
  });
});

describe('useDraftField with saves that overlap', () => {
  it('keeps the latest typing while an earlier save is read again and a later one is still sent', async () => {
    const { result, rerender } = setup();
    let first: (ok: boolean) => void = () => {};
    let second: (ok: boolean) => void = () => {};
    act(() => result.current.set('one'));
    act(() =>
      result.current.hold(new Promise<boolean>((resolve) => (first = resolve))),
    );
    act(() => result.current.set('one two'));
    act(() =>
      result.current.hold(
        new Promise<boolean>((resolve) => (second = resolve)),
      ),
    );
    // The first is answered and read again; the second is on its way.
    await act(async () => first(true));
    rerender({ read: 'one' });
    expect(result.current.value).toBe('one two');
    await act(async () => second(true));
    rerender({ read: 'one two' });
    expect(result.current.value).toBe('one two');
    rerender({ read: 'later, from another device' });
    expect(result.current.value).toBe('later, from another device');
  });

  it('gives the typing back only when the last save fails', async () => {
    const { result } = setup();
    let first: (ok: boolean) => void = () => {};
    let second: (ok: boolean) => void = () => {};
    act(() => result.current.set('one'));
    act(() =>
      result.current.hold(new Promise<boolean>((resolve) => (first = resolve))),
    );
    act(() => result.current.set('one two'));
    act(() =>
      result.current.hold(
        new Promise<boolean>((resolve) => (second = resolve)),
      ),
    );
    await act(async () => first(false));
    // The last save has the whole value: still shown as sent.
    expect(result.current.edited).toBe(false);
    await act(async () => second(false));
    expect(result.current.edited).toBe(true);
    expect(result.current.value).toBe('one two');
  });
});

describe('useDraftField when an answer comes in before the typing is drawn', () => {
  it('does not write back the count of saves a render saw, once they are answered', async () => {
    const { result, rerender } = setup();
    let answer: (ok: boolean) => void = () => {};
    act(() => result.current.set('one'));
    act(() =>
      result.current.hold(
        new Promise<boolean>((resolve) => (answer = resolve)),
      ),
    );
    // What the field's handlers saw while the save was on its way.
    const seen = result.current;
    await act(async () => answer(true));
    // An input handled with that older render, after the answer.
    act(() => seen.put('one two'));
    rerender({ read: 'one two, from the read' });
    // Every save was answered: the read is followed again.
    expect(result.current.value).toBe('one two, from the read');
  });
});

describe('useDraftField of a record with a version (#321)', () => {
  function versioned(etag: string | undefined) {
    return renderHook(
      ({ read, etag }) => useDraftField(read, Object.is, { etag }),
      { initialProps: { read: 'saved', etag } },
    );
  }

  it('is made from the record as read now while nothing is typed', () => {
    const { result, rerender } = versioned('"1"');
    expect(result.current.madeFrom).toEqual({ etag: '"1"' });
    rerender({ read: 'from another device', etag: '"2"' });
    expect(result.current.madeFrom).toEqual({ etag: '"2"' });
  });

  it('is made from the record as read when typing began, when the read changes after', () => {
    const { result, rerender } = versioned('"1"');
    act(() => result.current.set('typed'));
    rerender({ read: 'from another device', etag: '"2"' });
    expect(result.current.madeFrom).toEqual({ etag: '"1"' });
  });

  it('is made from the record as it then is once a failed save gave the typing back', async () => {
    const { result, rerender } = versioned('"1"');
    act(() => result.current.set('typed'));
    await act(async () => {
      result.current.hold(Promise.resolve({ ok: false }));
      await Promise.resolve();
    });
    // The failure read the records again: another device's version.
    rerender({ read: 'from another device', etag: '"2"' });
    expect(result.current.value).toBe('typed');
    expect(result.current.madeFrom).toEqual({ etag: '"2"' });
    act(() => result.current.set('typed more'));
    expect(result.current.madeFrom).toEqual({ etag: '"2"' });
  });

  it('is made from no record when there is none yet (a Goal not written)', () => {
    const { result } = versioned(undefined);
    act(() => result.current.set('typed'));
    expect(result.current.madeFrom).toEqual({ none: true });
  });
});

describe('useDraftField of a record with a version, when a read after the save was made before it (#343)', () => {
  function versioned() {
    return renderHook(
      ({ read, etag }) => useDraftField(read, Object.is, { etag }),
      { initialProps: { read: 'saved', etag: '"1"' as string | undefined } },
    );
  }
  /** A save the test answers. */
  function sent() {
    let answer: (saved: Saved) => void = () => {};
    const saving = new Promise<Saved>((resolve) => (answer = resolve));
    return { saving, answer };
  }

  it('keeps the latest value when the read after the last save failed, and an earlier save is read', async () => {
    const { result, rerender } = versioned();
    const first = sent();
    act(() => result.current.set('one'));
    act(() => result.current.hold(first.saving));
    // Saved, and its read failed the first time: the read is as it was.
    await act(async () => first.answer(savedOver('"1"', '"2"')));
    const second = sent();
    act(() => result.current.set('one two'));
    act(() => result.current.hold(second.saving));
    // The first save's read, tried again, comes while the second is sent.
    rerender({ read: 'one', etag: '"2"' });
    // Saved over the first, and its read failed the first time.
    await act(async () =>
      second.answer({
        ok: true,
        written: {
          over: [{ etag: '"1"' }, { etag: '"2"' }],
          now: { etag: '"3"' },
        },
      }),
    );
    expect(result.current.value).toBe('one two');
    expect(result.current.edited).toBe(false);
    // What is chosen next is made over what is shown, not the first save.
    act(() => result.current.set('one two three'));
    expect(result.current.base).toBe('one two');
    act(() => {
      result.current.leave();
    });
    rerender({ read: 'one two', etag: '"3"' });
    expect(result.current.value).toBe('one two three');
  });

  it("keeps the latest value when an earlier save's read, waiting to be tried again, comes after the last save is answered", async () => {
    const { result, rerender } = versioned();
    const first = sent();
    act(() => result.current.set('one'));
    act(() => result.current.hold(first.saving));
    // Saved, and its read failed the first time: tried again later.
    await act(async () => first.answer(savedOver('"1"', '"2"')));
    const second = sent();
    act(() => result.current.set('one two'));
    act(() => result.current.hold(second.saving));
    // Answered without waiting for a read: one is waiting to be tried again.
    await act(async () =>
      second.answer({
        ok: true,
        written: {
          over: [{ etag: '"1"' }, { etag: '"2"' }],
          now: { etag: '"3"' },
        },
      }),
    );
    // The read tried again was made before the second save.
    rerender({ read: 'one', etag: '"2"' });
    expect(result.current.value).toBe('one two');
    expect(result.current.edited).toBe(false);
    // The read that has the second save: followed from here on.
    rerender({ read: 'one two', etag: '"3"' });
    rerender({ read: 'from another device', etag: '"4"' });
    expect(result.current.value).toBe('from another device');
  });

  it('follows the read once it has the save, also when its value is the one read before', async () => {
    const { result, rerender } = versioned();
    act(() => result.current.set('typed'));
    await act(async () =>
      result.current.hold(Promise.resolve(savedOver('"1"', '"2"'))),
    );
    // Another device put the words back after the save.
    rerender({ read: 'saved', etag: '"3"' });
    expect(result.current.value).toBe('saved');
  });

  it('follows the read when the save changed nothing (the record stays at its version)', async () => {
    const { result, rerender } = versioned();
    act(() => result.current.set('saved '));
    await act(async () =>
      result.current.hold(Promise.resolve(savedOver('"1"', '"1"'))),
    );
    rerender({ read: 'saved', etag: '"1"' });
    expect(result.current.value).toBe('saved');
  });

  it('follows the read once a Goal written empty is gone (no record)', async () => {
    const { result, rerender } = versioned();
    act(() => result.current.set(''));
    await act(async () =>
      result.current.hold(
        Promise.resolve({
          ok: true,
          written: { over: [{ etag: '"1"' }], now: { none: true } },
        }),
      ),
    );
    rerender({ read: 'saved', etag: '"1"' });
    expect(result.current.value).toBe('');
    rerender({ read: '', etag: undefined });
    expect(result.current.value).toBe('');
    expect(result.current.edited).toBe(false);
  });

  it('shows a value put in by an operation until the read changes, also after a save', async () => {
    const { result, rerender } = versioned();
    act(() => result.current.set('typed'));
    await act(async () =>
      result.current.hold(Promise.resolve(savedOver('"1"', '"2"'))),
    );
    rerender({ read: 'typed', etag: '"2"' });
    act(() => result.current.put('adopted'));
    expect(result.current.value).toBe('adopted');
    rerender({ read: 'adopted', etag: '"3"' });
    rerender({ read: 'other', etag: '"4"' });
    expect(result.current.value).toBe('other');
  });
});
