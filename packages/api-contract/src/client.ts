// The fetch client for the web app: one function per operation and read,
// calling `/api` on the same origin (ADR 0006). `client` is the default
// instance; `createClient` makes another one (the web app gives each data
// source, the API or the browser mock, its own).
export * from './generated/sdk.gen';
export { client } from './generated/client.gen';
export { createClient, createConfig } from './generated/client';
export type { Client, Config } from './generated/client';
