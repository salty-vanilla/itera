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
// minutes. While the Sprint runs, its `…` edits or deletes it (F38); the
// `…` is always shown, as on Today's rows.

type InterruptRowProps = {
  note: InterruptNote;
  /** The time it was noted (「10:00」). */
  time: string;
  onEdit: () => void;
  onDelete: () => void;
};

function InterruptRow({ note, time, onEdit, onDelete }: InterruptRowProps) {
  return (
    <div className="flex items-start gap-3">
      {/* As tall as the `…` so that one line sits by it; longer notes wrap
          below. */}
      <span className="flex min-h-control-lg shrink-0 items-center text-meta leading-(--text-body--line-height) text-ink-muted medium:min-h-control-sm">
        {time}
      </span>
      <span className="flex min-h-control-lg min-w-0 flex-1 items-center break-words medium:min-h-control-sm">
        <span>
          {note.text}
          {note.minutes !== undefined && (
            <span className="text-ink-muted">
              {' '}
              · {formatHours(note.minutes / 60)}
            </span>
          )}
        </span>
      </span>
      <Menu>
        <MenuTrigger
          render={
            <IconButton
              size="sm"
              data-action="interrupt-actions"
              label={`操作: 割り込み ${time}「${note.text}」`}
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
