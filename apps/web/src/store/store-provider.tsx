import {
  createContext,
  use,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { RecordStore, StoreSnapshot } from './record-store';

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

function useRecordStore(): RecordStore {
  const store = use(StoreContext);
  if (store === null) throw new Error('useRecordStore needs a StoreProvider.');
  return store;
}

/** The records and the clock. Re-renders after every successful change. */
function useStoreSnapshot(): StoreSnapshot {
  const store = useRecordStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export { StoreProvider, useRecordStore, useStoreSnapshot };
