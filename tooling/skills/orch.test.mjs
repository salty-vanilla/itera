// issue-harness's orch.mjs against a fake `orca` on PATH: what it refuses
// before calling orca, which arguments it passes, and how it reads orca's
// failures. The fake answers from a scenario module each test writes.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  makeTempDir,
  removeTempDir,
  writeExecutable,
  writeFile,
} from '../test-support.mjs';

const orch = fileURLToPath(
  new URL(
    '../../.agents/skills/issue-harness/scripts/orch.mjs',
    import.meta.url,
  ),
);

// Logs each call, then answers with the scenario's `respond(args, calls)`:
// `{ json }` prints JSON, `{ stdout, stderr, status }` prints them as is.
// Without an answer it prints `{ "ok": true, "result": {} }`.
const fakeOrca = `#!${process.execPath}
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = process.env.FAKE_ORCA_DIR;
const log = join(dir, 'calls.jsonl');
const args = process.argv.slice(2);
const calls = existsSync(log)
  ? readFileSync(log, 'utf8').split('\\n').filter(Boolean).map((l) => JSON.parse(l))
  : [];
appendFileSync(log, JSON.stringify(args) + '\\n');
const { default: respond } = await import(pathToFileURL(join(dir, 'scenario.mjs')).href);
const answer = respond(args, calls) ?? { json: { ok: true, result: {} } };
if ('json' in answer) process.stdout.write(JSON.stringify(answer.json));
if (answer.stdout) process.stdout.write(answer.stdout);
if (answer.stderr) process.stderr.write(answer.stderr);
process.exitCode = answer.status ?? 0;
`;

// A send waits 2 s (3 s when the prompt is blocked) before reading the screen.
const SEND_TIMEOUT = 15_000;

let root;
let state;

beforeEach(() => {
  root = makeTempDir('orch');
  state = join(root, 'state');
  writeExecutable(join(root, 'bin', 'orca'), fakeOrca);
  writeFile(
    join(state, 'run.json'),
    JSON.stringify({
      run: 'run_1',
      cwd: root,
      repo: 'repo_1',
      coordinatorTerminal: 'term_coord',
    }),
  );
  scenario('() => undefined');
});
afterEach(() => removeTempDir(root));

/** @param {string} source the body of `respond(args, calls)` */
function scenario(source) {
  writeFile(join(root, 'scenario.mjs'), `export default ${source};\n`);
}

const env = () => ({
  ...process.env,
  PATH: `${join(root, 'bin')}${delimiter}${process.env.PATH}`,
  FAKE_ORCA_DIR: root,
});

/** @param {string[]} args */
function run(args) {
  return spawnSync(process.execPath, [orch, ...args], {
    cwd: root,
    env: env(),
    encoding: 'utf8',
  });
}

/** @returns {string[][]} each call's arguments, without the trailing --json */
function calls() {
  const log = join(root, 'calls.jsonl');
  if (!existsSync(log)) return [];
  return readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((args) => {
      expect(args.at(-1)).toBe('--json');
      return args.slice(0, -1);
    });
}

const value = (args, flag) => args[args.indexOf(flag) + 1];
const readState = (name) => readFileSync(join(state, name), 'utf8');
const writeState = (name, content) => writeFile(join(state, name), content);

// A terminal read that shows `lines` on both the screen and the scrollback.
const screen = (lines) =>
  `(args) => args[0] === 'terminal' && args[1] === 'read'
    ? { json: { ok: true, result: { terminal: { tail: ${JSON.stringify(lines)} } } } }
    : undefined`;

