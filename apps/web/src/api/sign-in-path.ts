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
