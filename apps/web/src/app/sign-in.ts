import type { AnyRouter } from '@tanstack/react-router';
import { SIGN_IN_PATH, signInHref } from '@/api/sign-in-path';

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
