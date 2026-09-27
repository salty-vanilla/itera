import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { Database } from './database';
import * as schema from './schema';

// Test double: a real Drizzle database (sqlite-proxy) that records the SQL it
// is asked to run, including each statement of a batch(), and returns no
// rows. Needs neither D1 nor a SQLite driver.
export function createRecordingDatabase() {
  const queries: string[] = [];
  const db: Database = drizzle(
    async (query) => {
      queries.push(query);
      return { rows: [] };
    },
    async (batch) =>
      batch.map(({ sql }) => {
        queries.push(sql);
        return { rows: [] };
      }),
    { schema },
  );
  return { db, queries };
}
