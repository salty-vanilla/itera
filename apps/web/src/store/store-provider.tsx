import {
  createContext,
  use,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { RecordStore, StoreSnapshot } from '@itera/application';
import { useLocation } from '@tanstack/react-router';

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
 * What a screen still on the store (#273〜#276) throws when the API is the
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

/** The screens and the Issues that move them to the contract. */
const MOVES: Readonly<Record<string, string>> = {
  '/backlog': '#273',
  '/sprint': '#274',
  '/today': '#275',
  '/retro': '#276',
};

/**
 * In place of a screen still on the store, with the API as the data
 * source. For the developer, in English: not the product's words.
 */
function NotOnContract() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const issue = MOVES[pathname] ?? '#273〜#276';
  return (
    <p lang="en" className="p-6 text-body text-ink-muted">
      {`Not on the API yet: ${pathname} moves to the contract in ${issue}. Open it with the browser mock (pnpm --filter @itera/web dev).`}
    </p>
  );
}

/** The records and the clock. Re-renders after every successful change. */
function useStoreSnapshot(): StoreSnapshot {
  const store = useRecordStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export {
  NotOnContract,
  NotOnContractError,
  StoreProvider,
  useRecordStore,
  useStoreSnapshot,
};
