import type { AreaId } from '@itera/domain';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AreaMark } from '@/components/ui/area-indicator';
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
import { useAreaActions, useAreas, type EditableArea } from '@/store/use-areas';

// 領域を編集 (Issue #113, patterns.md Backlog › Browse): the one Dialog to
// make an Area, rename it and archive it. It opens from the end of the
// Backlog's Area filters and from 「新しい領域…」 at the end of an Area
// Select. From a Select, the Area made is handed back to be chosen and the
// Dialog closes. Areas are the person's, so the names here are the current
// ones; a Sprint screen keeps its Sprint's names (F5).

type AreaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * From a Select's 「新しい領域…」: the new name takes the focus, and the
   * Area made is handed back and the Dialog closes.
   */
  onCreated?: ((areaId: AreaId) => void) | undefined;
  /** An Area was archived: a filter on it has nothing to show any more. */
  onArchived?: ((areaId: AreaId) => void) | undefined;
  /** Where the focus goes back to on closing; by default, where it was. */
  returnFocus?: HTMLElement | null | undefined;
};

function AreaDialog({
  open,
  onOpenChange,
  onCreated,
  onArchived,
  returnFocus,
}: AreaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
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
          onArchived={onArchived}
        />
        <DialogFooter>
          <DialogClose render={<Button />}>閉じる</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The Dialog's body. It is made again each time the Dialog opens. */
function AreaEditor({
  focusNew,
  onCreated,
  onArchived,
}: {
  focusNew: boolean;
  onCreated: ((areaId: AreaId) => void) | undefined;
  onArchived: ((areaId: AreaId) => void) | undefined;
}) {
  const areas = useAreas();
  const actions = useAreaActions();
  const [renaming, setRenaming] = useState<AreaId>();
  // Archived while the Dialog is open: the line stays with 元に戻す.
  const [archived, setArchived] = useState<readonly AreaId[]>([]);
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState('');
  const newRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const shown = areas.filter((a) => !a.archived || archived.includes(a.id));

  /**
   * After a row changes, the focus goes to a control of that row. The
   * control focused before is gone, and the Dialog takes the focus back to
   * itself in the next frame (Base UI's `restoreFocus: 'popup'`), so this
   * waits one frame more.
   */
  const focusRow = (areaId: AreaId, slot: string) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        listRef.current
          ?.querySelector<HTMLElement>(
            `[data-area="${areaId}"] [data-slot="${slot}"]`,
          )
          ?.focus(),
      ),
    );

  function add(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    // Nothing typed adds nothing, as in a Quick Add.
    if (name === '') {
      newRef.current?.focus();
      return;
    }
    const created = actions.addArea(name);
    if (created === undefined) return;
    setNewName('');
    setStatus(`「${name}」を追加しました`);
    if (onCreated !== undefined) onCreated(created);
    else newRef.current?.focus();
  }

  return (
    <DialogBody className="flex flex-col gap-5">
      {shown.length === 0 ? (
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
                onUndo={() => {
                  if (!actions.restoreArea(area.id)) return;
                  setArchived((ids) => ids.filter((id) => id !== area.id));
                  setStatus(`「${area.name}」を元に戻しました`);
                  focusRow(area.id, 'area-rename');
                }}
              />
            ) : renaming === area.id ? (
              <RenameRow
                key={area.id}
                area={area}
                onCancel={() => {
                  setRenaming(undefined);
                  focusRow(area.id, 'area-rename');
                }}
                onRename={(name) => {
                  if (!actions.renameArea(area.id, name)) return;
                  setRenaming(undefined);
                  if (name !== area.name) setStatus(`「${name}」に変えました`);
                  focusRow(area.id, 'area-rename');
                }}
              />
            ) : (
              <li
                key={area.id}
                data-area={area.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-soft py-2"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <AreaMark name={area.name} color={area.color} />
                  <span className="min-w-0 text-body text-ink wrap-anywhere">
                    {area.name}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="quiet"
                    data-slot="area-rename"
                    // The visible words come in the name (WCAG 2.5.3).
                    aria-label={`「${area.name}」の名前を変える`}
                    onClick={() => setRenaming(area.id)}
                  >
                    名前を変える
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (renaming !== undefined) setRenaming(undefined);
                      if (!actions.archiveArea(area.id)) return;
                      setArchived((ids) => [...ids, area.id]);
                      onArchived?.(area.id);
                      focusRow(area.id, 'area-undo');
                    }}
                    aria-label={`「${area.name}」をアーカイブ`}
                  >
                    アーカイブ
                  </Button>
                </span>
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
        <Button type="submit">追加</Button>
      </form>
      <p role="status" className="sr-only">
        {status}
      </p>
    </DialogBody>
  );
}

/** The name in a field. Enter or 名前を変える saves it; Esc or キャンセル goes back. */
function RenameRow({
  area,
  onRename,
  onCancel,
}: {
  area: EditableArea;
  onRename: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(area.name);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
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
          onRename(name.trim());
        }}
      >
        <Field
          label={`「${area.name}」の新しい名前`}
          description="Sprint の画面には、次の Sprint から反映されます。"
          error={error}
        >
          <TextInput
            ref={inputRef}
            value={name}
            enterKeyHint="done"
            prefix={<AreaMark name={name || area.name} color={area.color} />}
            onChange={(e) => setName(e.currentTarget.value)}
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
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="quiet" type="button" onClick={onCancel}>
            キャンセル
          </Button>
          <Button size="sm" type="submit">
            名前を変える
          </Button>
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
        <span id={textId} className="min-w-0 flex-1 wrap-anywhere">
          「{area.name}」をアーカイブしました。Task と過去の記録には残ります。
        </span>
        <Button
          size="sm"
          variant="quiet"
          data-slot="area-undo"
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
