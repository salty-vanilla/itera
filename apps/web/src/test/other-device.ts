import { createClient, createConfig } from '@itera/api-contract/create-client';
import { idempotencyKeyHeaders } from '@itera/api-contract/requests';
import type { RecordStore } from '@itera/application';
import { waitFor } from '@testing-library/react';
import { apiBaseUrl } from '@/api/create-api';
import { createMock } from '@/mock/mock-api';

/**
 * A client of the contract on the same records as the screen under test:
 * what another device saves (#324). Its requests are not the screen's, so
 * they do not appear in the requests a test keeps.
 */
export function otherDevice(store: RecordStore) {
  return createClient(
    createConfig({
      baseUrl: apiBaseUrl(),
      fetch: (input, init) => createMock(store).fetch(new Request(input, init)),
    }),
  );
}

/**
 * The headers of another device's write: a new Idempotency-Key (ADR 0006
 * 冪等キー), which every write carries. The mock does not check it.
 */
export const newWrite = () => idempotencyKeyHeaders(crypto.randomUUID());

/**
 * The person comes back to the screen: the tab is visible again, and what
 * the screen reads is read again, as TanStack Query does on focus.
 */
export function comeBack() {
  window.dispatchEvent(new Event('visibilitychange'));
}

/** Waits until `check` holds. */
export const until = (check: () => void) => waitFor(check, { timeout: 4000 });
