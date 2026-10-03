// For tests only (not exported): a memory store as the browser makes it.
import { createMemoryStore, type StoreSnapshot } from './record-store';

export function memoryStore(snapshot: StoreSnapshot) {
  return createMemoryStore(snapshot, {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
}
