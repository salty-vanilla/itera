import type { AreaId, EditableArea } from '@itera/api-contract';
import {
  archiveAreaMutation,
  createAreaMutation,
  listAreasOptions,
  renameAreaMutation,
  restoreAreaMutation,
} from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/api/api-provider';
import { useRead, type Read } from '@/api/read-state';
import { useOperation } from '@/api/use-operation';

export type { EditableArea };

/**
 * Every Area, archived ones too, in the person's order, each by its current
 * name. The choices are the ones not archived.
 */
export function useAreas(): Read<{ readonly areas: readonly EditableArea[] }> {
  const query = useQuery(listAreasOptions({ client: useApiClient() }));
  return useRead(query, areasView);
}

function areasView(data: { view: EditableArea[] }) {
  return { areas: data.view };
}

/**
 * The person's operations on Areas (Issue #113), one named function each
 * (ADR 0005 API への移行). Each gives back whether it went through; one that
 * did not changes nothing and is shown as a Toast (useOperation).
 */
export function useAreaActions() {
  const create = useOperation(createAreaMutation);
  const rename = useOperation(renameAreaMutation);
  const archive = useOperation(archiveAreaMutation);
  const restore = useOperation(restoreAreaMutation);
  const actions = {
    /** The new Area's ID, or `undefined` when it did not go through. */
    addArea: async (name: string): Promise<AreaId | undefined> => {
      const outcome = await create.run({ body: { name } });
      return outcome.ok ? outcome.value.areaId : undefined;
    },
    renameArea: async (areaId: AreaId, name: string) =>
      (await rename.run({ body: { areaId, name } })).ok,
    archiveArea: async (areaId: AreaId) =>
      (await archive.run({ body: { areaId } })).ok,
    restoreArea: async (areaId: AreaId) =>
      (await restore.run({ body: { areaId } })).ok,
  };
  // For how long each is being sent: show it in its button once it has
  // lasted `LOADING_DELAY` (useOperation `loading`).
  return {
    ...actions,
    loading: {
      addArea: create.loading,
      renameArea: rename.loading,
      archiveArea: archive.loading,
      restoreArea: restore.loading,
    },
  };
}

export type AreaActions = ReturnType<typeof useAreaActions>;
