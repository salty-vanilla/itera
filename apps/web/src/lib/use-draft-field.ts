import type { MadeFrom } from '@itera/api-contract/requests';
import { useEffect, useRef, useState } from 'react';
import type { Saved } from '@/api/use-operation';
import { useUnsavedTyping, useUnsavedTypingLayers } from './unsaved-typing';

type Draft<T> = {
  /** What is typed. */
  value: T;
  /** What the field showed when the typing began: what the person saw. */
  base: T;
  /** The read value when the typing began. */
  from: T;
  /**
   * The record as read when the typing began (#321): what its save says it
   * was made from. `undefined` for a field whose record has no version.
   */
  version: MadeFrom | undefined;
  /**
   * Sent for saving: shown only until the read has the last save (by the
   * record's version, else by the value changing from `from`).
   */
  held: boolean;
  /**
   * The last save failed and gave the typing back. Such a save may have
   * been made after all, or be sent again (もう一度保存, #320): once the
   * read comes back with what is typed, the typing is saved.
   */
  given: boolean;
  /**
   * A save of this typing failed, and it is not in the records yet: also
   * while it is typed in again or sent again (#332).
   */
  failed: boolean;
  /** Saves sent and not answered yet: an earlier one's read is not the last's. */
  sending: number;
  /** The save sent last. */
  last: number;
  /**
   * The versions the last save that went through wrote (`Written`, by
   * `keyOf`), #343: the read has the save once its record is at `now`, or
   * at one not in `over` (changed again since, here or on another device);
   * a read at one in `over` was made before it. `over` also has the
   * versions the field showed before the save was sent. `undefined` for a field
   * without a version, or a value `put` in by an operation: the value
   * changing from `from` says so instead.
   */
  written:
    { readonly over: ReadonlySet<string>; readonly now: string } | undefined;
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
  /**
   * The last save failed, and what the field shows is not in the records
   * (the read has been read again since, and is not the typing): the field
   * shows the Error state (Field `saveFailed`) until it is typed in again,
   * saved, or dropped (#332).
   */
  saveFailed: boolean;
  /**
   * What the field shows is not in the records since a save of it failed,
   * also while it is typed in again or sent again: leaving the screen would
   * lose it, and the app asks first (lib/unsaved-typing.tsx, #332).
   */
  unsaved: boolean;
  /**
   * The record its save is made from (#321): as read when the typing began;
   * as read now without typing, or once a failed save gave the typing back
   * (the Toast has told the person, and saving again is their decision on
   * the record as it now is). `undefined` without `version`.
   */
  madeFrom: MadeFrom | undefined;
  /** Typing: the field is the person's from here on, until `drop`. */
  set: (next: T) => void;
  /**
   * A value put in by an operation (not typed): shown until the read
   * changes, and not an edit to save.
   */
  put: (next: T) => void;
  /**
   * The typing is being saved: it stays shown until the read comes back
   * with a value other than the one read when it was sent. A save that ends
   * `false` gives the field back to the person, typing kept.
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
 *
 * A field of a record with a version (the third argument) knows the read
 * that has its last save by the record's version, which the save gives
 * back (`Saved`): a read that comes after the save is answered and was made
 * before it (an earlier save's read tried again, #343) does not take the
 * value sent. Only a field without a version goes by the read changing.
 */
function useDraftField<T>(
  read: T,
  equal?: (a: T, b: T) => boolean,
): DraftField<T>;
/**
 * A field for a value of a record with a version (#321): `version.etag` is
 * the record's etag as read, `undefined` when there is no record yet (a
 * Goal not written). Its save is made from `madeFrom`, and gives back the
 * versions it went through to `hold` (`Saved`).
 */
function useDraftField<T>(
  read: T,
  equal: (a: T, b: T) => boolean,
  version: { readonly etag: string | undefined },
): VersionedDraftField<T>;
function useDraftField<T>(
  read: T,
  equal: (a: T, b: T) => boolean = Object.is,
  version?: { readonly etag: string | undefined },
): DraftField<T> | VersionedDraftField<T> {
  const [draft, setDraft] = useState<Draft<T>>();
  // The record as read now: its etag, or none (a Goal not written yet).
  const current: MadeFrom | undefined =
    version === undefined
      ? undefined
      : version.etag === undefined
        ? { none: true }
        : { etag: version.etag };
  const sent = useRef(0);
  // The record's versions this field has shown (#343). A read can come back
  // to one of them after a save, not only to one the save was made over:
  // another query of the same record, kept from before (the Backlog's other
  // filter, Planning with the criterion applied or not), is shown at once
  // while it is read again. None of them has the save: they were shown
  // before it was sent.
  const shown = useRef(new Set<string>());
  const shownNow = current === undefined ? undefined : keyOf(current);
  useEffect(() => {
    if (shownNow !== undefined) shown.current.add(shownNow);
  }, [shownNow]);
  // This field, to the app's count of typing not saved.
  const [self] = useState(() => ({}));
  const unsavedTyping = useUnsavedTyping();
  const layers = useUnsavedTypingLayers();
  // The read has the last save (its record's version is the one the save
  // left it at, or one after: not one it was at before), or, without a
  // version, changed since the save was sent.
  const hasSave = ({ written, from }: Draft<T>) =>
    written === undefined || current === undefined
      ? !equal(from, read)
      : keyOf(current) === written.now || !written.over.has(keyOf(current));
  // The read has the last save once every save is answered, or caught up
  // with typing a failed save gave back: the draft's job is done. While a
  // save is still on the way, the read is an earlier save's.
  const done = (d: Draft<T> | undefined) =>
    d !== undefined &&
    d.sending === 0 &&
    ((d.held && hasSave(d)) || (d.given && equal(d.value, read)));
  if (done(draft)) setDraft(undefined);
  const live = done(draft) ? undefined : draft;
  const unsaved = live?.failed === true;
  useEffect(() => {
    if (unsavedTyping === null) return;
    if (unsaved) unsavedTyping.mark(self, layers);
    else unsavedTyping.unmark(self);
  }, [unsavedTyping, self, unsaved, layers]);
  useEffect(() => () => unsavedTyping?.unmark(self), [unsavedTyping, self]);
  return {
    value: live === undefined ? read : live.value,
    base: live === undefined ? read : live.held ? live.value : live.base,
    edited: live !== undefined && !live.held && !equal(live.value, live.base),
    saveFailed: live !== undefined && live.given && live.sending === 0,
    unsaved,
    madeFrom: live === undefined || live.given ? current : live.version,
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
          // Typing again over a value given back by a failed save is made
          // from the record as it now is (`madeFrom`).
          version:
            cur === undefined || cur.held || cur.given ? current : cur.version,
          held: false,
          given: false,
          failed: cur?.failed ?? false,
          sending: d?.sending ?? 0,
          last: d?.last ?? 0,
          written: d?.written,
        };
      }),
    put: (next) =>
      setDraft((d) => ({
        value: next,
        base: next,
        from: read,
        version: current,
        held: true,
        given: false,
        failed: false,
        sending: d?.sending ?? 0,
        last: d?.last ?? 0,
        // Not a save of this field's: shown until the read changes.
        written: undefined,
      })),
    hold: (
      saving?: boolean | void | Saved | Promise<boolean | void | Saved>,
    ) => {
      const id = ++sent.current;
      // The versions shown before the save is sent: a read at one of them
      // does not have it.
      const before = [...shown.current];
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
      void Promise.resolve(saving).then((answer) => {
        const ok = typeof answer === 'object' ? answer.ok : answer;
        const written =
          typeof answer === 'object' && answer.ok ? answer.written : undefined;
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
            // The last save went through: the typing is saved, also when
            // the read does not change for it (the same words as another
            // device's).
            failed: givenBack || (d.failed && !(ok === true && d.last === id)),
            written:
              ok === true && d.last === id
                ? written && {
                    over: new Set([...written.over.map(keyOf), ...before]),
                    now: keyOf(written.now),
                  }
                : d.written,
          };
        });
      });
    },
    // Out of the count at once: the screen may move on in the same event
    // (保存せずに閉じる).
    drop: () => {
      unsavedTyping?.unmark(self);
      setDraft(undefined);
    },
    leave: () => {
      const edited =
        live !== undefined && !live.held && !equal(live.value, live.base);
      if (!edited) setDraft((d) => (d?.held ? d : undefined));
      return edited;
    },
  };
}

/**
 * A field of a record with a version: its save is always made from one,
 * and gives back the versions it went through (#343).
 */
type VersionedDraftField<T> = Omit<DraftField<T>, 'madeFrom' | 'hold'> & {
  readonly madeFrom: MadeFrom;
  /**
   * The typing is being saved: it stays shown until the read has the save
   * (its record at the version the save left it at, or one after). A save
   * that did not go through gives the field back to the person, typing
   * kept.
   */
  readonly hold: (saving: Saved | Promise<Saved>) => void;
};

/** A version as `Draft` keeps it: its etag, or `*` for no record. */
const keyOf = (version: MadeFrom) => ('etag' in version ? version.etag : '*');

/** Two texts are the same words, whatever spaces are around them. */
const sameWords = (a: string, b: string) => a.trim() === b.trim();

export { sameWords, useDraftField };
export type { DraftField, VersionedDraftField };
