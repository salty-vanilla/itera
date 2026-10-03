import { useState } from 'react';

type Draft<T> = {
  /** What is typed. */
  value: T;
  /** What the field showed when the typing began: what the person saw. */
  base: T;
  /** The read value when the typing began. */
  from: T;
  /** Sent for saving: shown only until the read comes back with something else. */
  held: boolean;
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
 * (the read has not caught up) until the read changes.
 */
function useDraftField<T>(
  read: T,
  equal: (a: T, b: T) => boolean = Object.is,
): DraftField<T> {
  const [draft, setDraft] = useState<Draft<T>>();
  // The read changed after the save: the draft's job is done.
  if (draft?.held && !equal(draft.from, read)) setDraft(undefined);
  const live = draft?.held && !equal(draft.from, read) ? undefined : draft;
  const release = () => setDraft((d) => d && { ...d, held: false });
  return {
    value: live === undefined ? read : live.value,
    base: live === undefined ? read : live.held ? live.value : live.base,
    edited: live !== undefined && !live.held && !equal(live.value, live.base),
    set: (next) =>
      setDraft({
        value: next,
        // Typing again over a value sent: that is what the person saw.
        base: live === undefined ? read : live.held ? live.value : live.base,
        from: live === undefined || live.held ? read : live.from,
        held: false,
      }),
    put: (next) =>
      setDraft({ value: next, base: next, from: read, held: true }),
    hold: (saving) => {
      // The read as it is when the save is sent: what the read is to change
      // from before the typing is given up.
      setDraft((d) => d && { ...d, held: true, from: read });
      void Promise.resolve(saving).then((ok) => {
        if (ok === false) release();
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
