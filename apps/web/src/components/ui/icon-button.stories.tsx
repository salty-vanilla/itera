import type { Meta, StoryObj } from '@storybook/react-vite';
import { Ellipsis, PanelRight, Pencil, Save, Search, X } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from './icon-button';

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: {
    label: '閉じる',
    icon: <X aria-hidden />,
    variant: 'quiet',
    size: 'md',
    disabled: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['quiet', 'secondary'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    icon: { control: false },
    pressed: { control: 'boolean' },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** hover 400ms 後、またはキーボードのフォーカスで Tooltip にラベルが出る。 */
export const Playground: Story = {};

/**
 * 意味が広く共有されたアイコン（閉じる、…、編集、検索）だけに使う。
 * 同じ行に 3 つ以上並べず Menu にまとめる。
 */
export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton label="その他の操作" icon={<Ellipsis aria-hidden />} />
      <IconButton
        variant="secondary"
        label="検索"
        icon={<Search aria-hidden />}
      />
    </div>
  ),
};

/** md は 36px にアイコン 20px、sm は 28px にアイコン 16px。compact 幅ではどちらも 44px。 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton size="md" label="編集" icon={<Pencil aria-hidden />} />
      <IconButton size="sm" label="編集" icon={<Pencil aria-hidden />} />
    </div>
  ),
};

/**
 * pressed を渡すとトグルになる（aria-pressed）。押すと切り替わる。
 * 押した状態は墨の塗りに白抜きのアイコン（反転）で示し、淡い色の差に頼らない。
 */
export const Pressed: Story = {
  render: function PressedDemo() {
    const [pressed, setPressed] = useState(true);
    return (
      <IconButton
        label="詳細パネルを表示"
        icon={<PanelRight aria-hidden />}
        pressed={pressed}
        onClick={() => setPressed((value) => !value)}
      />
    );
  },
};

/** 押すと 2 秒間 Loading になる。アイコンがスピナーに替わり、名前も「保存中…」になる。 */
export const Loading: Story = {
  render: function LoadingDemo() {
    const [loading, setLoading] = useState(false);
    return (
      <IconButton
        variant="secondary"
        label="下書きを保存"
        icon={<Save aria-hidden />}
        loading={loading}
        loadingLabel="保存中…"
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 2000);
        }}
      />
    );
  },
};

const states = ['default', 'hover', 'focus', 'hover-focus', 'active'] as const;

/**
 * DESIGN.md「共通の状態」で IconButton に必須の状態。Hover・Focus・Active は
 * storybook-addon-pseudo-states で強制表示している。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      hover: ['[data-demo="hover"]', '[data-demo="hover-focus"]'],
      focusVisible: ['[data-demo="focus"]', '[data-demo="hover-focus"]'],
      active: ['[data-demo="active"]'],
    },
  },
  render: () => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-left">
        <thead>
          <tr className="text-label text-ink-muted">
            <th scope="col" className="px-3 py-2">
              variant
            </th>
            {states.map((state) => (
              <th key={state} scope="col" className="px-3 py-2">
                {state}
              </th>
            ))}
            <th scope="col" className="px-3 py-2">
              pressed
            </th>
            <th scope="col" className="px-3 py-2">
              pressed + hover
            </th>
            <th scope="col" className="px-3 py-2">
              disabled
            </th>
            <th scope="col" className="px-3 py-2">
              loading
            </th>
          </tr>
        </thead>
        <tbody>
          {(['quiet', 'secondary'] as const).map((variant) => (
            <tr key={variant}>
              <th scope="row" className="px-3 py-3 text-label text-ink-muted">
                {variant}
              </th>
              {states.map((state) => (
                <td key={state} className="px-3 py-3">
                  <IconButton
                    variant={variant}
                    label="その他の操作"
                    icon={<Ellipsis aria-hidden />}
                    data-demo={state}
                  />
                </td>
              ))}
              <td className="px-3 py-3">
                <IconButton
                  variant={variant}
                  label="詳細パネルを表示"
                  icon={<PanelRight aria-hidden />}
                  pressed
                />
              </td>
              <td className="px-3 py-3">
                <IconButton
                  variant={variant}
                  label="詳細パネルを表示"
                  icon={<PanelRight aria-hidden />}
                  pressed
                  data-demo="hover"
                />
              </td>
              <td className="px-3 py-3">
                <IconButton
                  variant={variant}
                  label="その他の操作"
                  icon={<Ellipsis aria-hidden />}
                  disabled
                />
              </td>
              <td className="px-3 py-3">
                <IconButton
                  variant={variant}
                  label="下書きを保存"
                  icon={<Save aria-hidden />}
                  loading
                  loadingLabel="保存中…"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};
