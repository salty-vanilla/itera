// The fetch client for the web app: one function per operation and read,
// calling `/api` on the same origin (ADR 0006).
export * from './generated/sdk.gen';
export { client } from './generated/client.gen';
