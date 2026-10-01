import type { InterruptNote } from '@itera/domain';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import { formatHours } from '@/lib/time-format';

// A row of today's 割り込み: the time it was noted, the note and the
// minutes. While the Sprint runs, its `…` edits or deletes it (F38). The
// `…` is always shown, at every width (docs/design/patterns.md Today), in
// the column of the Task rows' `…`.

type InterruptRowProps = {
  note: InterruptNote;
  /** The time it was noted (「10:00」). */
  time: string;
  onEdit: () => void;
  onDelete: () => void;
};

function InterruptRow({ note, time, onEdit, onDelete }: InterruptRowProps) {
  return (
    <div
      data-slot="interrupt-row"
      className="flex items-start gap-3 px-2 medium:px-3"
    >
      {/* As tall as the `…` so that one line sits by it; a longer note
          wraps below, the time on its first line. */}
      <span className="flex min-h-control-lg min-w-0 flex-1 items-center medium:min-h-control-sm">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 text-meta text-ink-muted">{time}</span>
          <span className="min-w-0 break-words">
            {note.text}
            {note.minutes !== undefined && (
              <span className="text-ink-muted">
                {' '}
                · {formatHours(note.minutes / 60)}
              </span>
            )}
          </span>
        </span>
      </span>
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              size="sm"
              data-action="interrupt-actions"
              label={`その他の操作: 割り込み ${time}「${note.text}」`}
              icon={<Ellipsis />}
            />
          }
        />
        <MenuContent align="end">
          <MenuItem onClick={onEdit}>
            <Pencil aria-hidden />
            直す
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="danger" onClick={onDelete}>
            <Trash2 aria-hidden />
            消す
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

export { InterruptRow };
