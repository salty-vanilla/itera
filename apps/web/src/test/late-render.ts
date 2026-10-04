/**
 * A setup file for a run of the screen tests in which React renders late
 * (#401): `ITERA_LATE_RENDER=<ms> pnpm --filter @itera/web exec vitest run`
 * (vitest.config.ts). An update outside the test's `act`, such as the one an
 * operation's answer makes, is rendered by React's scheduler, which in Node
 * waits on `setImmediate`. Under load that can come after user-event's last
 * `setTimeout(0)`, so a test that looks right after the person's action sees
 * the screen before the answer is drawn. Here it always comes that late: a
 * test that does not wait for what it looks for fails every time, rather
 * than now and then.
 *
 * Read before React is: its scheduler keeps the `setImmediate` it finds. The
 * timer is the platform's, kept before a test can fake the timers.
 */
const delay = Number(process.env.ITERA_LATE_RENDER);
const platformSetTimeout = globalThis.setTimeout;

globalThis.setImmediate = ((
  callback: (...args: unknown[]) => void,
  ...args: unknown[]
) =>
  platformSetTimeout(
    () => callback(...args),
    delay,
  )) as unknown as typeof setImmediate;
