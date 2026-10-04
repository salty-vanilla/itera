import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * The fields whose typing is not in the records after a save of it failed
 * (useDraftField `unsaved`, #332). Leaving the screen would lose it: the app
 * asks first (app/leave-guard.tsx), and the Task detail before it closes.
 */
type UnsavedTyping = {
  /**
   * `field` has typing that is not saved; again is the same. `within`: the
   * search keys of a layer over the screen it is drawn in (the Task
   * detail's `task`), which it goes with.
   */
  mark(field: object, within: readonly string[]): void;
  /** `field`'s typing is saved, dropped, or gone with the field. */
  unmark(field: object): void;
  /** Whether any field has typing that is not saved. */
  has(): boolean;
  /** The layers the fields with typing not saved are drawn in. */
  within(): ReadonlySet<string>;
  /** Called whenever `has` may have changed. */
  subscribe(listener: () => void): () => void;
};

function createUnsavedTyping(): UnsavedTyping {
  const fields = new Map<object, readonly string[]>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    mark(field, within) {
      if (fields.has(field)) return;
      fields.set(field, within);
      changed();
    },
    unmark(field) {
      if (fields.delete(field)) changed();
    },
    has: () => fields.size > 0,
    within: () => new Set([...fields.values()].flat()),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const UnsavedTypingContext = createContext<UnsavedTyping | null>(null);
/** The search keys of the layers a field is drawn in (`mark`'s `within`). */
const LayerContext = createContext<readonly string[]>([]);

/**
 * A layer over the screen, opened by the search key `searchKey` (the Task
 * detail by `task`): its fields go when it closes, and stay while the
 * screen under it changes nothing else.
 */
function UnsavedTypingLayer({
  searchKey,
  children,
}: {
  searchKey: string;
  children: ReactNode;
}) {
  const outer = useContext(LayerContext);
  const layers = useMemo(() => [...outer, searchKey], [outer, searchKey]);
  return (
    <LayerContext.Provider value={layers}>{children}</LayerContext.Provider>
  );
}

/** The search keys of the layers the calling field is drawn in. */
function useUnsavedTypingLayers(): readonly string[] {
  return useContext(LayerContext);
}

/** The app's fields with typing not saved. Without it, none are counted. */
function UnsavedTypingProvider({
  value,
  children,
}: {
  value: UnsavedTyping;
  children: ReactNode;
}) {
  return (
    <UnsavedTypingContext.Provider value={value}>
      {children}
    </UnsavedTypingContext.Provider>
  );
}

/** The app's fields with typing not saved; `null` outside the provider. */
function useUnsavedTyping(): UnsavedTyping | null {
  return useContext(UnsavedTypingContext);
}

export {
  UnsavedTypingLayer,
  UnsavedTypingProvider,
  createUnsavedTyping,
  useUnsavedTyping,
  useUnsavedTypingLayers,
};
export type { UnsavedTyping };
