import type { Client } from '@itera/api-contract/create-client';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
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
 * One operation of the contract, from its generated mutation options:
 * `useOperation(createAreaMutation)`, then `run({ body: { name } })`.
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
export function useOperation<TData, TError, TVariables>(
  options: (options: {
    client: Client;
  }) => UseMutationOptions<TData, TError, TVariables>,
  { whileSending = 'drop' }: { whileSending?: 'drop' | 'wait' } = {},
) {
  const client = useApiClient();
  const toast = useToast();
  const { mutateAsync, isPending } = useMutation({
    ...options({ client }),
    scope: { id: OPERATION_SCOPE },
  });
  // A ref, not `isPending`: a second press can come before the render.
  const sending = useRef(false);
  const run = useCallback(
    async (variables: TVariables): Promise<Outcome<TData>> => {
      if (whileSending === 'drop') {
        if (sending.current) return { ok: false };
        sending.current = true;
      }
      try {
        return { ok: true, value: await mutateAsync(variables) };
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
