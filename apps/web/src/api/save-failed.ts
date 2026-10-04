import type { ToastOptions } from '@/components/ui/toast';
import type { Failure } from './failure';

// The Toasts for an operation that did not go through, by what the failure
// says about the records (owner decision 2026-10-03, Issue #272). The
// failure's message is for developers, so the screen writes its own words.

/**
 * Not saved: the request does not match (400), the Origin (403), a record
 * that is not there (404), another write came first (409), the body's size
 * (413), or the domain's rules and the person's settings (422).
 */
export const SAVE_FAILED: ToastOptions = {
  kind: 'save-failed',
  tone: 'danger',
  title: '保存できませんでした',
  description: '記録は変わっていません。内容を確かめてもう一度試してください。',
};

/**
 * It may have been saved: the server failed, the network, or an answer this
 * client does not know, also after the write was sent again with its key
 * (use-operation.ts). So it does not say the records are as they were: the
 * reads are read again first (query-client.ts), and the person looks at
 * them, or sends it again (its action, `RETRY_LABEL`: もう一度保存).
 */
export const SAVE_UNKNOWN: ToastOptions = {
  kind: 'save-failed',
  tone: 'danger',
  title: '保存できたかわかりませんでした',
  description: '記録が変わったかもしれません。最新の記録を見てください。',
};

/** The action of `SAVE_UNKNOWN`: the same write sent again, with its key. */
export const RETRY_LABEL = 'もう一度保存';

/**
 * The Toast for a failed operation; none without a session (sign-in).
 * `retry` sends the same write again with its key; only a write that may
 * have been saved offers it (DESIGN.md Toast, content.md 保存の失敗): one
 * that was not saved would be refused again, or mean something else.
 */
export function saveFailedToast(
  failure: Failure,
  retry: () => void,
): ToastOptions | undefined {
  switch (failure.kind) {
    case 'unauthenticated':
      return undefined;
    case 'refused':
    case 'revisionConflict':
      return SAVE_FAILED;
    case 'failed':
      return {
        ...SAVE_UNKNOWN,
        action: { label: RETRY_LABEL, onClick: retry },
      };
  }
}
