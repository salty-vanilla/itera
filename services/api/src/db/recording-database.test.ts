import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createRecordingDatabase } from './recording-database';

describe('createRecordingDatabase', () => {
  it('records single statements and each statement of a batch', async () => {
    const { db, queries } = createRecordingDatabase();
    await db.run(sql`select 1`);
    await db.batch([db.run(sql`select 2`), db.run(sql`select 3`)]);
    expect(queries).toEqual(['select 1', 'select 2', 'select 3']);
  });
});
