import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations only. They are applied with wrangler
// (`pnpm db:migrate:local`), which reads the same `migrations` directory.
// `pnpm check` runs drizzle-kit from a temporary directory and repeats these
// options on its command line (tooling/checks/migrations.mjs). Change both.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
