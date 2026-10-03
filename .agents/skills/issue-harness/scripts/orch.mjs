#!/usr/bin/env node
// Orca で司令塔を動かすときの補助。使い方は ../references/coordinate-orca.md。
//
//   node orch.mjs task    <state-dir> <key> --spec-file F --slug S --base B --model M --effort E [--deps k1,k2]
//   node orch.mjs start   <state-dir> <key>
//   node orch.mjs send    <state-dir> <slug> (--text T | --file F) [--no-mail]
//   node orch.mjs monitor <state-dir>
//
// Orca 1.4.197 で使った形。フラグが変わったら `orca skills get orchestration` に合わせて直す。
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const load = (state) => readJson(join(state, 'run.json'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function orca(args, cwd) {
  const out = spawnSync('orca', [...args, '--json'], { cwd, encoding: 'utf8' });
  try {
    return JSON.parse(out.stdout);
  } catch {
    const message = out.stderr || out.stdout || String(out.error ?? '');
    return { ok: false, error: { message: message.slice(0, 300) } };
  }
}

function errorCode(result) {
  const error = result.error;
  if (error && typeof error === 'object') return error.code || error.message || '';
  return String(error ?? '');
}

// 空の --terminal は、今の worktree の active terminal（司令塔自身）に入力される。
function requireValue(value, what) {
  if (!value || !String(value).trim()) fail(`refused: empty ${what}`);
}

function tail(cwd, terminal, screen) {
  const range = screen ? ['--screen'] : ['--limit', '40'];
  const result = orca(['terminal', 'read', '--terminal', terminal, ...range], cwd);
  return result.result?.terminal?.tail ?? [];
}

async function send(cwd, terminal, dispatch, text, mail = true) {
  requireValue(terminal, 'terminal');
  requireValue(text, 'text');
  if (mail) {
    requireValue(dispatch, 'dispatch');
    const r = orca(
      ['orchestration', 'send', '--to', `dispatch:${dispatch}`, '--subject', '司令塔より', '--body', text],
      cwd,
    );
    console.log('mail', r.ok, errorCode(r));
  }
  let r = orca(['terminal', 'send', '--terminal', terminal, '--text', text, '--enter'], cwd);
  if (!r.ok && errorCode(r).includes('agent_prompt_blocked')) {
    // 中断の後は、--text と --enter を別々に送ると通る。
    r = orca(['terminal', 'send', '--terminal', terminal, '--text', text], cwd);
    if (r.ok) {
      await sleep(1000);
      r = orca(['terminal', 'send', '--terminal', terminal, '--enter'], cwd);
    }
  }
  console.log('terminal', r.ok, errorCode(r));
  await sleep(2000);
  const head = text.trim().split('\n')[0].slice(0, 20);
  const seen = tail(cwd, terminal, true).some((line) => line.includes(head));
  console.log(seen ? 'delivered' : `NOT SEEN on ${terminal}: read the screen before going on`);
}

function createTask(state, key, options) {
  const run = load(state);
  const path = join(state, 'tasks.json');
  const ids = existsSync(path) ? readJson(path) : {};
  if (ids[key]) fail(`exists: ${key} ${ids[key].task}`);
  for (const name of ['spec-file', 'slug', 'base', 'model', 'effort']) {
    if (!options[name]) fail(`task needs --${name}`);
  }
  const args = ['orchestration', 'task-create', '--run', run.run, '--spec', readFileSync(options['spec-file'], 'utf8')];
  if (options.deps) {
    const deps = options.deps.split(',');
    const missing = deps.filter((d) => !ids[d]);
    if (missing.length > 0) fail(`missing deps: ${missing.join(',')}`);
    args.push('--deps', JSON.stringify(deps.map((d) => ids[d].task)));
  }
  const result = orca(args, run.cwd);
  const task = result.result?.task ?? {};
  if (!task.id) fail(`task-create failed: ${errorCode(result)}`);
  const { slug, base, model, effort } = options;
  ids[key] = { task: task.id, slug, base, model, effort };
  writeFileSync(path, JSON.stringify(ids, null, 1));
  console.log(key, task.id, task.status);
}

async function startWorker(state, key) {
  const run = load(state);
  const t = readJson(join(state, 'tasks.json'))[key];
  if (!t) fail(`unknown task key: ${key}`);
  const result = orca(
    [
      'orchestration', 'worker-start', '--task', t.task, '--run', run.run,
      '--worktree', 'new-top-level', '--repo', run.repo, '--name', t.slug,
      '--base-branch', `origin/${t.base}`, '--agent', 'claude',
      '--model', t.model, '--effort', t.effort, '--setup', 'run', '--timeout-ms', '240000',
    ],
    run.cwd,
  );
  writeFileSync(join(state, `start-${t.slug}.json`), JSON.stringify(result, null, 1));
  const r = result.result ?? {};
  const terminal = (r.effects ?? []).find((e) => e.kind === 'terminal' && e.role === 'agent')?.id;
  const dispatch = r.dispatchId;
  if (!(result.ok && terminal && dispatch)) fail(`START FAILED ${t.slug}: ${errorCode(result)} (note not sent)`);
  writeFileSync(join(state, `${t.slug}.term`), `${terminal} ${dispatch}\n`);
  console.log(t.slug, r.state, dispatch, terminal);
  await send(run.cwd, terminal, dispatch, readFileSync(join(state, 'startup-note.txt'), 'utf8').trim());
}

async function sendTo(state, slug, options) {
  const run = load(state);
  const [terminal = '', dispatch = ''] = readFileSync(join(state, `${slug}.term`), 'utf8').trim().split(/\s+/);
  if (Boolean(options.text) === Boolean(options.file)) fail('send needs one of --text or --file');
  const text = options.text ?? readFileSync(options.file, 'utf8');
  await send(run.cwd, terminal, dispatch, text.trim(), !options['no-mail']);
}

const BUSY = new RegExp(
  [
    String.raw`…\s*\(?\s*\d+\s*[hms]`,
    String.raw`Running \d+ shell`,
    String.raw`Waiting for \d+ background agent`,
    'esc to interrupt',
    String.raw`ctrl\+b to run in background`,
    String.raw`harness-reviewer\s`,
    String.raw`^[\s·✢✳✶✻✽*⏺]+[A-Za-z]*[A-Z][a-z]+(?:-[a-z]+)?…`,
  ].join('|'),
  'm',
);
const DIALOG = /Do you want to proceed|requires confirmation|❯ 1\. Yes/;
// ステータスラインが 5 時間の利用上限の使用率を「5h NN%」と出す場合だけ読める。
const USAGE = /5h (\d+)%/;
const INTERVAL_MS = 45_000;
const IDLE_GRACE = 4;

async function monitor(state) {
  const { cwd, run: runId, coordinatorTerminal } = load(state);

  function classify(terminal) {
    const screen = tail(cwd, terminal, true);
    const text = screen.join('\n');
    if (DIALOG.test(text)) {
      const line = screen.find((l) => l.includes('requires confirmation') || l.includes('Bash command'));
      return ['permission', line?.trim() ?? 'permission dialog'];
    }
    if (text.includes('What should Claude do instead')) return ['interrupted', 'Interrupted'];
    const out = tail(cwd, terminal, false);
    if (BUSY.test(out.slice(-15).join('\n')) || BUSY.test(screen.slice(-12).join('\n'))) return ['busy', ''];
    if (out.length === 0 && screen.length === 0) return ['unreadable', 'no output'];
    const lastLine = [...out].reverse().find((l) => l.trim() && !/^[─❯⏵]/.test(l.trim()));
    return ['idle', lastLine?.trim().slice(0, 120) ?? ''];
  }

  const last = new Map();
  const idle = new Map();
  const seen = new Set();
  const ignoreIdle = new Set((process.env.IGNORE_IDLE ?? '').split(',').filter(Boolean));
  let paused = process.env.USAGE_PAUSED === '1';
  for (;;) {
    // メール：heartbeat だけの Delivery は ack し、それ以外は知らせる（ack は司令塔が全件を処理してから行う）。
    const mail = orca(['orchestration', 'check', '--run', runId], cwd).result ?? {};
    const messages = mail.messages ?? [];
    const actionable = messages.filter((m) => m.type !== 'heartbeat');
    if (mail.deliveryId && messages.length > 0 && actionable.length === 0) {
      orca(['orchestration', 'check', '--run', runId, '--ack', mail.deliveryId], cwd);
    }
    for (const m of actionable) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      let task = null;
      try {
        task = JSON.parse(m.payload || '{}').taskId ?? null;
      } catch {
        // payload が JSON でなければ Task は出さない。
      }
      console.log(
        `[MSG] ${m.type} ${m.id} delivery=${mail.deliveryId} (${actionable.length} in batch) task=${task} :: ${(m.subject ?? '').slice(0, 100)}`,
      );
    }
    // worker の画面
    const workers = (orca(['orchestration', 'worker-list', '--run', runId], cwd).result?.workers ?? []).filter(
      (w) => w.dispatchStatus === 'dispatched' && w.agentTerminalHandle,
    );
    for (const w of workers) {
      const { dispatchId: id, agentTerminalHandle: terminal } = w;
      const [status, detail] = classify(terminal);
      if (status === 'idle') {
        idle.set(id, (idle.get(id) ?? 0) + 1);
        if (idle.get(id) < IDLE_GRACE) continue;
      } else {
        idle.set(id, 0);
      }
      if (status === last.get(id)) continue;
      last.set(id, status);
      if (status === 'busy' || (status === 'idle' && ignoreIdle.has(id))) continue;
      console.log(`[ALERT] ${id} ${w.taskId} state=${status} term=${terminal} :: ${detail}`);
    }
    // 5 時間の利用上限
    const values = [coordinatorTerminal, ...workers.map((w) => w.agentTerminalHandle)].flatMap((terminal) =>
      tail(cwd, terminal, true)
        .slice(-6)
        .map((line) => USAGE.exec(line)?.[1])
        .filter(Boolean)
        .map(Number),
    );
    const usage = values.length > 0 ? Math.max(...values) : null;
    if (usage !== null && usage >= 90 && !paused) {
      paused = true;
      console.log(`[ALERT] USAGE 5h ${usage}% (>= 90): pause launches and merges`);
    }
    // 司令塔の画面が読めないときは、表示が消えたのか読めないだけなのか分からないので判定しない。
    const readable = tail(cwd, coordinatorTerminal, true).some((line) => line.trim());
    if (paused && readable && (usage === null || usage < 50)) {
      paused = false;
      console.log(`[ALERT] USAGE reset (${usage ?? '<50'}%): resume launches and merges`);
    }
    await sleep(INTERVAL_MS);
  }
}

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'spec-file': { type: 'string' },
    slug: { type: 'string' },
    base: { type: 'string' },
    model: { type: 'string' },
    effort: { type: 'string' },
    deps: { type: 'string' },
    text: { type: 'string' },
    file: { type: 'string' },
    'no-mail': { type: 'boolean' },
  },
});
const [command, state, target] = positionals;
if (!command || !state || (command !== 'monitor' && !target)) {
  fail('usage: node orch.mjs task|start|send <state-dir> <key|slug> [options] | monitor <state-dir>');
}
if (command === 'task') createTask(state, target, options);
else if (command === 'start') await startWorker(state, target);
else if (command === 'send') await sendTo(state, target, options);
else if (command === 'monitor') await monitor(state);
else fail(`unknown command: ${command}`);
