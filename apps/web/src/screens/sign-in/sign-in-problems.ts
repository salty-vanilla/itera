import type { NoticeTone } from '@/components/ui/notice';

// What the sign-in screen says when signing in did not go through
// (docs/design/content.md). Google's sign-in comes back with `?error=` and
// a code (ADR 0004 認証の構成): the client relies on the code alone, never
// on `error_description`.

export interface SignInProblem {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly body?: string;
}

/** The person left Google's consent screen without allowing (OAuth 2.0). */
const GOOGLE_CANCELLED = 'access_denied';

/** The address is not on the list of who may sign up (ADR 0004, #32). */
const SIGN_UP_NOT_ALLOWED = 'SIGN_UP_NOT_ALLOWED';

const googleFailed: SignInProblem = {
  tone: 'danger',
  title: 'Google でサインインできませんでした',
  body: 'もう一度試してください。',
};

export const signInProblem = {
  google(code: string): SignInProblem {
    if (code === GOOGLE_CANCELLED)
      return { tone: 'info', title: 'Google でのサインインを取り消しました' };
    if (code === SIGN_UP_NOT_ALLOWED)
      return {
        tone: 'danger',
        title: 'この Google アカウントでは使えません',
        body: '別の Google アカウントでサインインしてください。',
      };
    return googleFailed;
  },
  /** The request to start Google's sign-in failed (server or network). */
  googleNotStarted: googleFailed,
  /** The server did not accept the passkey, or failed. */
  passkey: {
    tone: 'danger',
    title: 'パスキーでサインインできませんでした',
    body: '別のパスキーか、Google でサインインしてください。',
  } satisfies SignInProblem,
};
