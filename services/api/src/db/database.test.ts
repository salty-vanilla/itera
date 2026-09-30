import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { describe, expectTypeOf, it } from 'vitest';
import type { Database, Schema } from './database';

// Checked by `pnpm typecheck` (tsc); the test body does nothing at runtime.
describe('Database', () => {
  it('accepts D1 (default), libSQL and sqlite-proxy (tests)', () => {
    expectTypeOf<DrizzleD1Database<Schema>>().toExtend<Database>();
    expectTypeOf<LibSQLDatabase<Schema>>().toExtend<Database>();
    expectTypeOf<SqliteRemoteDatabase<Schema>>().toExtend<Database>();
  });
});
