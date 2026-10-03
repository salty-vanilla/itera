import type { Client } from '@itera/api-contract/create-client';
import * as sdk from '@itera/api-contract/client';
import {
  requestOf,
  type OperationName,
  type PlainInput,
  type PlainOutput,
} from '@itera/api-contract/requests';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/toast';
import { useDelayed } from '@/lib/use-delayed';
import { useApiClient } from './api-provider';
import { failureOf } from './failure';
import { saveFailedToast } from './save-failed';

/** What running an operation gives back: its value, or that it did not go through. */
export type Outcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false };

/** The mutation scope every operation shares: they run one after another. */
const OPERATION_SCOPE = 'operations';

/**
 * One operation of packages/application, by its name, sent as its request
 * of the contract (`requestOf`, ADR 0006 経路の形): `useOperation('renameArea')`,
 * then `run({ areaId, name })`. An operation without input is `run()`.
 *
 * - While one is being sent, `run` sends nothing more and gives back
 *   `{ ok: false }` (a double press, a key held down). For a field that
 *   saves as it is edited, where a second `run` carries another value, pass
 *   `{ whileSending: 'wait' }`: it is sent when the one before is done, in
 *   order, and `run` resolves with its own outcome.
 * - Operations never overlap, whichever hook sent them: they share one
 *   scope, so a write is not made while another is, which the API would
 *   answer with a version conflict (ADR 0004 同時の書き込み).
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
export function useOperation<N extends OperationName>(
  name: N,
  options: { whileSending?: 'drop' | 'wait' } = {},
) {
  return useSend<PlainInput<N>, PlainOutput<N>>(
    name,
    (client, input) => sendOperation(client, name, input),
    options,
  );
}

/**
 * What `useOperation` does for one write of the contract, for any request
 * (the person's settings are a write that no operation of
 * packages/application takes, `useSettings`): the sending, the Toast of a
 * failure, the reads read again. `key` names the mutation.
 */
export function useSend<Input, Output>(
  key: string,
  send: (client: Client, input: Input) => Promise<Output>,
  { whileSending = 'drop' }: { whileSending?: 'drop' | 'wait' } = {},
) {
  const client = useApiClient();
  const toast = useToast();
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [key],
    mutationFn: (input: Input) => send(client, input),
    scope: { id: OPERATION_SCOPE },
  });
  // A ref, not `isPending`: a second press can come before the render.
  const sending = useRef(false);
  const run = useCallback(
    async (...[input]: Args<Input>): Promise<Outcome<Output>> => {
      if (whileSending === 'drop') {
        if (sending.current) return { ok: false };
        sending.current = true;
      }
      try {
        return {
          ok: true,
          value: await mutateAsync(input as Input),
        };
      } catch (error) {
        const failed = saveFailedToast(failureOf(error));
        if (failed !== undefined) toast.show(failed);
        return { ok: false };
      } finally {
        if (whileSending === 'drop') sending.current = false;
      }
    },
    [mutateAsync, toast, whileSending],
  );
  return { run, pending: isPending, loading: useDelayed(isPending) };
}

/** `run`'s arguments: the input, none for an operation without one. */
type Args<Input> = Input extends undefined ? [] : [input: Input];

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
