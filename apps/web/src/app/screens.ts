/** The four screens. */
export type ScreenId = 'today' | 'sprint' | 'backlog' | 'retro';

/** The four screens and their paths. The order is the navigation's. */
export const screens: readonly {
  readonly id: ScreenId;
  readonly path: `/${ScreenId}`;
  readonly label: string;
}[] = [
  { id: 'today', path: '/today', label: '今日' },
  { id: 'sprint', path: '/sprint', label: 'Sprint' },
  { id: 'backlog', path: '/backlog', label: 'Backlog' },
  { id: 'retro', path: '/retro', label: '振り返り' },
];
