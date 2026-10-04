import type { Client } from '@itera/api-contract/create-client';
import * as sdk from '@itera/api-contract/client';
import {
  conditionHeaders,
  idempotencyKeyHeaders,
  requestOf,
  routes,
  type ConditionalName,
  type MadeFrom,
  type OperationName,
  type PlainInput,
  type PlainOutput,
} from '@itera/api-contract/sending';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useId, useRef } from 'react';
import { useCloseStaleToast, useToast } from '@/components/ui/toast';
import { useDelayed } from '@/lib/use-delayed';
import { useApiClient } from './api-provider';
import { failureOf, sendsAgain, WriteFailed } from './failure';
import { SAVE_FAILED_KIND, saveFailedToast } from './save-failed';

/**
 * What running an operation gives back: its value, or that it did not go
 * through. An operation that replaces a record's values (`ConditionalName`)
 * also gives back the versions it moved the record through (`written`).
 */
export type Outcome<T> =
  | { readonly ok: true; readonly value: T; readonly written?: Written }
  | { readonly ok: false };

/**
 * The versions of a record that a write replacing its values went through
 * (#343): the record was at one of `over` before it (the version it was made
 * from, then those this client's own writes had moved it to, `ownVersions`),
 * and is at `now` after it (the same as the last of `over` when the write
 * changed none of its values). Versions are compared whole, never read
 * (ADR 0006 記録ごとの版): a read whose record is at one of `over` and not at
 * `now` was made before the write.
 */
export type Written = {
  readonly over: readonly MadeFrom[];
  readonly now: MadeFrom;
};

/**
 * What a field's save gives back to the field (useDraftField `hold`):
 * whether it went through and, as it replaced the record's values, the
 * versions it went through, so that the field knows the read that has it
 * (#343).
 */
export type Saved =
  { readonly ok: true; readonly written: Written } | { readonly ok: false };

/** A field's save, from the outcome of an operation that replaces values. */
export function savedOf(
  outcome: { readonly ok: true; readonly written: Written } | { ok: false },
): Saved {
  return outcome.ok ? { ok: true, written: outcome.written } : { ok: false };
}

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

/**
 * One write: its input, the key it is sent with each time, and, for a write
 * that replaces a record's values, the record as it was read (#321).
 */
