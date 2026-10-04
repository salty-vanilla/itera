import type { AnyRouter } from '@tanstack/react-router';

/**
 * Where a request without a session sends the person: the sign-in screen,
 * with the screen they were on to come back to after signing in
 * (`?redirect=`). Google's sign-in comes back here too when it fails, with
 * `&error=<code>` (#278).
 */
export const SIGN_IN_PATH = '/sign-in';

/** Where signing in goes when there is no screen to come back to. */
const HOME_PATH = '/today';

export function signInHref(from: string): string {
  return `${SIGN_IN_PATH}?${new URLSearchParams({ redirect: from })}`;
}

/**
 * The screen to open after signing in: `redirect` when it is a path of the
 * app's own (not the sign-in screen, not the API), else Today. The value
 * comes from the URL, so a link from elsewhere must not send the person to
 * another site. The path is checked as it comes out of the URL parser too:
 * it removes `.` and `..` segments, which can leave `//host`
 * (`/.//host`). The same rule as Better Auth's for a relative
 * `callbackURL`: no leading `//`, no backslash, no encoded slash or
 * backslash in the path.
 */
export function returnPath(redirect: unknown): string {
  if (typeof redirect !== 'string' || !redirect.startsWith('/'))
    return HOME_PATH;
  const url = new URL(redirect, 'http://app.invalid');
  if (url.origin !== 'http://app.invalid') return HOME_PATH;
  const path = url.pathname;
  if (path.startsWith('//') || path.includes('\\') || /%2f|%5c/i.test(path))
    return HOME_PATH;
  const screen = path.toLowerCase().replace(/\/+$/, '');
  if (
    screen === SIGN_IN_PATH ||
    screen === '/api' ||
    screen.startsWith('/api/')
  )
    return HOME_PATH;
  return `${path}${url.search}${url.hash}`;
}

/**
 * The way in for a request without a session (401): the sign-in screen,
 * with the screen the person was on to come back to. Once, however many
 * requests failed.
 */
export function sendToSignIn(router: Pick<AnyRouter, 'state' | 'navigate'>) {
  const { pathname, href } = router.state.location;
  if (pathname === SIGN_IN_PATH) return;
  void router.navigate({ href: signInHref(href), replace: true });
}
