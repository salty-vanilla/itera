import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDraftField } from './use-draft-field';

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
