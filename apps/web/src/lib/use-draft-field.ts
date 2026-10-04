import { useRef, useState } from 'react';

type Draft<T> = {
  /** What is typed. */
  value: T;
  /** What the field showed when the typing began: what the person saw. */
  base: T;
  /** The read value when the typing began. */
  from: T;
  /** Sent for saving: shown only until the read comes back with something else. */
  held: boolean;
  /**
   * The last save failed and gave the typing back. Such a save may have
   * been made after all, or be sent again (もう一度保存, #320): once the
   * read comes back with what is typed, the typing is saved.
   */
  given: boolean;
  /** Saves sent and not answered yet: an earlier one's read is not the last's. */
  sending: number;
  /** The save sent last. */
  last: number;
};

type DraftField<T> = {
  /** What the field shows: the typing, else the value as read now. */
  value: T;
  /**
   * What the field showed when the typing began (the value as read now,
   * without typing; the value sent, once it is held).
   */
  base: T;
  /** Typed, and not what the person saw when it began; not one already sent. */
  edited: boolean;
  /** Typing: the field is the person's from here on, until `drop`. */
  set: (next: T) => void;
  /**
   * A value put in by an operation (not typed): shown until the read
   * changes, and not an edit to save.
   */
  put: (next: T) => void;
  /**
   * The typing is being saved: it stays shown until the read comes back
   * with a value other than the one read when typing began. A save that
   * ends `false` gives the field back to the person, typing kept.
   */
  hold: (saving?: boolean | void | Promise<boolean | void>) => void;
  /** Back to the value as read now. */
  drop: () => void;
  /**
   * Leaving the field: whether there is typing to save. Without any, the
   * field goes back to the value as read now (a value sent stays shown).
   */
  leave: () => boolean;
};

/**
 * A field the person edits, for a value that is read: what is typed is kept
 * apart from what is read. Without typing the field shows the read value, so
 * a change made on another device shows (#324). Saving on leaving the field
 * is decided by `edited`, which compares with what the field showed when the
 * typing began, not with what was read after: a field left unedited saves
 * nothing, and an older value never goes over a newer one.
 *
 * `equal` says when two values are the same to the person (the words
 * without the spaces around them, a time to the minute): typing back to such
 * a value is not an edit, so the field goes back to following the read.
 *
 * Typing is not touched by a re-read. After `hold`, the typing is shown
 * (the read has not caught up) until the read changes, once every save sent
 * has been answered: the read that follows an earlier save does not take
 * what was typed after it.
 */
function useDraftField<T>(
  read: T,
  equal: (a: T, b: T) => boolean = Object.is,
): DraftField<T> {
  const [draft, setDraft] = useState<Draft<T>>();
  const sent = useRef(0);
  // The read changed after the last save was answered, or caught up with
  // typing a failed save gave back: the draft's job is done. While a save
  // is still on the way, the read is an earlier save's.
  const done = (d: Draft<T> | undefined) =>
    d !== undefined &&
    d.sending === 0 &&
    ((d.held && !equal(d.from, read)) || (d.given && equal(d.value, read)));
  if (done(draft)) setDraft(undefined);
  const live = done(draft) ? undefined : draft;
  return {
    value: live === undefined ? read : live.value,
    base: live === undefined ? read : live.held ? live.value : live.base,
    edited: live !== undefined && !live.held && !equal(live.value, live.base),
    // From the state the update is applied to, not the one this render saw:
    // an answer may have come in between, and its count is not to be
    // written back.
    set: (next) =>
      setDraft((d) => {
        const cur = done(d) ? undefined : d;
        return {
          value: next,
          // Typing again over a value sent: that is what the person saw.
          base: cur === undefined ? read : cur.held ? cur.value : cur.base,
          from: cur === undefined || cur.held ? read : cur.from,
          held: false,
          given: false,
          sending: d?.sending ?? 0,
          last: d?.last ?? 0,
        };
      }),
    put: (next) =>
      setDraft((d) => ({
        value: next,
        base: next,
        from: read,
        held: true,
        given: false,
        sending: d?.sending ?? 0,
        last: d?.last ?? 0,
      })),
    hold: (saving) => {
      const id = ++sent.current;
      // The read as it is when the save is sent: what the read is to change
      // from before the typing is given up.
      setDraft(
        (d) =>
          d && {
            ...d,
            held: true,
            given: false,
            from: read,
            sending: d.sending + 1,
            last: id,
          },
      );
      void Promise.resolve(saving).then((ok) => {
        // Only the last save gives the typing back: an earlier one that
        // failed is carried by the last, which has the whole value.
        setDraft((d) => {
          if (d === undefined) return d;
          const givenBack = ok === false && d.last === id;
          return {
            ...d,
            sending: Math.max(0, d.sending - 1),
            held: givenBack ? false : d.held,
            given: givenBack || d.given,
          };
        });
      });
    },
    drop: () => setDraft(undefined),
    leave: () => {
      const edited =
        live !== undefined && !live.held && !equal(live.value, live.base);
      if (!edited) setDraft((d) => (d?.held ? d : undefined));
      return edited;
    },
  };
}

/** Two texts are the same words, whatever spaces are around them. */
const sameWords = (a: string, b: string) => a.trim() === b.trim();

export { sameWords, useDraftField };
export type { DraftField };