type Write<Input> = {
  readonly input: Input;
  readonly key: string;
  readonly from?: MadeFrom;
};

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
 * - An operation that replaces a record's values (`ConditionalName`: the
 *   contract's PATCHes and the PUT of a Task's rule) is run with the record
 *   as it was read: `run(input, { etag })`, or `{ none: true }` for a
 *   record not made yet (a Goal not written, a Task without a rule). It is
 *   sent with `If-Match` (`If-None-Match: *`), after the record's own
 *   writes from this client have moved it on (`ownVersions`; a DELETE of
 *   the resource ends that, #330). When the record has
 *   changed on another device since, it is not made (412): the Toast says
 *   so, and with `typed` (a field's typing, which the field keeps) says
 *   that saving again puts the typing over it (ADR 0005 エラーと送信中).
 * - `pending` is true while it is being sent (block the control), and
 *   `loading` once that has lasted `LOADING_DELAY` (show the spinner and
 *   its words: Button `loading`, IconButton `loading`).
 */
export function useOperation<N extends OperationName>(
  name: N,
  options: { whileSending?: 'drop' | 'wait'; typed?: boolean } = {},
) {
  const { run, ...rest } = useSend<PlainInput<N>, Answer<PlainOutput<N>>>(
    name,
    (client, input, headers, from) =>
      sendOperation(client, name, input, headers, from),
    options,
  );
  const runOperation = useCallback(
    async (...args: Args<PlainInput<N>>): Promise<Outcome<PlainOutput<N>>> => {
      const outcome = await run(...args);
      if (!outcome.ok) return outcome;
      const { data, written } = outcome.value;
      return {
        ok: true,
        value: data,
        ...(written === undefined ? {} : { written }),
      };
    },
    [run],
  );
  return {
    ...rest,
    run: runOperation as unknown as (
      ...args: RunArgs<N>
    ) => Promise<RunOutcome<N>>,
  };
}

/**
 * `run`'s outcome: one that replaces a record's values gives back the
 * versions it went through (`written`).
 */
type RunOutcome<N extends OperationName> = N extends ConditionalName
  ? | {
        readonly ok: true;
        readonly value: PlainOutput<N>;
        readonly written: Written;
      }
    | { readonly ok: false }
  : Outcome<PlainOutput<N>>;

/** What `sendOperation` gives back: the data, and the versions it wrote. */
type Answer<T> = { readonly data: T; readonly written?: Written };

/**
 * `run`'s arguments: the input (none for an operation without one), and
 * the record as it was read for an operation that replaces its values.
 */
type RunArgs<N extends OperationName> = N extends ConditionalName
  ? [input: PlainInput<N>, from: MadeFrom]
  : Args<PlainInput<N>>;

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
    from: MadeFrom | undefined,
  ) => Promise<Output>,
  {
    whileSending = 'drop',
    typed = false,
  }: { whileSending?: 'drop' | 'wait'; typed?: boolean } = {},
) {
  const client = useApiClient();
  const toast = useToast();
  const closeStale = useCloseStaleToast(SAVE_FAILED_KIND);
  // This hook's writes: a failure of saving typing is closed by its own
  // later write that goes through (#332).
  const self = useId();
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [key],
    mutationFn: ({ input, key: idempotencyKey, from }: Write<Input>) =>
      send(client, input, idempotencyKeyHeaders(idempotencyKey), from),
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
          const value = await mutateAsync(write);
          // A write that went through, after one that may have been saved:
          // the records are read again, and sending that one again could
          // now mean something else (ADR 0005 エラーと送信中). After this
          // hook's own failure to save typing: the typing is saved again
          // (#332).
          closeStale(self);
          return { ok: true, value };
        } catch (error) {
          const failed = saveFailedToast(
            failureOf(error),
            () => {
              void once();
            },
            { typed },
          );
          if (failed !== undefined)
            toast.show(typed ? { ...failed, closedBySaveOf: self } : failed);
          return { ok: false };
        }
      };
      return once();
    },
    [mutateAsync, toast, closeStale, self, typed],
  );
  const run = useCallback(
    async (...args: Args<Input>): Promise<Outcome<Output>> => {
      // An operation that replaces values has its record after the input
      // (`useOperation`'s `run`).
      const [input, from] = args as unknown as [Input, MadeFrom | undefined];
      if (whileSending === 'drop') {
        if (sending.current) return { ok: false };
        sending.current = true;
      }
      try {
        return await attempt({
          input: input as Input,
          key: crypto.randomUUID(),
          ...(from === undefined ? {} : { from }),
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
 * of the surface; one that replaces a record's values with the version it
 * was made from (`If-Match`), moved on by this client's own writes to the
 * record since. A DELETE that went through leaves no record there: a write
 * made from none after it is sent as made from none (a rule ended and made
 * again, #330).
 */
async function sendOperation<N extends OperationName>(
  client: Client,
  name: N,
  input: PlainInput<N>,
  headers: WriteHeaders,
  from: MadeFrom | undefined,
): Promise<Answer<PlainOutput<N>>> {
  const { operationId, ...parts } = requestOf(name, input);
  const send = sdk[operationId] as (options: object) => Promise<Sent>;
  const resource = resourceOf(operationId, parts);
  const over =
    from === undefined ? undefined : ownVersions(client).walk(resource, from);
  const made = over?.at(-1);
  const sent = send({
    ...parts,
    headers: {
      ...headers,
      ...(made === undefined ? {} : conditionHeaders(made)),
    },
    client,
    throwOnError: false,
  });
  const data = (await written(sent)) as PlainOutput<N>;
  if (routes[operationId].method === 'DELETE') {
    ownVersions(client).removed(resource);
  }
  if (over === undefined || made === undefined) return { data };
  // Without an ETag, the write removed the record (a Goal written empty).
  const etag = (await sent).response?.headers.get('ETag');
  ownVersions(client).moved(resource, made, etag ?? null);
  const now: MadeFrom = etag == null ? { none: true } : { etag };
  return { data, written: { over, now } };
}

/**
 * The resource a write is on: its path. The writes of one resource (the PUT
 * of a Task's rule and its DELETE, #330) share its versions.
 */
function resourceOf(
  operationId: keyof typeof routes,
  parts: { readonly path?: unknown },
): string {
  const { url } = routes[operationId];
  const values = (parts.path ?? {}) as Record<string, string>;
  return url.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '');
}

/**
 * The versions this client's own writes moved its records on to (#321): a
 * write that replaced a record's values answers the record's new etag, and
 * a later write made from the version before it (another field of the same
 * form, typed before the first was saved) is sent with the new one. Only
 * this client's own writes move a version here: another device's change
 * keeps the old one, which the API refuses (412). One per client (the API
 * and the browser mock each have one).
 */
const versionsByClient = new WeakMap<Client, OwnVersions>();

type OwnVersions = {
  /**
   * The versions from `from` through this client's own writes: the last is
   * what a write made from `from` is sent as.
   */
  walk(resource: string, from: MadeFrom): readonly [MadeFrom, ...MadeFrom[]];
  /**
   * A write made from `from` went through, and the record is now at `etag`,
   * or gone (`null`): the next write is made from none.
   */
  moved(resource: string, from: MadeFrom, etag: string | null): void;
  /**
   * A write removed the record (a DELETE of the resource): the versions this
   * client's writes moved it through are over, and a write made from none
   * is made from none, not from where an earlier one led.
   */
  removed(resource: string): void;
};

function ownVersions(client: Client): OwnVersions {
  const known = versionsByClient.get(client);
  if (known !== undefined) return known;
  const next = new Map<string, MadeFrom>();
  const keyOf = (resource: string, from: MadeFrom) =>
    `${resource} ${'etag' in from ? from.etag : '*'}`;
  const versions: OwnVersions = {
    walk(resource, from) {
      // Each step is a write of this client's that went through. A record
      // never comes back to an etag, but it can be gone again (made, removed,
      // made again), so a step already taken ends the walk.
      const seen = new Set<string>();
      const steps: [MadeFrom, ...MadeFrom[]] = [from];
      for (;;) {
        const key = keyOf(resource, steps.at(-1)!);
        const step = next.get(key);
        if (step === undefined || seen.has(key)) return steps;
        seen.add(key);
        steps.push(step);
      }
    },
    moved(resource, from, etag) {
      const to: MadeFrom = etag === null ? { none: true } : { etag };
      if (keyOf(resource, from) === keyOf(resource, to)) return;
      next.set(keyOf(resource, from), to);
    },
    removed(resource) {
      for (const key of next.keys()) {
        if (key.startsWith(`${resource} `)) next.delete(key);
      }
    },
  };
  versionsByClient.set(client, versions);
  return versions;
}
