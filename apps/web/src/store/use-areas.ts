import { areaList, operations } from '@itera/application';
import type { AreaId } from '@itera/domain';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { useRun } from './use-run';

export type { EditableArea } from '@itera/application';

/**
 * Every Area, archived ones too, in the person's order (`order`), each by
 * its current name. The choices are the ones not archived.
 */
export function useAreas() {
  const { areas } = useStoreSnapshot().records;
  return useMemo(() => areaList({ areas }), [areas]);
}

/**
 * The person's operations on Areas (Issue #113), one named function each
 * (ADR 0005 API への移行). Each returns whether it went through; a failure
 * changes nothing and is shown as a Toast.
 */
export function useAreaActions() {
  const run = useRun();
  return useMemo(
    () => ({
      /** The new Area's ID, or `undefined` when it did not go through. */
      addArea: (name: string): AreaId | undefined => {
        const result = run(operations.createArea({ name }));
        return result.ok ? result.value.areaId : undefined;
      },
      renameArea: (areaId: AreaId, name: string) =>
        run(operations.renameArea({ areaId, name })).ok,
      archiveArea: (areaId: AreaId) =>
        run(operations.archiveArea({ areaId })).ok,
      restoreArea: (areaId: AreaId) =>
        run(operations.restoreArea({ areaId })).ok,
    }),
    [run],
  );
}

export type AreaActions = ReturnType<typeof useAreaActions>;
