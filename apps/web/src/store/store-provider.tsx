import {
  createContext,
  use,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { RecordStore, StoreSnapshot } from '@itera/application';

const StoreContext = createContext<RecordStore | null>(null);

function StoreProvider({
  store,
  children,
}: {
  store: RecordStore;
  children: ReactNode;
}) {
  return <StoreContext value={store}>{children}</StoreContext>;
}

/**
 * What a screen still on the store (#274〜#276) throws when the API is the
 * data source: there is no RecordStore then (ADR 0005). #277 removes it.
 */
class NotOnContractError extends Error {
  constructor() {
    super('This screen reads the RecordStore, which the API has not.');
    this.name = 'NotOnContractError';
  }
}

function useRecordStore(): RecordStore {
  const store = use(StoreContext);
  if (store === null) throw new NotOnContractError();
  return store;
}

/** The records and the clock. Re-renders after every successful change. */
function useStoreSnapshot(): StoreSnapshot {
  const store = useRecordStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export { NotOnContractError, StoreProvider, useRecordStore, useStoreSnapshot };
