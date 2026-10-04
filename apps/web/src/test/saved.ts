import type { Saved } from '@/api/use-operation';

/**
 * A field's save that went through (#343): the record was at `from`, and
 * the save left it at `now`.
 */
export const savedOver = (from: string, now: string): Saved => ({
  ok: true,
  written: { over: [{ etag: from }], now: { etag: now } },
});
