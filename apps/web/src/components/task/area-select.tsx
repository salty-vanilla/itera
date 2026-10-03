import type { AreaId } from '@itera/domain';
import { AreaMark, type AreaColor } from '@/components/ui/area-indicator';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';

// The Area of a Task in a Quick Add (DESIGN.md Components › Select and Task
// Quick Add): a native Select with the chosen Area's line symbol inside, the
// same symbol the Filter chips and rows show. No Area is 「領域なし」 with the
// `area-none` mark. Without a visual label; it has an accessible name.
// With `onNewArea`, 「新しい領域…」 ends the list (Issue #113): choosing it
// opens the Area Dialog and leaves the value as it was.

/** The value of 「新しい領域…」; never an Area's ID. */
const NEW_AREA = '__new-area__';

type AreaSelectProps = {
  areas: readonly { id: AreaId; name: string; color: AreaColor }[];
  /** The chosen Area's ID, or '' for 領域なし. */
  value: string;
  onChange: (value: string) => void;
  /** Adds 「新しい領域…」 at the end; choosing it calls this instead of `onChange`. */
  onNewArea?: (() => void) | undefined;
};

function AreaSelect({ areas, value, onChange, onNewArea }: AreaSelectProps) {
  const chosen = areas.find((a) => a.id === value);
  return (
    <Field label="追加するタスクの領域" hideLabel className="shrink-0">
      <Select
        value={value}
        onChange={(e) => {
          const next = e.currentTarget.value;
          if (next === NEW_AREA) onNewArea?.();
          else onChange(next);
        }}
        prefix={
          <AreaMark
            name={chosen?.name ?? '領域なし'}
            color={chosen?.color ?? 'none'}
          />
        }
      >
        <option value="">領域なし</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
        {onNewArea !== undefined && (
          <option value={NEW_AREA}>新しい領域…</option>
        )}
      </Select>
    </Field>
  );
}

/**
 * `value` when it is one of `areas`, else '' (領域なし). A Quick Add keeps
 * the Area chosen last; one archived since then is no longer a choice.
 */
function chosenArea(value: string, areas: AreaSelectProps['areas']): string {
  return areas.some((a) => a.id === value) ? value : '';
}

export { AreaSelect, chosenArea, NEW_AREA };