describe('orch.mjs arguments', () => {
  it.each([[[]], [['task', 'state-only']], [['monitor']]])(
    'prints the usage for %j',
    (args) => {
      const result = run(args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('usage: node orch.mjs');
      expect(calls()).toEqual([]);
    },
  );

  it('refuses an unknown command', () => {
    const result = run(['nope', state, 'a']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown command: nope');
    expect(calls()).toEqual([]);
  });
});

describe('orch.mjs task', () => {
  const options = (key, extra = []) => [
    'task',
    state,
    key,
    '--spec-file',
    join(root, 'spec.md'),
    '--slug',
    `i-${key}`,
    '--base',
    'feature/x',
    '--model',
    'opus',
    '--effort',
    'high',
    ...extra,
  ];

  beforeEach(() => {
    writeFile(join(root, 'spec.md'), 'the spec\n');
    // task-create answers task_<n> for the n-th call.
    scenario(`(args, calls) => ({
      json: { ok: true, result: { task: { id: 'task_' + (calls.length + 1), status: 'pending' } } },
    })`);
  });

  it.each(['spec-file', 'slug', 'base', 'model', 'effort'])(
    'needs --%s before calling orca',
    (name) => {
      const args = options('a');
      args.splice(args.indexOf(`--${name}`), 2);
      const result = run(args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`task needs --${name}`);
      expect(calls()).toEqual([]);
      expect(existsSync(join(state, 'tasks.json'))).toBe(false);
    },
  );

  it('creates the task in the run and records it under the key', () => {
    const result = run(options('a'));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('a task_1 pending\n');
    expect(calls()).toEqual([
      [
        'orchestration',
        'task-create',
        '--run',
        'run_1',
        '--spec',
        'the spec\n',
      ],
    ]);
    expect(JSON.parse(readState('tasks.json'))).toEqual({
      a: {
        task: 'task_1',
        slug: 'i-a',
        base: 'feature/x',
        model: 'opus',
        effort: 'high',
      },
    });
  });

  it('refuses a key it already has', () => {
    run(options('a'));
    const result = run(options('a'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('exists: a task_1');
    expect(calls()).toHaveLength(1);
  });

  it('passes --deps as task IDs in the order given', () => {
    run(options('a'));
    run(options('b'));
    const result = run(options('c', ['--deps', 'b,a']));
    expect(result.status).toBe(0);
    const create = calls()[2] ?? [];
    expect(value(create, '--deps')).toBe('["task_2","task_1"]');
  });

  it('refuses --deps it has no task for, before calling orca', () => {
    run(options('a'));
    const result = run(options('c', ['--deps', 'a,x,y']));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing deps: x,y');
    expect(calls()).toHaveLength(1);
    expect(Object.keys(JSON.parse(readState('tasks.json')))).toEqual(['a']);
  });

  it.each([
    [
      'an error code',
      `() => ({ json: { ok: false, error: { code: 'run_not_found', message: 'no run' } } })`,
      'task-create failed: run_not_found',
    ],
    [
      'an error message',
      `() => ({ json: { ok: false, error: { message: 'no run' } } })`,
      'task-create failed: no run',
    ],
    [
      'a string error',
      `() => ({ json: { ok: false, error: 'bad' } })`,
      'task-create failed: bad',
    ],
    [
      'output that is not JSON, with stderr',
      `() => ({ stdout: 'Error: oops', stderr: 'orca: not connected', status: 1 })`,
      'task-create failed: orca: not connected',
    ],
    [
      'output that is not JSON, without stderr',
      `() => ({ stdout: 'Error: oops', status: 1 })`,
      'task-create failed: Error: oops',
    ],
  ])('fails on %s and records nothing', (_, answer, message) => {
    scenario(answer);
    const result = run(options('a'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(existsSync(join(state, 'tasks.json'))).toBe(false);
  });

  it('fails when orca cannot be run', () => {
    const result = spawnSync(process.execPath, [orch, ...options('a')], {
      cwd: root,
      env: { ...env(), PATH: join(root, 'empty') },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'task-create failed: Error: spawnSync orca ENOENT',
    );
  });
});

describe('orch.mjs send', { timeout: SEND_TIMEOUT }, () => {
  beforeEach(() => {
    writeState('i-a.term', 'term_w ctx_1\n');
    scenario(screen(['❯ hello there']));
  });

  it('mails the dispatch, types into the terminal and sees the text', () => {
    const result = run(['send', state, 'i-a', '--text', ' hello there\n']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('mail true \nterminal true \ndelivered\n');
    expect(calls()).toEqual([
      [
        'orchestration',
        'send',
        '--to',
        'dispatch:ctx_1',
        '--subject',
        '司令塔より',
        '--body',
        'hello there',
      ],
      [
        'terminal',
        'send',
        '--terminal',
        'term_w',
        '--text',
        'hello there',
        '--enter',
      ],
      ['terminal', 'read', '--terminal', 'term_w', '--screen'],
    ]);
  });

  it('reads the text from --file', () => {
    writeFile(join(root, 'note.txt'), 'from a file\nsecond line\n');
    const result = run([
      'send',
      state,
      'i-a',
      '--file',
      join(root, 'note.txt'),
    ]);
    expect(result.status).toBe(0);
    expect(value(calls()[1] ?? [], '--text')).toBe('from a file\nsecond line');
  });

  it('skips the mail with --no-mail, even without a dispatch', () => {
    writeState('i-a.term', 'term_w\n');
    const result = run(['send', state, 'i-a', '--text', 'hello', '--no-mail']);
    expect(result.status).toBe(0);
    expect(calls().map((args) => args.slice(0, 2).join(' '))).toEqual([
      'terminal send',
      'terminal read',
    ]);
  });

  // An empty --terminal would type into the coordinator's own terminal.
  it.each(['', '\n', '   \n'])(
    'refuses an empty terminal (%j in the .term file) before calling orca',
    (content) => {
      writeState('i-a.term', content);
      const result = run(['send', state, 'i-a', '--text', 'hello']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('refused: empty terminal');
      expect(calls()).toEqual([]);
    },
  );

  it.each([' ', '\n\n'])(
    'refuses an empty text (%j) before calling orca',
    (text) => {
      const result = run(['send', state, 'i-a', '--text', text]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('refused: empty text');
      expect(calls()).toEqual([]);
    },
  );

  it('refuses an empty file before calling orca', () => {
    writeFile(join(root, 'empty.txt'), '\n');
    const result = run([
      'send',
      state,
      'i-a',
      '--file',
      join(root, 'empty.txt'),
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refused: empty text');
    expect(calls()).toEqual([]);
  });

  it('refuses a missing dispatch when it would mail', () => {
    writeState('i-a.term', 'term_w\n');
    const result = run(['send', state, 'i-a', '--text', 'hello']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refused: empty dispatch');
    expect(calls()).toEqual([]);
  });

  it.each([
    [['--text', ''], 'neither'],
    [['--text', 'a', '--file', 'b'], 'both'],
  ])('needs exactly one of --text and --file: %j (%s)', (args) => {
    const result = run(['send', state, 'i-a', ...args]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('send needs one of --text or --file');
    expect(calls()).toEqual([]);
  });

  it('sends the text and Enter apart when the prompt is blocked', () => {
    scenario(`(args, calls) => {
      if (args[0] === 'terminal' && args[1] === 'send' && args.includes('--enter') && args.includes('--text'))
        return { json: { ok: false, error: { code: 'agent_prompt_blocked' } } };
      return (${screen(['hello'])})(args);
    }`);
    const result = run(['send', state, 'i-a', '--text', 'hello', '--no-mail']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('terminal true \ndelivered\n');
    expect(calls().slice(0, 3)).toEqual([
      [
        'terminal',
        'send',
        '--terminal',
        'term_w',
        '--text',
        'hello',
        '--enter',
      ],
      ['terminal', 'send', '--terminal', 'term_w', '--text', 'hello'],
      ['terminal', 'send', '--terminal', 'term_w', '--enter'],
    ]);
  });

  it('reports orca output that is not JSON and a text it does not see', () => {
    scenario(`(args) => args[0] === 'terminal' && args[1] === 'send'
      ? { stdout: 'panic: lost', status: 2 }
      : (${screen(['something else'])})(args)`);
    const result = run(['send', state, 'i-a', '--text', 'hello', '--no-mail']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'terminal false panic: lost\nNOT SEEN on term_w: read the screen before going on\n',
    );
  });
});

describe('orch.mjs start', { timeout: SEND_TIMEOUT }, () => {
  const started = {
    ok: true,
    result: {
      state: 'running',
      dispatchId: 'ctx_1',
      effects: [
        { kind: 'worktree', id: 'wt_1' },
        { kind: 'terminal', role: 'shell', id: 'term_shell' },
        { kind: 'terminal', role: 'agent', id: 'term_w' },
      ],
    },
  };

  beforeEach(() => {
    writeState(
      'tasks.json',
      JSON.stringify({
        a: {
          task: 'task_1',
          slug: 'i-a',
          base: 'feature/x',
          model: 'opus',
          effort: 'high',
        },
      }),
    );
    writeState('startup-note.txt', 'startup note\n');
  });

  it('refuses an unknown key before calling orca', () => {
    const result = run(['start', state, 'b']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown task key: b');
    expect(calls()).toEqual([]);
  });

  it('starts the worker, records its terminal and sends the startup note', () => {
    scenario(`(args) => args[1] === 'worker-start'
      ? { json: ${JSON.stringify(started)} }
      : (${screen(['startup note'])})(args)`);
    const result = run(['start', state, 'a']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'i-a running ctx_1 term_w\nmail true \nterminal true \ndelivered\n',
    );
    const [start, mail, terminal] = calls();
    expect(start).toEqual([
      'orchestration',
      'worker-start',
      '--task',
      'task_1',
      '--run',
      'run_1',
      '--worktree',
      'new-top-level',
      '--repo',
      'repo_1',
      '--name',
      'i-a',
      '--base-branch',
      'origin/feature/x',
      '--agent',
      'claude',
      '--model',
      'opus',
      '--effort',
      'high',
      '--setup',
      'run',
      '--timeout-ms',
      '240000',
    ]);
    expect(value(mail ?? [], '--to')).toBe('dispatch:ctx_1');
    expect(value(terminal ?? [], '--terminal')).toBe('term_w');
    expect(value(terminal ?? [], '--text')).toBe('startup note');
    expect(readState('i-a.term')).toBe('term_w ctx_1\n');
    expect(JSON.parse(readState('start-i-a.json'))).toEqual(started);
  });

  it.each([
    [
      'no agent terminal',
      { ...started, result: { ...started.result, effects: [] } },
    ],
    [
      'no dispatch',
      { ...started, result: { ...started.result, dispatchId: undefined } },
    ],
    [
      'a failure',
      { ok: false, error: { code: 'worktree_failed' }, result: started.result },
    ],
  ])('stops without the note on %s', (_, answer) => {
    scenario(`() => ({ json: ${JSON.stringify(answer)} })`);
    const result = run(['start', state, 'a']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('START FAILED i-a');
    expect(result.stderr).toContain('(note not sent)');
    expect(calls()).toHaveLength(1);
    expect(existsSync(join(state, 'i-a.term'))).toBe(false);
  });
});

describe('orch.mjs monitor', { timeout: SEND_TIMEOUT }, () => {
  /**
   * Runs the monitor until its output contains `until`, then stops it. Its
   * first round runs at once; the next comes 45 s later.
   * @returns {Promise<string>}
   */
  function monitorUntil(until) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [orch, 'monitor', state], {
        cwd: root,
        env: env(),
      });
      let out = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`monitor never printed ${until}:\n${out}`));
      }, 10_000);
      child.stdout.on('data', (chunk) => {
        out += chunk;
        if (out.includes(until)) {
          clearTimeout(timer);
          child.kill();
          resolve(out);
        }
      });
      child.stderr.on('data', (chunk) => (out += chunk));
    });
  }

  const workers = `[
    { dispatchId: 'ctx_1', taskId: 'task_1', dispatchStatus: 'dispatched', agentTerminalHandle: 'term_w' },
    { dispatchId: 'ctx_2', taskId: 'task_2', dispatchStatus: 'completed', agentTerminalHandle: 'term_done' },
  ]`;

  it('reports mail other than heartbeats, without acking it', async () => {
    scenario(`(args) => {
      if (args[1] === 'check') return { json: { ok: true, result: { deliveryId: 'd1', messages: [
        { id: 'm0', type: 'heartbeat', payload: '{}' },
        { id: 'm1', type: 'worker_done', payload: '{"taskId":"task_1"}', subject: 'done' },
        { id: 'm2', type: 'escalation', payload: 'not json', subject: 'blocked' },
      ] } } };
      if (args[1] === 'worker-list') return { json: { ok: true, result: { workers: [] } } };
      return { json: { ok: true, result: { terminal: { tail: ['coordinator'] } } } };
    }`);
    const out = await monitorUntil('m2');
    expect(out).toContain(
      '[MSG] worker_done m1 delivery=d1 (2 in batch) task=task_1 :: done',
    );
    expect(out).toContain(
      '[MSG] escalation m2 delivery=d1 (2 in batch) task=null :: blocked',
    );
    expect(out).not.toContain('m0');
    expect(calls().filter((args) => args.includes('--ack'))).toEqual([]);
  });

  it('acks a delivery of heartbeats only', async () => {
    scenario(`(args) => {
      if (args[1] === 'check' && !args.includes('--ack'))
        return { json: { ok: true, result: { deliveryId: 'd1', messages: [{ id: 'm0', type: 'heartbeat' }] } } };
      if (args[1] === 'worker-list') return { json: { ok: true, result: { workers: ${workers} } } };
      return (${screen(['esc to interrupt'])})(args);
    }`);
    // The worker is busy, so the round prints nothing; wait for its last read.
    await waitForCall((args) => value(args, '--terminal') === 'term_coord');
    expect(calls().filter((args) => args.includes('--ack'))).toEqual([
      ['orchestration', 'check', '--run', 'run_1', '--ack', 'd1'],
    ]);
    // Only dispatched workers are read.
    expect(calls().some((args) => args.includes('term_done'))).toBe(false);
  });

  it('alerts on a permission dialog and on a 5 h usage of 90% or more', async () => {
    scenario(`(args) => {
      if (args[1] === 'check') return { json: { ok: true, result: {} } };
      if (args[1] === 'worker-list') return { json: { ok: true, result: { workers: ${workers} } } };
      const terminal = args[args.indexOf('--terminal') + 1];
      const tail = terminal === 'term_w'
        ? ['Bash command', '  rm -rf x', 'Do you want to proceed?', '❯ 1. Yes']
        : ['status 5h 93%'];
      return { json: { ok: true, result: { terminal: { tail } } } };
    }`);
    const out = await monitorUntil('USAGE');
    expect(out).toContain(
      '[ALERT] ctx_1 task_1 state=permission term=term_w :: Bash command',
    );
    expect(out).toContain(
      '[ALERT] USAGE 5h 93% (>= 90): pause launches and merges',
    );
  });

  /** Runs the monitor until a call matches, then stops it. */
  async function waitForCall(match) {
    const child = spawn(process.execPath, [orch, 'monitor', state], {
      cwd: root,
      env: env(),
    });
    try {
      for (let i = 0; i < 100; i += 1) {
        if (calls().some(match)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('monitor never made the call');
    } finally {
      child.kill();
    }
  }
});
