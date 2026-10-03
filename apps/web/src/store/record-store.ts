// The screens' store until they move to the API's contract (#273〜#276):
// `@itera/application`'s memory store over a fixture state. New IDs are
// random TypeIDs (ADR 0004 ID の形式).
import {
  createMemoryStore as createApplicationStore,
  type RecordStore,
  type StoreSnapshot,
} from '@itera/application';

export type { Clock } from '@itera/application';
export type { RecordStore, StoreSnapshot };

export function createMemoryStore(initial: StoreSnapshot): RecordStore {
  return createApplicationStore(initial, {
    random: (bytes) => crypto.getRandomValues(bytes),
  });
}
