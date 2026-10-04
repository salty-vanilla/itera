import { createContext, useContext, type ReactNode } from 'react';

/**
 * The fields whose typing is not in the records after a save of it failed
 * (useDraftField `unsaved`, #332). Leaving the screen would lose it: the app
 * asks first (app/leave-guard.tsx), and the Task detail before it closes.
 */
type UnsavedTyping = {
  /** `field` has typing that is not saved; again is the same. */
  mark(field: object): void;
  /** `field`'s typing is saved, dropped, or gone with the field. */
  unmark(field: object): void;
  /** Whether any field has typing that is not saved. */
  has(): boolean;
  /** Called whenever `has` may have changed. */
  subscribe(listener: () => void): () => void;
};

function createUnsavedTyping(): UnsavedTyping {
  const fields = new Set<object>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    mark(field) {
      if (fields.has(field)) return;
      fields.add(field);
      changed();
    },
    unmark(field) {
      if (fields.delete(field)) changed();
    },
    has: () => fields.size > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const UnsavedTypingContext = createContext<UnsavedTyping | null>(null);

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

export { UnsavedTypingProvider, createUnsavedTyping, useUnsavedTyping };
export type { UnsavedTyping };
