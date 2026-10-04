// The reads made stale after an operation are the contract's reads, all of
// them: a read added to the contract and not here would show old records
// after an operation without failing (reads.ts).
import * as queries from '@itera/api-contract/react-query';
import {
  notifyManager,
  QueryClient,
  QueryObserver,
} from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { until } from '@/test/other-device';
import { READS, readAgain } from './reads';

it('names every read of the contract, and nothing else', () => {
  // The generated query options, one per GET of the contract.
  const contract = Object.keys(queries)
    .filter((name) => name.endsWith('Options'))
    .map((name) => name.slice(0, -'Options'.length));
  expect(contract.length).toBeGreaterThan(0);
  expect([...READS].toSorted()).toEqual(contract.toSorted());
});

// What follows an operation sees what the reads answered (#341): a field
// that holds a value sent until the read changes would otherwise take an
// earlier save's read for the last one's, and drop what was chosen after it.
it('resolves once the components on screen are told the answer', async () => {
  const queryClient = new QueryClient();
  let saved = 'before';
  const observer = new QueryObserver(queryClient, {
    queryKey: [{ _id: 'getBacklog' }],
    queryFn: () => Promise.resolve(saved),
  });
  // As a component is told (useQuery): later, by `notifyManager`.
  let shown: string | undefined;
  const unsubscribe = observer.subscribe(
    notifyManager.batchCalls(() => {
      shown = observer.getCurrentResult().data;
    }),
  );
  await until(() => expect(shown).toBe('before'));
  saved = 'after';
  await readAgain(queryClient);
  expect(shown).toBe('after');
  unsubscribe();
});
