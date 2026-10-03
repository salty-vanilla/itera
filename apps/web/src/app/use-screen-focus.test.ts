import { afterEach, describe, expect, it } from 'vitest';
import { focusScreenHeading } from './use-screen-focus';

afterEach(() => {
  document.body.replaceChildren();
});

function screenWith(heading: string) {
  const main = document.createElement('main');
  main.innerHTML = `<h1>${heading}</h1><button>other</button>`;
  document.body.append(main);
  return main;
}

/** The mutation observer reports after the DOM changes. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

function replaceHeading(main: HTMLElement, text: string) {
  const heading = document.createElement('h1');
  heading.textContent = text;
  main.querySelector('h1')?.replaceWith(heading);
  return heading;
}

describe('focusScreenHeading', () => {
  it('puts the focus on the heading', () => {
    const main = screenWith('first');
    focusScreenHeading(main);
    expect(document.activeElement).toBe(main.querySelector('h1'));
  });

  it('follows the heading when it is replaced, however many times', async () => {
    const main = screenWith('reading');
    focusScreenHeading(main);
    const second = replaceHeading(main, 'reading again');
    await settled();
    expect(document.activeElement).toBe(second);
    const third = replaceHeading(main, 'the screen');
    await settled();
    expect(document.activeElement).toBe(third);
  });

  it('leaves the focus where the person put it', async () => {
    const main = screenWith('reading');
    focusScreenHeading(main);
    const other = main.querySelector('button')!;
    other.focus();
    replaceHeading(main, 'the screen');
    await settled();
    expect(document.activeElement).toBe(other);
  });

  it('stops following after a key is pressed', async () => {
    const main = screenWith('reading');
    focusScreenHeading(main);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    replaceHeading(main, 'the screen');
    await settled();
    expect(document.activeElement).toBe(document.body);
  });
});
