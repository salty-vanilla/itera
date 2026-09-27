import type { BatchItem, BatchResponse } from 'drizzle-orm/batch';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

export type Schema = typeof schema;

// The database handlers use. Any asynchronous Drizzle SQLite database with
// batch() fits: D1 (the default), libSQL, or sqlite-proxy in tests. Handlers
// never import a driver; the composition root picks one (ADR 0004).
export type Database = BaseSQLiteDatabase<'async', unknown, Schema> & {
  batch<U extends BatchItem<'sqlite'>, T extends Readonly<[U, ...U[]]>>(
    batch: T,
  ): Promise<BatchResponse<T>>;
};
