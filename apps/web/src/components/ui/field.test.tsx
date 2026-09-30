import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from './field';
import { Select } from './select';
import { TextInput } from './text-input';
import { Textarea } from './textarea';

afterEach(cleanup);

function describedBy(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);
}

describe('Field', () => {
  it('names the control with the label and the necessity word', () => {
    render(
      <Field label="見積もり" necessity="required">
        <TextInput />
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: '見積もり必須' })).toBeTruthy();
  });

  it('ties the support text and the error to the control', () => {
    render(
      <Field
        label="見積もり"
        description="0.5時間単位"
        error="数値で入力してください（例: 1.5）"
      >
        <TextInput defaultValue="abc" suffix="h" />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: '見積もり' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(input)).toEqual([
      '0.5時間単位',
      '数値で入力してください（例: 1.5）',
    ]);
    // The error does not clear what was entered.
    expect((input as HTMLInputElement).value).toBe('abc');
  });

  it('has no error attributes without an error', () => {
    render(
      <Field label="タイトル">
        <TextInput />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'タイトル' });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText('数値で入力してください')).toBeNull();
  });

  it('keeps a hidden label as the accessible name', () => {
    render(
      <Field label="タスクを検索" hideLabel>
        <TextInput type="search" />
      </Field>,
    );
    expect(
      screen.getByRole('searchbox', { name: 'タスクを検索' }),
    ).toBeTruthy();
  });

  it('focuses the input when the unit is pressed', async () => {
    render(
      <Field label="使える時間">
        <TextInput suffix="h" />
      </Field>,
    );
    await userEvent.click(screen.getByText('h'));
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: '使える時間' }),
    );
  });

  it('disables the control', () => {
    render(
      <Field label="タイトル" disabled>
        <TextInput />
      </Field>,
    );
    expect(
      (screen.getByRole('textbox', { name: 'タイトル' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });
});

describe('Textarea', () => {
  it('counts characters against the limit and reads the count', async () => {
    render(
      <Field label="気になったこと" error="200文字以内で入力してください">
        <Textarea maxLength={200} defaultValue="見積" />
      </Field>,
    );
    const textarea = screen.getByRole('textbox', { name: '気になったこと' });
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(screen.getByText('2 / 200')).toBeTruthy();
    await userEvent.type(textarea, 'もり');
    expect(screen.getByText('4 / 200')).toBeTruthy();
    expect(describedBy(textarea)).toEqual([
      '4 / 2004文字（上限 200文字）',
      '200文字以内で入力してください',
    ]);
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('Select', () => {
  it('is a native select named by the label', async () => {
    render(
      <Field label="領域" description="あとから変えられます。">
        <Select defaultValue="">
          <option value="">領域なし</option>
          <option value="work">仕事</option>
          <option value="research">研究</option>
        </Select>
      </Field>,
    );
    const select = screen.getByRole('combobox', { name: '領域' });
    expect(select.tagName).toBe('SELECT');
    expect(describedBy(select)).toEqual(['あとから変えられます。']);
    await userEvent.selectOptions(select, 'research');
    expect((select as HTMLSelectElement).value).toBe('research');
  });
});

describe('Textarea handlers', () => {
  it('still calls onChange', async () => {
    const values: string[] = [];
    render(
      <Field label="目標">
        <Textarea onChange={(event) => values.push(event.target.value)} />
      </Field>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: '目標' }), 'ab');
    expect(values).toEqual(['a', 'ab']);
  });
});
