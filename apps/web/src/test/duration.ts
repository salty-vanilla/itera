import {
  within,
  type BoundFunctions,
  type queries,
} from '@testing-library/react';

// The 時間 field of a time typed in two fields (DurationField, #252), found
// by the group's name: 「見積もり」, 「かかった時間」, 「使える時間」.

type Scope = BoundFunctions<typeof queries>;
type Name = string | RegExp;

export function getHours(scope: Scope, name: Name): HTMLInputElement {
  const group = scope.getByRole('group', { name });
  return within(group).getByRole('textbox', { name: '時間' });
}

export async function findHours(
  scope: Scope,
  name: Name,
): Promise<HTMLInputElement> {
  const group = await scope.findByRole('group', { name });
  return within(group).getByRole('textbox', { name: '時間' });
}

export function queryHours(scope: Scope, name: Name): HTMLInputElement | null {
  const group = scope.queryByRole('group', { name });
  return group === null
    ? null
    : within(group).getByRole('textbox', { name: '時間' });
}

export function getMinutes(scope: Scope, name: Name): HTMLInputElement {
  const group = scope.getByRole('group', { name });
  return within(group).getByRole('textbox', { name: '分' });
}
