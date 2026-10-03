import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSessionRefresh } from './session-refresh';

const HOUR = 60 * 60 * 1000;

let visibility: DocumentVisibilityState;
beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function show(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

function start(answer: () => Promise<boolean> = async () => true) {
  const refresh = vi.fn(answer);
  const onNoSession = vi.fn();
  const stop = startSessionRefresh({
    refresh,
    onNoSession,
    now: () => Date.now(),
  });
  return { refresh, onNoSession, stop };
}

describe('startSessionRefresh', () => {
  it('asks for the session when the app starts', () => {
    const { refresh, stop } = start();
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
  });

  it('asks again when the person comes back an hour or more later, not sooner', () => {
    const { refresh, stop } = start();
    show('hidden');
    vi.setSystemTime(Date.now() + HOUR - 1);
    show('visible');
    expect(refresh).toHaveBeenCalledTimes(1);
    show('hidden');
    vi.setSystemTime(Date.now() + 1);
    show('visible');
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });

  it('asks every hour while the page is shown, and not while hidden', () => {
    const { refresh, stop } = start();
    vi.advanceTimersByTime(HOUR);
    expect(refresh).toHaveBeenCalledTimes(2);
    show('hidden');
    vi.advanceTimersByTime(3 * HOUR);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });

  it('sends the person to sign in when there is no session', async () => {
    const { onNoSession, stop } = start(async () => false);
    await vi.waitFor(() => expect(onNoSession).toHaveBeenCalledTimes(1));
    stop();
  });

  it('lets a failed request go: the next one tries again', async () => {
    const { refresh, onNoSession, stop } = start(async () => {
      throw new Error('offline');
    });
    await Promise.resolve();
    expect(onNoSession).not.toHaveBeenCalled();
    vi.advanceTimersByTime(HOUR);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stops asking once stopped', () => {
    const { refresh, stop } = start();
    stop();
    vi.advanceTimersByTime(2 * HOUR);
    show('visible');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
