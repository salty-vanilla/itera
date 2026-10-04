import type { ToastOptions } from '@/components/ui/toast';
import type { Failure } from './failure';

// The Toasts for an operation that did not go through, by what the failure
// says about the records (owner decision 2026-10-03, Issue #272). The
// failure's message is for developers, so the screen writes its own words.

/**
 * The kind of every Toast of a failed operation: the latest takes the place
 * of the one showing (DESIGN.md Toast).
 */
export const SAVE_FAILED_KIND = 'save-failed';

/**
 * Not saved: the request does not match (400), the Origin (403), a record
 * that is not there (404), another write came first (409), the body's size
 * (413), or the domain's rules and the person's settings (422).
 */
export const SAVE_FAILED: ToastOptions = {
  kind: SAVE_FAILED_KIND,
  tone: 'danger',
  title: '保存できませんでした',
  description: '記録は変わっていません。内容を確かめてもう一度試してください。',
};

/**
 * It may have been saved: the server failed, the network, or an answer this
 * client does not know, also after the write was sent again with its key
 * (use-operation.ts). So it does not say the records are as they were: the
 * reads are read again first (query-client.ts), and the person looks at
 * them, or sends it again (its action, `RETRY_LABEL`: もう一度保存). A later
 * write that goes through closes it (use-operation.ts).
 */
export const SAVE_UNKNOWN: ToastOptions = {
  kind: SAVE_FAILED_KIND,
  tone: 'danger',
  title: '保存できたかわかりませんでした',
  description: '記録が変わったかもしれません。最新の記録を見てください。',
};

/**
 * Not saved: the record had changed on another device since it was read
 * (412, #321). Said by its reason (content.md 保存の失敗): the reads are
 * read again, and the person decides on the record as it now is.
 */
export const SAVE_STALE: ToastOptions = {
  kind: SAVE_FAILED_KIND,
  tone: 'danger',
  title: 'ほかの端末で変わっていました',
  description: '最新の記録を見て、もう一度試してください。',
};

/**
 * `SAVE_STALE` for what the person typed in a field: the field keeps it
 * (useDraftField), and saving it again puts it over the record as it now is.
 */
export const SAVE_STALE_TYPED: ToastOptions = {
  ...SAVE_STALE,
  description:
    '書いた内容は残っています。もう一度保存すると、この内容になります。',
};

/** The action of `SAVE_UNKNOWN`: the same write sent again, with its key. */
export const RETRY_LABEL = 'もう一度保存';

/**
 * The Toast for a failed operation; none without a session (sign-in).
 * `typed`: the write saves what the person typed in a field, which stays
 * there when it fails.
 * `retry` sends the same write again with its key; only a write that may
 * have been saved offers it (DESIGN.md Toast, content.md 保存の失敗): one
 * that was not saved would be refused again, or mean something else.
 */
export function saveFailedToast(
  failure: Failure,
  retry: () => void,
  { typed = false }: { typed?: boolean } = {},
): ToastOptions | undefined {
  switch (failure.kind) {
    case 'unauthenticated':
      return undefined;
    case 'stale':
      return typed ? SAVE_STALE_TYPED : SAVE_STALE;
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
