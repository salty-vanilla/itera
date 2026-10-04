import type { AreaId } from '@itera/api-contract';
import type { MadeFrom } from '@itera/api-contract/requests';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AreaMark } from '@/components/ui/area-indicator';
import { ReadStatus } from '@/components/read-status';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import { sameWords, useDraftField } from '@/lib/use-draft-field';
import {
  useAreaActions,
  useAreas,
  type EditableArea,
} from '@/screen-data/use-areas';

// 領域を編集 (Issue #113, patterns.md Backlog › Browse): the one Dialog to
// make an Area, rename it and archive it. It opens from the end of the
// Backlog's Area filters and from 「新しい領域…」 at the end of an Area
// Select. From a Select, the Area made is handed back to be chosen and the
// Dialog closes. Areas are the person's, so the names here are the current
// ones; a Sprint screen keeps its Sprint's names (F5). A row has one quiet
// 編集; it opens to the name's field, with アーカイブ, so that the buttons
// show only on the row being edited. アーカイブ is not `danger`: it can be
// undone (Issue #164).
//
// An archived Area may still be what a screen has chosen (a filter, a Quick
// Add's Area): the screen treats a choice that is not among its Areas as
// none, so this Dialog does not tell it.

type AreaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * From a Select's 「新しい領域…」: the new name takes the focus, and the
   * Area made is handed back and the Dialog closes.
   */
  onCreated?: ((areaId: AreaId) => void) | undefined;
  /** Where the focus goes back to on closing; by default, where it was. */
  returnFocus?: HTMLElement | null | undefined;
};

function AreaDialog({
  open,
  onOpenChange,
  onCreated,
  returnFocus,
}: AreaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        // Top-aligned rather than centred: the list changes in place (a
        // row opens to its field, a new Area is added), and the title and
        // the row stay where they were.
        className="self-start medium:mt-16"
        finalFocus={() => (returnFocus?.isConnected ? returnFocus : true)}
      >
        <DialogHeader>
          <DialogTitle>領域を編集</DialogTitle>
        </DialogHeader>
        <AreaEditor
          focusNew={onCreated !== undefined}
          onCreated={
            onCreated === undefined
              ? undefined
              : (areaId) => {
                  onCreated(areaId);
                  onOpenChange(false);
                }
          }
        />
        <DialogFooter>
          <DialogClose render={<Button />}>閉じる</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Runs `focus` once Base UI has put the focus back: when the control that
 * had it goes (a row's 編集, its field), the Dialog takes the focus
 * to itself in the next frame (`restoreFocus: 'popup'`), so this waits one
 * frame more. Returns a cleanup for an effect.
 */
function afterFocusSettles(focus: () => void): () => void {
  let inner = 0;
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(focus);
  });
  return () => {
    cancelAnimationFrame(outer);
    cancelAnimationFrame(inner);
  };
}

