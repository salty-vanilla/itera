// The person's Areas as the Area list shows them: the current name, archived
// ones too (F5).
import type { AreaColor, AreaId } from '@itera/domain';
import { areaCapabilities, type AreaCapabilities } from './capabilities';
import type { TaggedRecords } from './versions';

export interface EditableArea {
  readonly id: AreaId;
  /** The current name (the Area is the person's, not a Sprint's, F5). */
  readonly name: string;
  readonly color: AreaColor;
  readonly archived: boolean;
  /** The Area's version, for a rename to say it was made from (#321). */
  readonly etag: string;
  /** What the person can do with the Area now (#323). */
  readonly capabilities: AreaCapabilities;
}

/**
 * Every Area, archived ones too, in the person's order (`order`), each by
 * its current name. The choices are the ones not archived.
 */
export function areaList(
  records: Pick<TaggedRecords, 'areas'>,
): readonly EditableArea[] {
  return records.areas
    .toSorted((a, b) => a.order - b.order)
    .map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      archived: a.archived,
      etag: a.etag,
      capabilities: areaCapabilities(a),
    }));
}
