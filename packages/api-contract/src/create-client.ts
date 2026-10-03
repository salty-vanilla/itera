// `@itera/api-contract/create-client`: makes another fetch client of the
// contract (the web app makes one per data source, the API or the browser
// mock; ADR 0005). Apart from `./client`, whose functions are the
// contract's operations and reads, and nothing else.
export { createClient, createConfig } from './generated/client';
export type { Client, Config } from './generated/client';