/** The Dialog's body. It is made again each time the Dialog opens. */
function AreaEditor({
  focusNew,
  onCreated,
}: {
  focusNew: boolean;
  onCreated: ((areaId: AreaId) => void) | undefined;
}) {
  const read = useAreas();
  const actions = useAreaActions();
  const [renaming, setRenaming] = useState<AreaId>();
  // Archived while the Dialog is open: the line stays with 元に戻す.
  const [archived, setArchived] = useState<readonly AreaId[]>([]);
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState('');
  const newRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const shown =
    read.status === 'ready'
      ? read.areas.filter((a) => !a.archived || archived.includes(a.id))
      : [];

  /** After a row changes, the focus goes to a control of that row. */
  const focusRow = (areaId: AreaId, action: 'edit' | 'undo') =>
    afterFocusSettles(() =>
      listRef.current
        ?.querySelector<HTMLElement>(
          `[data-area="${areaId}"] [data-action="${action}"]`,
        )
        ?.focus(),
    );

  async function add(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    // Nothing typed adds nothing, as in a Quick Add.
    if (name === '') {
      newRef.current?.focus();
      return;
    }
    const created = await actions.addArea(name);
    if (created === undefined) return;
    // What was typed while it was sent is the next Area's.
    setNewName((typed) => (typed.trim() === name ? '' : typed));
    setStatus(`「${name}」を追加しました`);
    if (onCreated !== undefined) onCreated(created);
    else newRef.current?.focus();
  }

  return (
    <DialogBody className="flex flex-col gap-5">
      {read.status !== 'ready' ? (
        <ReadStatus label="領域" read={read} />
      ) : shown.length === 0 ? (
        <p className="text-body text-ink-muted">領域はまだありません。</p>
      ) : (
        <ul
          ref={listRef}
          aria-label="領域"
          className="border-t border-border-soft"
        >
          {shown.map((area) =>
            area.archived ? (
              <ArchivedLine
                key={area.id}
                area={area}
                onUndo={async () => {
                  if (!(await actions.restoreArea(area.id))) return;
                  setArchived((ids) => ids.filter((id) => id !== area.id));
                  setStatus(`「${area.name}」を元に戻しました`);
                  focusRow(area.id, 'edit');
                }}
              />
            ) : renaming === area.id ? (
              <EditRow
                key={area.id}
                area={area}
                onArchive={async () => {
                  setRenaming(undefined);
                  if (!(await actions.archiveArea(area.id))) return;
                  setArchived((ids) => [...ids, area.id]);
                  focusRow(area.id, 'undo');
                }}
                onCancel={() => {
                  setRenaming(undefined);
                  focusRow(area.id, 'edit');
                }}
                onRename={async (name, from) => {
                  if (!(await actions.renameArea(area.id, name, from)))
                    return false;
                  setRenaming(undefined);
                  if (name !== area.name) setStatus(`「${name}」に変えました`);
                  focusRow(area.id, 'edit');
                  return true;
                }}
              />
            ) : (
              <li
                key={area.id}
                data-area={area.id}
                className="flex min-h-row-touch items-center gap-2 border-b border-border-soft py-1 medium:min-h-row-task"
              >
                <AreaMark name={area.name} color={area.color} />
                <span className="min-w-0 flex-1 text-body text-ink wrap-anywhere [word-break:auto-phrase]">
                  {area.name}
                </span>
                <Button
                  size="sm"
                  variant="quiet"
                  data-action="edit"
                  // The visible word comes in the name (WCAG 2.5.3).
                  aria-label={`「${area.name}」を編集`}
                  onClick={() => setRenaming(area.id)}
                >
                  編集
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
      <form className="flex items-end gap-2" onSubmit={add}>
        <Field label="新しい領域" className="min-w-0 flex-1">
          <TextInput
            ref={newRef}
            value={newName}
            data-autofocus={focusNew || undefined}
            enterKeyHint="done"
            onChange={(e) => setNewName(e.currentTarget.value)}
          />
        </Field>
        <Button
          type="submit"
          loading={actions.loading.addArea}
          loadingLabel="追加中…"
        >
          追加
        </Button>
      </form>
      <p role="status" className="sr-only">
        {status}
      </p>
    </DialogBody>
  );
}

/**
 * The row being edited: the name in a field (Enter or 名前を変える saves it;
 * Esc or キャンセル goes back), and アーカイブ.
 */
function EditRow({
  area,
  onRename,
  onArchive,
  onCancel,
}: {
  area: EditableArea;
  /** Whether it went through; `from` is the Area as read when it was typed. */
  onRename: (name: string, from: MadeFrom) => Promise<boolean>;
  onArchive: () => void;
  onCancel: () => void;
}) {
  // Typed apart from the Area as read: the form shows the name as it is now
  // until it is typed in, and 名前を変える on a name nothing was typed in
  // changes nothing, so that the name it opened with never goes over another
  // device's (#324).
  const nameField = useDraftField(area.name, sameWords, { etag: area.etag });
  const name = nameField.value;
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(
    () =>
      afterFocusSettles(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }),
    [],
  );
  return (
    <li data-area={area.id} className="border-b border-border-soft py-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() === '') {
            setError('名前を入力してください');
            inputRef.current?.focus();
            return;
          }
          if (!nameField.edited) {
            onCancel();
            return;
          }
          // Held until it is answered: a rename that did not go through
          // gives the typing back (#321).
          nameField.hold(onRename(name.trim(), nameField.madeFrom));
        }}
      >
        <Field
          label={`「${area.name}」の名前`}
          description={
            <span className="[word-break:auto-phrase]">
              確定済みの Sprint では、前の名前のままです。
            </span>
          }
          error={error}
        >
          <TextInput
            ref={inputRef}
            value={name}
            enterKeyHint="done"
            prefix={<AreaMark name={name || area.name} color={area.color} />}
            onChange={(e) => nameField.set(e.currentTarget.value)}
            onKeyDown={(e) => {
              // Esc goes back to the row rather than closing the Dialog.
              // While converting Japanese input it only closes the IME.
              if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }
            }}
          />
        </Field>
        {/* When the row is too narrow for one line, キャンセル and 名前を変える
            stay right under the field and アーカイブ goes below them. */}
        <div className="flex flex-wrap-reverse items-center gap-2">
          {/* No confirmation: the line left in its place has 元に戻す. */}
          <Button size="sm" type="button" onClick={onArchive}>
            アーカイブ
          </Button>
          {/* Together at the right. */}
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="quiet" type="button" onClick={onCancel}>
              キャンセル
            </Button>
            <Button size="sm" type="submit">
              名前を変える
            </Button>
          </span>
        </div>
      </form>
    </li>
  );
}

/** Where an archived Area was, until the Dialog closes (F29's undo line). */
function ArchivedLine({
  area,
  onUndo,
}: {
  area: EditableArea;
  onUndo: () => void;
}) {
  const textId = useId();
  return (
    <li data-area={area.id} className="border-b border-border-soft">
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-canvas-subtle px-3 py-2 text-body text-ink"
      >
        {/* Under a narrow width 元に戻す goes under the sentence. */}
        <span
          id={textId}
          className="min-w-0 flex-[1_1_12em] [word-break:auto-phrase]"
        >
          「{area.name}」をアーカイブしました。タスクと過去の記録には残ります。
        </span>
        <Button
          size="sm"
          variant="quiet"
          data-action="undo"
          aria-describedby={textId}
          onClick={onUndo}
        >
          元に戻す
        </Button>
      </div>
    </li>
  );
}

/**
 * Opens the Dialog from an Area Select's 「新しい領域…」: `open(then)` hands
 * the Area made to `then`, to choose it. Render `dialog` next to the Select.
 */
function useNewAreaDialog() {
  const [then, setThen] = useState<{ fn: (areaId: AreaId) => void }>();
  // Kept after closing, for the focus to go back to the Select (inside a
  // Drawer, the Drawer would otherwise take it).
  const [from, setFrom] = useState<HTMLElement | null>(null);
  return {
    open: (fn: (areaId: AreaId) => void) => {
      const active = document.activeElement;
      setFrom(active instanceof HTMLElement ? active : null);
      setThen({ fn });
    },
    dialog: (
      <AreaDialog
        open={then !== undefined}
        onOpenChange={(next) => {
          if (!next) setThen(undefined);
        }}
        onCreated={(areaId) => then?.fn(areaId)}
        returnFocus={from}
      />
    ),
  };
}

export { AreaDialog, useNewAreaDialog };
