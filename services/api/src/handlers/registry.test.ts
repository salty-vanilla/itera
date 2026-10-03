// The contract's operations and reads the API answers, and the ones it does
// not yet (#266 完了条件): every one is listed in one or the other, so an
// operation of the contract without its route fails here.
import * as contract from '@itera/api-contract';
import * as sdk from '@itera/api-contract/client';
import { operations } from '@itera/application';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createRecordingDatabase } from '../db/recording-database';
import { testDependencies } from '../test-env';
import { operationBodies, unimplementedOperations } from './operations';
import { readRoutes, unimplementedReads } from './reads';

/** The contract's operationIds: the client's functions. */
const contractNames = Object.entries(sdk)
  .filter(([name, value]) => typeof value === 'function' && name !== 'client')
  .map(([name]) => name);

const operationNames = Object.keys(operations);
const readNames = contractNames.filter(
  (name) => !operationNames.includes(name),
);

/** The server's own reads, answered outside `readRoutes`. */
const serverReads = ['getMe'];

const capitalized = (name: string) => name[0]!.toUpperCase() + name.slice(1);

/** A generated schema of the contract by its name, or undefined. */
const schemaNamed = (name: string) =>
  (contract as Record<string, unknown>)[name];

/**
 * Each operationId's path in the contract (openapi.yaml, under `/api`), in
 * Hono's form: `/days/{date}` becomes `/days/:date`.
 */
const contractPaths = new Map(
  [
    ...readFileSync(
      decodeURIComponent(
        new URL(
          '../../../../packages/api-contract/openapi/openapi.yaml',
          import.meta.url,
        ).pathname,
      ),
      'utf8',
    ).matchAll(/^ {2}(\/\S*):\n {4}\$ref: '[^#]+#\/(\w+)'$/gm),
  ].map(([, path, name]) => [name!, path!.replace(/\{(\w+)\}/g, ':$1')]),
);

function routes() {
  const { db } = createRecordingDatabase();
  const app = createApp(
    testDependencies({
      database: () => db,
      authenticator: () => {
        throw new Error('not used');
      },
    }),
  );
  return app.routes.map(({ method, path }) => `${method} ${path}`);
}

describe('operations', () => {
  const implemented = Object.keys(operationBodies);

  it('are each implemented or listed as not yet, once', () => {
    expect([...implemented, ...unimplementedOperations].toSorted()).toEqual(
      operationNames.toSorted(),
    );
  });

  it("take the contract's body schema, by name", () => {
    for (const [name, body] of Object.entries(operationBodies)) {
      const schema = schemaNamed(`v${capitalized(name)}Body`);
      expect(body, name).toBe(schema ?? null);
    }
  });

  it('are routed at POST /api/operations/{name}', () => {
    const routed = routes();
    for (const name of implemented) {
      expect(routed).toContain(`POST /api/operations/${name}`);
    }
  });
});

describe('reads', () => {
  const implemented = Object.keys(readRoutes);

  it('are each implemented, listed as not yet, or the server’s own, once', () => {
    expect(
      [...implemented, ...unimplementedReads, ...serverReads].toSorted(),
    ).toEqual(readNames.toSorted());
  });

  it("are at the contract's paths, with its parameter schemas", () => {
    expect(contractPaths.size).toBe(contractNames.length);
    const routed = routes();
    for (const [name, route] of Object.entries(readRoutes)) {
      expect(route.path, name).toBe(contractPaths.get(name));
      expect(routed).toContain(`GET /api${route.path}`);
      expect(route.query, name).toBe(schemaNamed(`v${capitalized(name)}Query`));
      expect(route.params, name).toBe(schemaNamed(`v${capitalized(name)}Path`));
    }
    expect(contractPaths.get('getMe')).toBe('/me');
    expect(routed).toContain('GET /api/me');
  });
});
