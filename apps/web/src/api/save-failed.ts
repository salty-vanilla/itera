import type { ToastOptions } from '@/components/ui/toast';

/**
 * The Toast for an operation that did not go through: the domain refused
 * it, another write came first, or the server or the network failed. The
 * failure's message is for developers, so the screen writes its own words.
 */
export const SAVE_FAILED: ToastOptions = {
  kind: 'save-failed',
  tone: 'danger',
  title: '保存できませんでした',
  description: '記録は変わっていません。内容を確かめてもう一度試してください。',
};
