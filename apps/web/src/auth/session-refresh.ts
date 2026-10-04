// Keeping the session (ADR 0004 認証の構成): the API's reads and
// operations only read it, and `/api/auth/get-session` is the one call
// that extends it. Without that call it ends 7 days after it was last
// extended, so the app makes it when it starts, when the person comes back
// to it, and every so often while it stays open.

/** How often at most the session is asked for: an hour. */
export const SESSION_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export interface SessionRefreshOptions {
  /** Asks for the session: `true` when there is one. */
  readonly refresh: () => Promise<boolean>;
  /** There is no session any more (signed out elsewhere, or it ended). */
  readonly onNoSession: () => void;
  readonly now?: () => number;
  readonly intervalMs?: number;
}

/**
 * Asks for the session now, then again when the page is shown after
 * `intervalMs` or more, and every `intervalMs` while it is shown. A failed
 * request (the server or the network) is let go: the next one tries again,
 * and a request without a session meets the API's 401 meanwhile. Returns
 * the function that stops it.
 */
export function startSessionRefresh({
  refresh,
  onNoSession,
  now = Date.now,
  intervalMs = SESSION_REFRESH_INTERVAL_MS,
}: SessionRefreshOptions): () => void {
  let last = -Infinity;
  let stopped = false;
  const ask = () => {
    last = now();
    refresh().then(
      (hasSession) => {
        if (!hasSession && !stopped) onNoSession();
      },
      () => {},
    );
  };
  const askIfDue = () => {
    if (document.visibilityState === 'visible' && now() - last >= intervalMs)
      ask();
  };
  ask();
  document.addEventListener('visibilitychange', askIfDue);
  const timer = setInterval(askIfDue, intervalMs);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', askIfDue);
    clearInterval(timer);
  };
}
