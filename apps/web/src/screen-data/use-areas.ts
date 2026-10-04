import type { AreaId, EditableArea } from '@itera/api-contract';
import { listAreasOptions } from '@itera/api-contract/react-query';
import type { MadeFrom } from '@itera/api-contract/requests';
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
  const create = useOperation('createArea');
  const rename = useOperation('renameArea', { typed: true });
  const archive = useOperation('archiveArea');
  const restore = useOperation('restoreArea');
  const actions = {
    /** The new Area's ID, or `undefined` when it did not go through. */
    addArea: async (name: string): Promise<AreaId | undefined> => {
      const outcome = await create.run({ name });
      return outcome.ok ? outcome.value.areaId : undefined;
    },
    /** `from`: the Area as read when its name was typed (#321). */
    renameArea: async (areaId: AreaId, name: string, from: MadeFrom) =>
      (await rename.run({ areaId, name }, from)).ok,
    archiveArea: async (areaId: AreaId) => (await archive.run({ areaId })).ok,
    restoreArea: async (areaId: AreaId) => (await restore.run({ areaId })).ok,
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
