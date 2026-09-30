import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { Database } from './database';
import * as schema from './schema';

const migrationsFolder = decodeURIComponent(
  new URL('../../migrations', import.meta.url).pathname,
);

// Test double: an in-memory SQLite database (libSQL, Node only) with the
// migrations in `migrations/` applied, the same files wrangler applies to D1.
// For tests that need rows to persist, unlike createRecordingDatabase.
export async function createMemoryDatabase() {
  const client = createClient({ url: ':memory:' });
  const libsql = drizzle(client, { schema });
  await migrate(libsql, { migrationsFolder });
  const db: Database = libsql;
  return { db, close: () => client.close() };
}
