import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
