import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations only. They are applied with wrangler
// (`pnpm db:migrate:local`), which reads the same `migrations` directory.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
