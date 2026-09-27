import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type { AreaId, UserId } from './shared/ids';
import { err } from './shared/result';

/** The seven Area colors (`area-1` … `area-7` tokens in DESIGN.md). */
export type AreaColor = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * A user-defined area such as work or research (画面の語は「領域」).
 * Permanent views show the current name; Sprint screens use the name
 * captured in the Sprint's SprintAreaSnapshot. Renames are kept as
 * `areaRenamed` Activity entries.
 */
export interface Area {
  readonly id: AreaId;
  readonly userId: UserId;
  readonly name: string;
  readonly color: AreaColor;
  readonly order: number;
  readonly archived: boolean;
}

export interface CreateAreaInput {
  readonly id: AreaId;
  readonly userId: UserId;
  readonly name: string;
  readonly color: AreaColor;
  readonly order: number;
}

export function createArea(
  input: CreateAreaInput,
  ctx: CommandContext,
): CommandResult<Area> {
  const name = input.name.trim();
  if (name === '') return err('invalidInput', 'Area name is empty.');
  const area: Area = { ...input, name, archived: false };
  return applied(area, [
    {
      kind: 'areaCreated',
      at: ctx.now,
      actor: ctx.actor,
      areaId: area.id,
      name,
    },
  ]);
}

export function renameArea(
  area: Area,
  newName: string,
  ctx: CommandContext,
): CommandResult<Area> {
  const name = newName.trim();
  if (name === '') return err('invalidInput', 'Area name is empty.');
  if (name === area.name) return applied(area, []);
  return applied({ ...area, name }, [
    {
      kind: 'areaRenamed',
      at: ctx.now,
      actor: ctx.actor,
      areaId: area.id,
      from: area.name,
      to: name,
    },
  ]);
}

export function archiveArea(
  area: Area,
  ctx: CommandContext,
): CommandResult<Area> {
  if (area.archived) {
    return err('invalidTransition', 'Area is already archived.');
  }
  return applied({ ...area, archived: true }, [
    { kind: 'areaArchived', at: ctx.now, actor: ctx.actor, areaId: area.id },
  ]);
}

export function restoreArea(
  area: Area,
  ctx: CommandContext,
): CommandResult<Area> {
  if (!area.archived) return err('invalidTransition', 'Area is not archived.');
  return applied({ ...area, archived: false }, [
    { kind: 'areaRestored', at: ctx.now, actor: ctx.actor, areaId: area.id },
  ]);
}
