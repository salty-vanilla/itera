// Area operations as store Changes (Issue #113): 作る・名前を変える・
// アーカイブ, and the undo of アーカイブ. Each calls `@itera/domain` commands
// only. Screens go through `useAreaActions` (ADR 0005 API への移行).
import {
  archiveArea,
  createArea,
  renameArea,
  restoreArea,
  type Area,
  type AreaColor,
  type AreaId,
  type CommandResult,
} from '@itera/domain';
import { find } from './changes';
import { changed, type Change, type ChangeContext } from './record-store';

/**
 * The color of the next Area: `area-1` for the first one made, `area-2` for
 * the second, and from the 8th on round again from `area-1` (DESIGN.md Area
 * の路線記号). Archived Areas count: the order is the order of making.
 */
export function nextAreaColor(areas: readonly Area[]): AreaColor {
  return ((areas.length % 7) + 1) as AreaColor;
}

/** A new Area, last in the person's order. */
export function addArea(name: string): Change {
  return (records, ctx) => {
    const order = Math.max(-1, ...records.areas.map((a) => a.order)) + 1;
    return changed(
      createArea(
        {
          id: ctx.newId('Area'),
          userId: records.user.id,
          name,
          color: nextAreaColor(records.areas),
          order,
        },
        ctx,
      ),
      (area) => ({ areas: [area] }),
    );
  };
}

/** A command on one Area. */
function onArea(
  areaId: AreaId,
  command: (area: Area, ctx: ChangeContext) => CommandResult<Area>,
): Change {
  return (records, ctx) => {
    const area = find(records.areas, areaId, 'Area');
    if (!area.ok) return area;
    return changed(command(area.value, ctx), (next) => ({ areas: [next] }));
  };
}

/**
 * The current name changes; a Sprint screen keeps the name its Sprint took
 * (SprintAreaSnapshot, F5), so the new one shows there from the next Sprint.
 */
export const rename = (areaId: AreaId, name: string) =>
  onArea(areaId, (area, ctx) => renameArea(area, name, ctx));

/** Out of the choices; Tasks in it and past Sprints keep it (PRD §6 Task). */
export const archive = (areaId: AreaId) =>
  onArea(areaId, (area, ctx) => archiveArea(area, ctx));

export const restore = (areaId: AreaId) =>
  onArea(areaId, (area, ctx) => restoreArea(area, ctx));
