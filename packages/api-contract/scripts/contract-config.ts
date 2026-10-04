// What Hey API generates from the contract (ADR 0006). The output is
// committed; `pnpm contract:check` generates it again and fails on any
// difference. Run `pnpm contract:generate` after changing openapi/.
// generated.mjs bundles the files into one first, then calls Hey API with
// this; it is not a config file for the openapi-ts CLI, which would skip
// those steps.
import type { UserConfig } from '@hey-api/openapi-ts';

export const OUTPUT = 'src/generated';

/**
 * The generation from the bundled contract (one file: Hey API names the
 * schemas of other files by where they are, so it reads Redocly's bundle).
 */
export function contractConfig(bundle: string, output: string): UserConfig {
  return {
    input: bundle,
    output: {
      path: output,
      // src/index.ts, client.ts and react-query.ts choose what each
      // entry point exports, so services/api never loads React.
      entryFile: false,
    },
    logs: { level: 'warn' },
    plugins: [
      '@hey-api/typescript',
      // The server validates requests with these, and the tests validate
      // the reads' results.
      { name: 'valibot', definitions: true, requests: true, responses: true },
      '@hey-api/client-fetch',
      '@hey-api/sdk',
      '@tanstack/react-query',
    ],
  };
}
