import type { AreaId } from '@itera/domain';
import { AreaMark, type AreaColor } from '@/components/ui/area-indicator';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';

// The Area of a Task in a Quick Add (DESIGN.md Components › Select and Task
// Quick Add): a native Select with the chosen Area's line symbol inside, the
// same symbol the Filter chips and rows show. No Area is 「領域なし」 with the
// `area-none` mark. Without a visual label; it has an accessible name.

type AreaSelectProps = {
  areas: readonly { id: AreaId; name: string; color: AreaColor }[];
  /** The chosen Area's ID, or '' for 領域なし. */
  value: string;
  onChange: (value: string) => void;
};

function AreaSelect({ areas, value, onChange }: AreaSelectProps) {
  const chosen = areas.find((a) => a.id === value);
  return (
    <Field label="追加する Task の領域" hideLabel className="shrink-0">
      <Select
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
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
      </Select>
    </Field>
  );
}

export { AreaSelect };
