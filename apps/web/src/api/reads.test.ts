// The reads made stale after an operation are the contract's reads, all of
// them: a read added to the contract and not here would show old records
// after an operation without failing (reads.ts).
import * as queries from '@itera/api-contract/react-query';
import { expect, it } from 'vitest';
import { READS } from './reads';

it('names every read of the contract, and nothing else', () => {
  // The generated query options, one per GET of the contract.
  const contract = Object.keys(queries)
    .filter((name) => name.endsWith('Options'))
    .map((name) => name.slice(0, -'Options'.length));
  expect(contract.length).toBeGreaterThan(0);
  expect([...READS].toSorted()).toEqual(contract.toSorted());
});
