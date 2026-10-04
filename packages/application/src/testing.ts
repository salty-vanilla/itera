// For tests only (not exported): a memory store as the browser makes it.
import { createMemoryStore, type StoreSnapshot } from './record-store';
import type { Records } from './records';
import { tagRecords } from './versions';

export function memoryStore(snapshot: StoreSnapshot) {
  return createMemoryStore(snapshot, {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
}

/** The records as a read takes them, every record at version 0. */
export const tagged = (records: Records) => tagRecords(records, new Map());
