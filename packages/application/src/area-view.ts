// The person's Areas as the Area list shows them: the current name, archived
// ones too (F5).
import type { AreaColor, AreaId } from '@itera/domain';
import type { Records } from './records';

export interface EditableArea {
  readonly id: AreaId;
  /** The current name (the Area is the person's, not a Sprint's, F5). */
  readonly name: string;
  readonly color: AreaColor;
  readonly archived: boolean;
}

/**
 * Every Area, archived ones too, in the person's order (`order`), each by
 * its current name. The choices are the ones not archived.
 */
export function areaList(
  records: Pick<Records, 'areas'>,
): readonly EditableArea[] {
  return records.areas
    .toSorted((a, b) => a.order - b.order)
    .map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      archived: a.archived,
    }));
}
