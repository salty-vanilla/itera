import type { ToastOptions } from '@/components/ui/toast';
import type { Failure } from './failure';

// The Toasts for an operation that did not go through, by what the failure
// says about the records (owner decision 2026-10-03, Issue #272). The
// failure's message is for developers, so the screen writes its own words.

/**
 * Refused before anything was saved: the request does not match (400), the
 * Origin (403), a record that is not there (404), the body's size (413), or
 * the domain's rules and the person's settings (422).
 */
export const SAVE_FAILED: ToastOptions = {
  kind: 'save-failed',
  tone: 'danger',
  title: '保存できませんでした',
  description: '記録は変わっていません。内容を確かめてもう一度試してください。',
};

/**
 * It may have been saved: another write came first (409, which also comes
 * back when the answer to a write that was made is lost, ADR 0006), the
 * server failed, the network, or an answer this client does not know. So it
 * does not say the records are as they were: the reads are read again
 * first (query-client.ts), and the person looks at them.
 */
export const SAVE_UNKNOWN: ToastOptions = {
  kind: 'save-failed',
  tone: 'danger',
  title: '保存できたか分かりませんでした',
  description: '記録が変わったかもしれません。最新の記録を見てください。',
};

/** The Toast for a failed operation; none without a session (sign-in). */
export function saveFailedToast(failure: Failure): ToastOptions | undefined {
  switch (failure.kind) {
    case 'unauthenticated':
      return undefined;
    case 'refused':
      return SAVE_FAILED;
    case 'revisionConflict':
    case 'failed':
      return SAVE_UNKNOWN;
  }
}
