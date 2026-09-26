import { createCn } from 'cn/config';

// Class merging that knows the DESIGN.md token names. Without this, the
// typography tokens (text-body, text-button …) would be taken for text colors
// and dropped when merged with text-ink, the elevation names for shadow colors,
// and the named dimensions (h-control-md …) would not replace each other.
export const cn = createCn({
  extend: {
    theme: {
      text: [
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
      ],
      shadow: ['overlay', 'modal', 'drag'],
      spacing: [
        'control-sm',
        'control-md',
        'control-lg',
        'row-task',
        'row-touch',
        'target-min',
        'target-touch',
        'icon-s',
        'icon-m',
        'area-badge',
        'pane-nav',
        'pane-rail',
        'pane-list',
        'pane-side',
        'drawer',
      ],
    },
  },
});
