import type { AreaColor, AreaId } from '@itera/domain';
import { useMemo } from 'react';
import * as changes from './area-changes';
import { useRecordStore, useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';

export interface EditableArea {
  readonly id: AreaId;
  /** The current name (the Area is the person's, not a Sprint's, F5). */
  readonly name: string;
  readonly color: AreaColor;
  readonly archived: boolean;
}

/**
 * Every Area, archived ones too, in the person's order by current name. The
 * choices are the ones not archived.
 */
export function useAreas(): readonly EditableArea[] {
  const { records } = useStoreSnapshot();
  const { areas } = records;
  return useMemo(
    () =>
      areas
        .toSorted((a, b) => a.order - b.order)
        .map((a) => ({
          id: a.id,
          name: a.name,
          color: a.color,
          archived: a.archived,
        })),
    [areas],
  );
}

/**
 * The person's operations on Areas (Issue #113), one named function each
 * (ADR 0005 API への移行). Each returns whether it went through; a failure
 * changes nothing and is shown as a Toast.
 */
export function useAreaActions() {
  const run = useRun();
  const store = useRecordStore();
  return useMemo(
    () => ({
      /** The new Area's ID, or `undefined` when it did not go through. */
      addArea: (name: string): AreaId | undefined =>
        run(changes.addArea(name))
          ? store.getSnapshot().records.areas.at(-1)?.id
          : undefined,
      renameArea: (areaId: AreaId, name: string) =>
        run(changes.rename(areaId, name)),
      archiveArea: (areaId: AreaId) => run(changes.archive(areaId)),
      restoreArea: (areaId: AreaId) => run(changes.restore(areaId)),
    }),
    [run, store],
  );
}

export type AreaActions = ReturnType<typeof useAreaActions>;
