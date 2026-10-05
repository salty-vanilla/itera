import { createCn } from 'cn/config';

// Class merging that knows the DESIGN.md token names. Without this, the
// typography tokens (text-body, text-button …) would be taken for text colors
// and dropped when merged with text-ink, the elevation names for shadow colors,
// and the named dimensions (h-control-md …) would not replace each other.
// The `nowrap-phrase` utility (styles/globals.css) is a white-space class:
// unknown to the merge, it would be kept next to whitespace-nowrap or
// whitespace-normal and the CSS order, not the last class, would win.
// The lists are exported so that styles/tokens.test.ts can compare them with
// DESIGN.md.
export const tokenTextNames = [
  'display-l',
  'display-m',
  'goal',
  'reflection',
  'button',
  'heading',
  'subheading',
  'body-l',
  'body',
  'task',
  'label',
  'help',
  'meta',
  'kicker',
  'num-l',
  'num-m',
  'num-s',
  'code',
];
export const tokenShadowNames = ['overlay', 'modal', 'drag'];
export const tokenSpacingNames = [
  'control-sm',
  'control-md',
  'control-lg',
  'row-task',
  'row-touch',
  'row-menu',
  'target-min',
  'target-touch',
  'icon-s',
  'icon-m',
  'area-badge',
  'pane-nav',
  'pane-rail',
  'pane-list',
  'pane-list-slim',
  'pane-list-xl',
  'pane-list-slim-xl',
  'pane-sprint',
  'pane-today',
  'pane-rows',
  'pane-side',
  'toast',
  'drawer',
  'popover',
  'dialog-sm',
  'dialog-md',
  'dialog-lg',
];

export const cn = createCn({
  extend: {
    theme: {
      text: tokenTextNames,
      shadow: tokenShadowNames,
      spacing: tokenSpacingNames,
    },
    classGroups: { whitespace: ['nowrap-phrase'] },
  },
});
