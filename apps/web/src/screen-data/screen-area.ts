import type { AreaColor } from '@itera/api-contract';

/**
 * An Area as the Sprint screen shows it, or the Tasks without one
 * (`id: null`): the contract's types, as the plan and a confirmed Sprint
 * give them, with the Tasks without an Area as one group named 「領域なし」.
 */
export interface SprintArea {
  readonly id: string | null;
  readonly name: string;
  readonly color: AreaColor | 'none';
}

export const NO_AREA: SprintArea = {
  id: null,
  name: '領域なし',
  color: 'none',
};
