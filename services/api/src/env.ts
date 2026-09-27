// CloudflareBindings is generated from wrangler.jsonc by `pnpm cf-typegen`
// (worker-configuration.d.ts). Do not write binding types by hand.
export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: {
    // WorkOS user ID (the access token's `sub`), set by requireAuth.
    userId: string;
  };
};
