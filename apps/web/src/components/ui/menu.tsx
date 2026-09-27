import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Menu. The drop-down for secondary actions of a row or
// a header. The trigger is the `…` IconButton or a Secondary Button
// (「並び順: 期限 ⌄」). Do not hide primary actions here and do not nest
// submenus. Put dangerous items last, after a separator.
//
// Keyboard (docs/design/accessibility.md): ↓ ↑ move, Home / End jump, Enter
// runs the item, Esc closes and returns focus to the trigger, Tab closes.

function Menu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="menu" {...props} />;
}

function MenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />;
}

type MenuContentProps = Omit<MenuPrimitive.Popup.Props, 'className'> &
  Pick<
    MenuPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  > & {
    className?: string;
  };

function MenuContent({
  className,
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: MenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="z-(--layer-popover) outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            // surface + border + elevation-overlay, rounded.md.
            'flex max-h-(--available-height) min-w-(--anchor-width) flex-col overflow-y-auto overscroll-contain',
            'rounded-md border border-border bg-surface p-1 text-ink shadow-overlay outline-none',
            // docs/design/foundations.md: Menu appears in duration-base.
            'transition-opacity duration-(--duration-base) ease-enter',
            'data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:ease-exit',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

// Shared by every kind of item. The item takes real focus, so the focus ring
// is inset (DESIGN.md common states: menu items use offset −2px). Hover and
// the highlight move together; a checked item keeps its here-subtle ground.
const itemClassName = [
  'relative flex w-full cursor-default items-center gap-2 rounded-sm px-3 text-left text-body whitespace-nowrap select-none',
  // 32px items; compact widths use the 44px touch size.
  'min-h-control-lg medium:min-h-row-menu',
  'transition-colors duration-(--duration-fast) ease-standard',
  'outline-none focus-visible:focus-ring-inset',
  'not-data-checked:hover:bg-surface-hover not-data-checked:data-highlighted:bg-surface-hover',
  '[&_svg]:pointer-events-none [&_svg]:size-icon-s [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-s)]',
  // Disabled follows the common state: canvas-subtle ground, ink-disabled.
  'data-disabled:cursor-not-allowed data-disabled:bg-canvas-subtle data-disabled:text-ink-disabled',
];

type MenuItemProps = Omit<MenuPrimitive.Item.Props, 'className'> & {
  /**
   * `danger` is for destructive actions (DESIGN.md Colors: danger). Put it
   * last, after a MenuSeparator.
   */
  variant?: 'default' | 'danger';
  className?: string;
};

function MenuItem({ variant = 'default', className, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-variant={variant}
      className={cn(
        itemClassName,
        variant === 'danger' ? 'text-danger' : 'text-ink',
        className,
      )}
      {...props}
    />
  );
}

// The check sits in a leading 16px slot so that checked and unchecked labels
// line up. Selection is here-subtle + check, never the colour alone.
function CheckSlot({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-icon-s shrink-0 items-center justify-center"
    >
      {children}
    </span>
  );
}

// Hover on a checked item keeps the here-subtle ground and shows the
// common hover outline (ink-muted) instead, so the selection stays visible.
const checkedClassName = [
  'data-checked:bg-here-subtle text-ink',
  'data-checked:hover:ring-1 data-checked:hover:ring-ink-muted data-checked:hover:ring-inset',
  'data-checked:data-highlighted:ring-1 data-checked:data-highlighted:ring-ink-muted data-checked:data-highlighted:ring-inset',
];

type MenuCheckboxItemProps = Omit<
  MenuPrimitive.CheckboxItem.Props,
  'className'
> & {
  className?: string;
};

/** A toggle in a menu: role="menuitemcheckbox" with aria-checked. */
function MenuCheckboxItem({
  className,
  children,
  closeOnClick = false,
  ...props
}: MenuCheckboxItemProps) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      closeOnClick={closeOnClick}
      className={cn(itemClassName, checkedClassName, className)}
      {...props}
    >
      <CheckSlot>
        <MenuPrimitive.CheckboxItemIndicator>
          <Check />
        </MenuPrimitive.CheckboxItemIndicator>
      </CheckSlot>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function MenuRadioGroup(props: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="menu-radio-group" {...props} />;
}

type MenuRadioItemProps = Omit<MenuPrimitive.RadioItem.Props, 'className'> & {
  className?: string;
};

/**
 * One choice of a MenuRadioGroup: role="menuitemradio" with aria-checked.
 * Choosing one closes the menu, as the choice is complete.
 */
function MenuRadioItem({
  className,
  children,
  closeOnClick = true,
  ...props
}: MenuRadioItemProps) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      closeOnClick={closeOnClick}
      className={cn(itemClassName, checkedClassName, className)}
      {...props}
    >
      <CheckSlot>
        <MenuPrimitive.RadioItemIndicator>
          <Check />
        </MenuPrimitive.RadioItemIndicator>
      </CheckSlot>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function MenuGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

type MenuGroupLabelProps = Omit<MenuPrimitive.GroupLabel.Props, 'className'> & {
  className?: string;
};

function MenuGroupLabel({ className, ...props }: MenuGroupLabelProps) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-group-label"
      className={cn('px-3 pt-2 pb-1 text-label text-ink-muted', className)}
      {...props}
    />
  );
}

type MenuSeparatorProps = Omit<MenuPrimitive.Separator.Props, 'className'> & {
  className?: string;
};

/** A border-soft line between groups of items. */
function MenuSeparator({ className, ...props }: MenuSeparatorProps) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn('-mx-1 my-1 h-px shrink-0 bg-border-soft', className)}
      {...props}
    />
  );
}

/**
 * DESIGN.md Kbd: the shortcut at the right end of an item, in the `code`
 * type. Keys are not highlighted with colour.
 */
function MenuShortcut({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="menu-shortcut"
      className={cn('ms-auto ps-4 text-code text-ink-subtle', className)}
      {...props}
    />
  );
}

export {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
};
