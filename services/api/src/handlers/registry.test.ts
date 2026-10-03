// The contract's surfaces and reads the API answers, and the operations and
// reads it does not yet (#266 完了条件, #295): every surface is routed at its
// method and path, and every read is answered or listed as not yet.
import * as contract from '@itera/api-contract';
import * as sdk from '@itera/api-contract/client';
import { surfaces } from '@itera/api-contract/requests';
import { operations } from '@itera/application';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createRecordingDatabase } from '../db/recording-database';
import { testDependencies } from '../test-env';
import { honoPath, unimplementedOperations } from './operations';
import { readRoutes, unimplementedReads } from './reads';

/** The contract's operationIds: the client's functions. */
const contractNames = Object.entries(sdk)
  .filter(([name, value]) => typeof value === 'function' && name !== 'client')
  .map(([name]) => name);

const readNames = contractNames.filter(
  (name) => !Object.hasOwn(surfaces, name),
);

/** The server's own reads, answered outside `readRoutes`. */
const serverReads = ['getMe'];

const capitalized = (name: string) => name[0]!.toUpperCase() + name.slice(1);

/** A generated schema of the contract by its name, or undefined. */
const schemaNamed = (name: string) =>
  (contract as Record<string, unknown>)[name];

/**
 * The method and path the generated client sends for an operationId, in
 * Hono's form: `/days/{date}` becomes `/days/:date`.
 */
function contractRoute(name: string) {
  let route = '';
  const client = Object.fromEntries(
    ['get', 'post', 'put', 'patch', 'delete'].map((method) => [
      method,
      (options: { url: string }) => {
        route = `${method.toUpperCase()} ${honoPath(options.url)}`;
      },
    ]),
  );
  (sdk as unknown as Record<string, (o: object) => void>)[name]!({ client });
  return route;
}

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
  it('are each answered or listed as not yet, once', () => {
    expect(new Set(unimplementedOperations).size).toBe(
      unimplementedOperations.length,
    );
    for (const name of unimplementedOperations)
      expect(Object.keys(operations)).toContain(name);
  });

  it("are routed at their surfaces' methods and paths", () => {
    const routed = routes();
    for (const [name, surface] of Object.entries(surfaces)) {
      const route = contractRoute(name);
      expect(route, name).toBe(`${surface.method} ${honoPath(surface.url)}`);
      const [method, path] = route.split(' ');
      expect(routed).toContain(`${method} /api${path}`);
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
    const routed = routes();
    for (const [name, route] of Object.entries(readRoutes)) {
      expect(contractRoute(name), name).toBe(`GET ${route.path}`);
      expect(routed).toContain(`GET /api${route.path}`);
      expect(route.query, name).toBe(schemaNamed(`v${capitalized(name)}Query`));
      expect(route.params, name).toBe(schemaNamed(`v${capitalized(name)}Path`));
    }
    expect(contractRoute('getMe')).toBe('GET /me');
    expect(routed).toContain('GET /api/me');
  });
});
