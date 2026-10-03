import type { Client } from '@itera/api-contract/create-client';
import * as sdk from '@itera/api-contract/client';
import {
  requestOf,
  type OperationName,
  type PlainInput,
  type PlainOutput,
} from '@itera/api-contract/requests';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useApiClient } from './api-provider';
import { failureOf } from './failure';
import { saveFailedToast } from './save-failed';

/** What running an operation gives back: its value, or that it did not go through. */
export type Outcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false };

/**
 * Spinners wait this long: an operation that ends sooner shows none
 * (DESIGN.md Spinner, docs/design/foundations.md Loading).
 */
export const LOADING_DELAY = 300;

/**
 * One operation of packages/application, by its name, sent as its request
 * of the contract (`requestOf`, ADR 0006 経路の形): `useOperation('renameArea')`,
 * then `run({ areaId, name })`. An operation without input is `run()`.
 *
 * - While one is being sent, `run` sends nothing more and gives back
 *   `{ ok: false }` (a double press, a key held down).
 * - When it went through, every read is read again before `run` resolves
 *   (query-client.ts), so the screen has the new records by then.
 * - When it did not, the danger Toast says so and `run` gives back
 *   `{ ok: false }` (save-failed.ts). When it may have been saved after all
 *   (a version conflict, the server or the network failed), every read is
 *   read again before the Toast. Without a session there is no Toast: the
 *   person is sent to sign in.
 * - `pending` is true while it is being sent (block the control), and
 *   `loading` once that has lasted `LOADING_DELAY` (show the spinner and
 *   its words: Button `loading`, IconButton `loading`).
 */
export function useOperation<N extends OperationName>(name: N) {
  const client = useApiClient();
  const toast = useToast();
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [name],
    mutationFn: (input: PlainInput<N>) => sendOperation(client, name, input),
  });
  // A ref, not `isPending`: a second press can come before the render.
  const sending = useRef(false);
  const run = useCallback(
    async (...[input]: Args<N>): Promise<Outcome<PlainOutput<N>>> => {
      if (sending.current) return { ok: false };
      sending.current = true;
      try {
        return {
          ok: true,
          value: await mutateAsync(input as PlainInput<N>),
        };
      } catch (error) {
        const failed = saveFailedToast(failureOf(error));
        if (failed !== undefined) toast.show(failed);
        return { ok: false };
      } finally {
        sending.current = false;
      }
    },
    [mutateAsync, toast],
  );
  return { run, pending: isPending, loading: useDelayed(isPending) };
}

/** `run`'s arguments: the input, none for an operation without one. */
type Args<N extends OperationName> =
  PlainInput<N> extends undefined ? [] : [input: PlainInput<N>];

/**
 * Sends an operation as its request with the generated client's function
 * of the surface. Throws the response's error when it did not go through.
 */
async function sendOperation<N extends OperationName>(
  client: Client,
  name: N,
  input: PlainInput<N>,
): Promise<PlainOutput<N>> {
  const { operationId, ...parts } = requestOf(name, input);
  const send = sdk[operationId] as (
    options: object,
  ) => Promise<{ readonly data: unknown }>;
  const { data } = await send({ ...parts, client, throwOnError: true });
  return data as PlainOutput<N>;
}

/** True once `on` has stayed true for `LOADING_DELAY`. */
function useDelayed(on: boolean): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setLate(true), LOADING_DELAY);
    return () => {
      clearTimeout(timer);
      setLate(false);
    };
  }, [on]);
  return on && late;
}
