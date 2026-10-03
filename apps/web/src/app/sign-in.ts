import type { AnyRouter } from '@tanstack/react-router';

/**
 * Where a request without a session sends the person: the sign-in screen
 * (#278 makes it, and may change the path and how the screen to go back to
 * is passed). `from` is the screen they were on, to come back to after
 * signing in.
 */
export const SIGN_IN_PATH = '/sign-in';

export function signInHref(from: string): string {
  return `${SIGN_IN_PATH}?${new URLSearchParams({ redirect: from })}`;
}

/**
 * The way in for a request without a session (401): the sign-in screen,
 * with the screen the person was on to come back to. Once, however many
 * requests failed. The screen itself is #278.
 */
export function sendToSignIn(router: Pick<AnyRouter, 'state' | 'navigate'>) {
  const { pathname, href } = router.state.location;
  if (pathname === SIGN_IN_PATH) return;
  void router.navigate({ href: signInHref(href), replace: true });
}
