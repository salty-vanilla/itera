// The contract's surfaces and reads the API answers (#266 完了条件, #295,
// #270): every surface is routed at its method and path, and every read is
// answered. That the tables have every surface and read of the contract,
// at its path, is packages/api-contract's requests.test.ts (#350).
import * as sdk from '@itera/api-contract/client';
import {
  readSurfaces,
  settingsSurface,
  surfaces,
} from '@itera/api-contract/requests';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createRecordingDatabase } from '../db/recording-database';
import { testDependencies } from '../test-env';
import { honoPath } from './operations';

/** The one write that is not an operation (requests.ts). */
const settingsWrite = 'setSettings';

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

describe('the settings write', () => {
  it('is routed at its surface’s method and path', () => {
    expect(contractRoute(settingsWrite)).toBe(
      `${settingsSurface.method} ${honoPath(settingsSurface.url)}`,
    );
    expect(routes()).toContain(
      `${settingsSurface.method} /api${settingsSurface.url}`,
    );
  });
});

describe('reads', () => {
  it('are each routed at their path, and `getMe` at its own', () => {
    const routed = routes();
    for (const surface of Object.values(readSurfaces))
      expect(routed).toContain(`GET /api${honoPath(surface.url)}`);
    expect(contractRoute('getMe')).toBe('GET /me');
    expect(routed).toContain('GET /api/me');
  });
});
