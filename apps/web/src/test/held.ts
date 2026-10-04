/**
 * Answers that wait until the test lets them through, in the order the
 * requests came (#341): a request is on its way for as long as the test
 * needs, without counting on how long a delay takes on a busy machine.
 * `answer` holds the requests `holds` names (and passes the others on);
 * `waiting` is how many are held.
 */
export function held(holds: (request: Request) => boolean) {
  const queue: (() => void)[] = [];
  let open = false;
  return {
    answer: (request: Request): Promise<undefined> | undefined =>
      open || !holds(request)
        ? undefined
        : new Promise<undefined>((resolve) =>
            queue.push(() => resolve(undefined)),
          ),
    get waiting() {
      return queue.length;
    },
    /** Lets the first one held through. */
    next() {
      const first = queue.shift();
      if (first === undefined) throw new Error('no request is held');
      first();
    },
    /** Lets every one held through, and holds none from now on. */
    release() {
      open = true;
      for (const one of queue.splice(0)) one();
    },
  };
}

/** The writes: every request but a read. */
export const writes = (request: Request) => request.method !== 'GET';
