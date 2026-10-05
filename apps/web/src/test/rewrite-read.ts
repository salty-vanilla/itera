import { vi } from 'vitest';

/**
 * Puts a rewrite in front of the stubbed `fetch` (the API mock): a GET that
 * `match` takes comes back with the `view` of its JSON body (the read's own
 * record; `clock` stays) changed by `change`, everything else as it was. For
 * an answer the mock does not give, such as a value the contract does not
 * list yet.
 */
export function rewriteRead(
  match: (url: URL) => boolean,
  change: (view: Record<string, unknown>) => Record<string, unknown>,
) {
  const inner = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      // The inner fetch reads the request's body: it gets a copy.
      const request = new Request(input, init);
      const response = await inner(request.clone());
      if (request.method !== 'GET' || !match(new URL(request.url))) {
        return response;
      }
      const body = (await response.json()) as { view: Record<string, unknown> };
      return new Response(
        JSON.stringify({ ...body, view: change(body.view) }),
        {
          status: response.status,
          headers: response.headers,
        },
      );
    },
  );
}
