import { timeoutManager, type ManagedTimerId } from '@tanstack/react-query';

/** Longer than any retry's wait: a query's gc (`gcTime`) is not held. */
const RETRY_WAITS_UNDER = 60_000;

/**
 * TanStack Query's timers, which the test holds while it says so (#343):
 * a read that failed is tried again when the test lets it, not after a
 * second of the machine's time. To be called once per test file, before a
 * QueryClient is made (`timeoutManager.setTimeoutProvider`): the timers it
 * does not hold are the platform's.
 */
export function heldQueryTimers() {
  const queue = new Map<number, () => void>();
  let holding = false;
  let next = 0;
  timeoutManager.setTimeoutProvider<ManagedTimerId>({
    setTimeout: (callback, delay) => {
      if (!holding || delay >= RETRY_WAITS_UNDER)
        return setTimeout(callback, delay) as unknown as ManagedTimerId;
      // Below zero: never one of the platform's.
      const id = --next;
      queue.set(id, callback);
      return id;
    },
    clearTimeout: (id) => {
      if (id !== undefined && queue.delete(Number(id))) return;
      clearTimeout(id as Parameters<typeof clearTimeout>[0]);
    },
    setInterval: (callback, delay) =>
      setInterval(callback, delay) as unknown as ManagedTimerId,
    clearInterval: (id) =>
      clearInterval(id as Parameters<typeof clearInterval>[0]),
  });
  return {
    /** Holds the timers made from now on. */
    hold() {
      holding = true;
    },
    /** How many are held. */
    get waiting() {
      return queue.size;
    },
    /**
     * Drops the ones held without running them, and holds none from now
     * on: after a test, its reads are not tried again.
     */
    reset() {
      holding = false;
      queue.clear();
    },
    /** Runs the ones held, and holds none from now on. */
    release() {
      holding = false;
      const held = [...queue.values()];
      queue.clear();
      for (const callback of held) callback();
    },
    /** Runs the ones held, and goes on holding. */
    fire() {
      const held = [...queue.values()];
      queue.clear();
      for (const callback of held) callback();
    },
  };
}
