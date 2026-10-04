// Every operation and read of packages/application is in the contract, and
// the contract has nothing else (#265 完了条件): the operations through the
// surfaces of requests.ts (#295), the reads one each.
import * as application from '@itera/application';
import { describe, expect, it } from 'vitest';
import * as sdk from './client';
import { requestOf, settingsSurface, surfaces } from './requests';
import { OPERATION_EXAMPLES } from './testing';

/** The contract's reads and the functions whose result each returns. */
const READS = {
  listAreas: application.areaList,
  getBacklog: application.backlogData,
  listSprints: application.sprintList,
  getSprint: application.sprintView,
  listSprintCandidates: application.sprintCandidates,
  getSprintRetro: application.sprintRetro,
  getDay: application.dayView,
  // The person and their settings are the server's (#266); the Sprints
  // they have now are this read's (#295 R1).
  getMe: application.currentSprints,
};

/** The application's exports that are not reads of the person's records. */
const NOT_READS = new Set([
  'operations',
  // The system's own records: the server runs them (ADR 0005).
  'catchUp',
  // The person's settings: the server's, with the first write (requests.ts).
  'settingsChange',
  // Running operations, and IDs.
  'createMemoryStore',
  'applyRecordChanges',
  'mergeChanges',
  'createIdSource',
  'parseId',
  // The versions of the records and the conditions of writes (#321).
  'etagOf',
  'tagRecords',
  'nextVersions',
  'checkCondition',
  'currentCondition',
  'etagAfter',
  'isConditional',
]);

const contract = Object.entries(sdk)
  .filter(([name, value]) => typeof value === 'function' && name !== 'client')
  .map(([name]) => name);

describe('the contract', () => {
  it('has a surface for each operation of the application, and no other write', () => {
    const reads = new Set(Object.keys(READS));
    // The settings are made before there are records for an operation to
    // run on: the one write that is not an operation (requests.ts).
    expect(contract.filter((name) => !reads.has(name)).toSorted()).toEqual(
      [...Object.keys(surfaces), 'setSettings'].toSorted(),
    );
    expect(settingsSurface.url).toBe('/me/settings');
    expect(Object.keys(OPERATION_EXAMPLES).toSorted()).toEqual(
      Object.keys(application.operations).toSorted(),
    );
    for (const [name, [input]] of Object.entries(OPERATION_EXAMPLES)) {
      expect(Object.keys(surfaces), name).toContain(
        requestOf(name as never, input as never).operationId,
      );
    }
  });

  it('has a read for each read of the application', () => {
    const covered = new Set<unknown>(Object.values(READS));
    const reads = Object.entries(application).filter(
      ([name, value]) => typeof value === 'function' && !NOT_READS.has(name),
    );
    expect(reads.length).toBeGreaterThan(0);
    for (const [name, read] of reads)
      expect(covered.has(read), name).toBe(true);
    for (const name of Object.keys(READS)) expect(contract).toContain(name);
  });
});
