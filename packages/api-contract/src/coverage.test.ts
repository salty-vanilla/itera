// Every operation and read of packages/application has its operation in
// the contract, and the contract has no other (#265 完了条件).
import * as application from '@itera/application';
import { describe, expect, it } from 'vitest';
import * as sdk from './client';

/** The contract's reads and the functions whose result each returns. */
const READS = {
  getOverview: application.appOverview,
  listAreas: application.areaList,
  getBacklog: application.backlogData,
  getSprintChoice: application.sprintChoice,
  getPlanning: application.planningData,
  getRunning: application.runningData,
  getToday: application.todayData,
  getDay: application.dayData,
  getRetro: application.retroData,
  getNextPlanning: application.nextPlanningOf,
};

/**
 * The contract's reads that are the server's own, not a read of the
 * application: the signed-in person and their settings (#266).
 */
const SERVER_READS = new Set(['getMe']);

/** The application's exports that are not reads of the person's records. */
const NOT_READS = new Set([
  'operations',
  // The system's own records: the server runs them (ADR 0005).
  'reviewEnded',
  'beginDay',
  // Running operations, and IDs.
  'createMemoryStore',
  'applyRecordChanges',
  'createIdSource',
  'parseId',
]);

const contract = Object.entries(sdk)
  .filter(([name, value]) => typeof value === 'function' && name !== 'client')
  .map(([name]) => name);

describe('the contract', () => {
  it('has an operation for each operation of the application, by its name', () => {
    const reads = new Set([...Object.keys(READS), ...SERVER_READS]);
    expect(contract.filter((name) => !reads.has(name)).toSorted()).toEqual(
      Object.keys(application.operations).toSorted(),
    );
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
