import type { Client } from '@itera/api-contract/create-client';
import * as sdk from '@itera/api-contract/client';
import {
  idempotencyKeyHeaders,
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
import { failureOf, sendsAgain, WriteFailed } from './failure';
import { saveFailedToast } from './save-failed';

/** What running an operation gives back: its value, or that it did not go through. */
export type Outcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false };

/** The mutation scope every operation shares: they run one after another. */
const OPERATION_SCOPE = 'operations';

/**
 * How long to wait before sending a write again that had no answer or met
 * a server failure (`sendsAgain`): twice at most, shortly after (2026-10-04
 * coordinator's decision, #320).
 */
export const SEND_AGAIN_DELAYS: readonly number[] = [500, 1000];

/** The headers of a write: its Idempotency-Key (ADR 0006 冪等キー). */
export type WriteHeaders = ReturnType<typeof idempotencyKeyHeaders>;

/** One write: its input, and the key it is sent with each time. */
type Write<Input> = { readonly input: Input; readonly key: string };

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
 * - Each `run` is one write, named by a new Idempotency-Key (ADR 0006
 *   冪等キー). With no answer or a server failure (5xx) it is sent again
 *   with the same key, after `SEND_AGAIN_DELAYS`: the API answers what it
 *   saved, and never makes it twice.
 * - When it did not go through, every read is read again, the danger Toast
 *   says so and `run` gives back `{ ok: false }` (save-failed.ts). When it
 *   may have been saved after all (no answer or a server failure, also when
 *   sent again), the Toast has もう一度保存, which sends it once more with the
 *   same key. Without a session there is no Toast: the person is sent to
 *   sign in.
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
    (client, input, headers) => sendOperation(client, name, input, headers),
    options,
  );
}

/**
 * What `useOperation` does for one write of the contract, for any request
 * (the person's settings are a write that no operation of
 * packages/application takes, `useSetSettings`): the sending with its key,
 * sending it again, the Toast of a failure, the reads read again. `key`
 * names the mutation. `send` sends the write with `headers` and throws a
 * `WriteFailed` when it did not go through (`written`).
 */
export function useSend<Input, Output>(
  key: string,
  send: (
    client: Client,
    input: Input,
    headers: WriteHeaders,
  ) => Promise<Output>,
  { whileSending = 'drop' }: { whileSending?: 'drop' | 'wait' } = {},
) {
  const client = useApiClient();
  const toast = useToast();
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [key],
    mutationFn: ({ input, key: idempotencyKey }: Write<Input>) =>
      send(client, input, idempotencyKeyHeaders(idempotencyKey)),
    scope: { id: OPERATION_SCOPE },
    retry: (failures, error) =>
      failures < SEND_AGAIN_DELAYS.length && sendsAgain(error),
    retryDelay: (failures) => SEND_AGAIN_DELAYS[failures]!,
    // Sent, and sent again, whether or not the browser says it is online
    // or the tab has focus: the tries end in the Toast after
    // SEND_AGAIN_DELAYS, never in a wait without end that would hold every
    // other operation behind it (one scope).
    networkMode: 'always',
  });
  // A ref, not `isPending`: a second press can come before the render.
  const sending = useRef(false);
  /**
   * Sends the write; when it did not go through, says so in a Toast, whose
   * もう一度保存 sends the same write again.
   */
  const attempt = useCallback(
    (write: Write<Input>): Promise<Outcome<Output>> => {
      const once = async (): Promise<Outcome<Output>> => {
        try {
          return { ok: true, value: await mutateAsync(write) };
        } catch (error) {
          const failed = saveFailedToast(failureOf(error), () => {
            void once();
          });
          if (failed !== undefined) toast.show(failed);
          return { ok: false };
        }
      };
      return once();
    },
    [mutateAsync, toast],
  );
  const run = useCallback(
    async (...[input]: Args<Input>): Promise<Outcome<Output>> => {
      if (whileSending === 'drop') {
        if (sending.current) return { ok: false };
        sending.current = true;
      }
      try {
        return await attempt({
          input: input as Input,
          key: crypto.randomUUID(),
        });
      } finally {
        if (whileSending === 'drop') sending.current = false;
      }
    },
    [attempt, whileSending],
  );
  return { run, pending: isPending, loading: useDelayed(isPending) };
}

/** `run`'s arguments: the input, none for an operation without one. */
type Args<Input> = [Input] extends [undefined] ? [] : [input: Input];

/** What a function of the generated client gives back, without throwing. */
type Sent = {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly response?: Response;
};

/**
 * The data of a write the generated client sent, or a `WriteFailed` thrown
 * with its error and status (none when there was no answer), for
 * `sendsAgain` to tell.
 */
export async function written(sent: Promise<Sent>): Promise<unknown> {
  const result = await sent;
  if ('error' in result) {
    throw new WriteFailed(result.error, result.response?.status);
  }
  return result.data;
}

/**
 * Sends an operation as its request with the generated client's function
 * of the surface.
 */
async function sendOperation<N extends OperationName>(
  client: Client,
  name: N,
  input: PlainInput<N>,
  headers: WriteHeaders,
): Promise<PlainOutput<N>> {
  const { operationId, ...parts } = requestOf(name, input);
  const send = sdk[operationId] as (options: object) => Promise<Sent>;
  return (await written(
    send({ ...parts, headers, client, throwOnError: false }),
  )) as PlainOutput<N>;
}
