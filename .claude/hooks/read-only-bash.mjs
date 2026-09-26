// PreToolUse hook for the read-only subagents (harness-reviewer, harness-planner).
// Fail closed: the command is tokenized with a deliberately small subset of
// shell syntax, and runs only when every command in it is on the read-only
// allowlist below. Anything else exits 2, which blocks the call and returns the
// message to the subagent. This is best-effort, not a security boundary.
import { readFileSync } from 'node:fs';

const block = (reason) => {
  process.stderr.write(
    `Read-only agent: ${reason}. Ask the caller to run it instead.\n`,
  );
  process.exit(2);
};

process.on('uncaughtException', (error) => block(`hook error: ${error.message}`));

let command;
try {
  command = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command;
} catch {
  block('could not parse the hook input');
}
if (typeof command !== 'string') process.exit(0);

// Tokenize into commands (arrays of words). Supported: plain words, '...' and
// "..." (without $ or backticks), backslash escapes, the separators ; & && ||
// | and newline, input redirection from a file, and redirections that only
// discard or merge output. Everything else (substitution, variables, comments,
// subshells, glob qualifiers, other redirections) is refused.
const DISCARD = /^(\d*>>?\/dev\/null|&>\/dev\/null|\d*>&\d+)$/;
const commands = [];
let words = [];
let word = null;
let pendingInput = false;
let pendingRedirect = null;
const endWord = () => {
  if (word === null) return;
  if (pendingRedirect !== null) {
    // `> /dev/null`: the operator and its target were separate words.
    const raw = pendingRedirect + word.raw;
    pendingRedirect = null;
    if (!DISCARD.test(raw)) block(`\`${raw}\`: redirecting output to a file is not allowed`);
    word = null;
    return;
  }
  if (/^(\d*>>?|&>|\d*>&)$/.test(word.raw)) {
    pendingRedirect = word.raw;
    word = null;
    return;
  }
  if (word.glob && /(^|\/)\./.test(word.text)) {
    block(`\`${word.raw}\`: glob patterns on dotfiles are not allowed`);
  }
  if (pendingInput) {
    pendingInput = false; // input file: read-only, but still checked below
    words.push(word.text);
  } else if (!DISCARD.test(word.raw)) {
    if (word.redirect) block(`\`${word.raw}\`: redirecting output to a file is not allowed`);
    words.push(word.text);
  }
  word = null;
};
const endCommand = () => {
  endWord();
  if (pendingInput || pendingRedirect !== null) block('redirection without a target');
  if (words.length > 0) commands.push(words);
  words = [];
};
const append = (text, raw = text) => {
  word ??= { text: '', raw: '' };
  word.text += text;
  word.raw += raw;
};

for (let i = 0; i < command.length; i += 1) {
  const char = command[i];
  if (char === "'") {
    const end = command.indexOf("'", i + 1);
    if (end === -1) block('unterminated quote');
    append(command.slice(i + 1, end), 'Q');
    i = end;
  } else if (char === '"') {
    let text = '';
    let j = i + 1;
    for (; j < command.length && command[j] !== '"'; j += 1) {
      if (command[j] === '$' && command[j + 1] === '?') {
        text += '$?';
        j += 1;
        continue;
      }
      if (command[j] === '$' || command[j] === '`') {
        block('substitution inside double quotes is not allowed');
      }
      if (command[j] === '\\' && j + 1 < command.length) j += 1;
      text += command[j];
    }
    if (j >= command.length) block('unterminated quote');
    append(text, 'Q');
    i = j;
  } else if (char === '\\') {
    if (i + 1 >= command.length || command[i + 1] === '\n') {
      block('line continuation is not allowed');
    }
    append(command[i + 1], 'E');
    i += 1;
  } else if (char === ' ' || char === '\t') {
    endWord();
  } else if (char === '\n' || char === ';') {
    endCommand();
  } else if (char === '&' && (command[i + 1] === '>' || word?.raw.endsWith('>'))) {
    append(char); // part of &>/dev/null or N>&M
  } else if (char === '|' || char === '&') {
    endCommand();
    if (command[i + 1] === char) i += 1;
  } else if (char === '>') {
    append(char);
    word.redirect = true;
  } else if (char === '<') {
    if (word !== null || pendingInput || '<('.includes(command[i + 1])) {
      block('only plain input redirection from a file is allowed');
    }
    pendingInput = true;
  } else if (char === '$') {
    if (command[i + 1] !== '?') block('variables and substitution are not allowed');
    append('$?');
    i += 1;
  } else if ('`()#!'.includes(char) || (char === '~' && word === null)) {
    block(`\`${char}\` is not allowed here`);
  } else if (char === '{' || char === '}') {
    // Literal braces (HEAD@{0}, {owner}) are fine; brace expansion and groups are not.
    const close = command.indexOf('}', i);
    const body = char === '{' && close !== -1 ? command.slice(i + 1, close) : '';
    if (word === null && (command[i + 1] === ' ' || command[i + 1] === undefined)) {
      block('command groups are not allowed');
    }
    if (/,|\.\./.test(body)) block('brace expansion is not allowed');
    append(char);
  } else if (char === '=' && word === null) {
    block('`=` at the start of a word is not allowed');
  } else {
    append(char);
    if ('*?['.includes(char)) word.glob = true;
  }
}
endCommand();

const flat = commands.flat();
for (const arg of flat) {
  if (/^\/dev\//.test(arg) && arg !== '/dev/null') block(`\`${arg}\`: device paths are not allowed`);
  if (/(^|\/)\.env(\.(?!example$)[^/]*)?$/.test(arg)) {
    block(`\`${arg}\`: reading .env files is not allowed`);
  }
}

const hasArg = (args, pattern) => args.some((arg) => pattern.test(arg));
const noWeb = (args) => !hasArg(args, /^(--web|-w)$/);

const gitReadOnly = new Set([
  'diff', 'log', 'show', 'status', 'blame', 'ls-files', 'ls-tree', 'rev-parse',
  'rev-list', 'merge-base', 'cat-file', 'describe', 'shortlog', 'grep',
  'show-ref', 'for-each-ref',
]);
const git = (args) => {
  // `-C` only into this project (another directory could be a crafted repo
  // whose config runs programs); `--no-pager` is harmless; -c and others are not.
  const project = (process.env.CLAUDE_PROJECT_DIR ?? '').replace(/\/+$/, '');
  for (;;) {
    if (args[0] === '-C' && ['.', project, `${project}/`].includes(args[1]) && args[1]) args = args.slice(2);
    else if (args[0] === '--no-pager') args = args.slice(1);
    else break;
  }
  const [sub, ...rest] = args;
  if (sub === '--version') return rest.length === 0;
  // git accepts unique prefixes of long options, so match prefixes too.
  if (hasArg(rest, /^--(ou|op|ext|tex|exe)/)) return false;
  if (sub === 'grep' && hasArg(rest, /^-[^-]*O/)) return false;
  if (gitReadOnly.has(sub)) return true;
  if (sub === 'stash') return ['list', 'show'].includes(rest[0]);
  if (sub === 'reflog') return rest.length === 0 || rest[0] === 'show';
  if (sub === 'worktree') return rest[0] === 'list';
  if (sub === 'remote') return rest.every((arg) => arg === '-v');
  if (sub === 'config') return ['--get', '--get-regexp', '--list'].includes(rest[0]);
  if (sub === 'tag') return ['-l', '--list'].includes(rest[0]);
  if (sub === 'branch') {
    return rest.every(
      (arg, index) =>
        /^(-a|-r|-v|-vv|--list|--show-current|--contains|--merged|--no-merged)$/.test(arg) ||
        /^--(contains|merged|no-merged|list)$/.test(rest[index - 1] ?? ''),
    );
  }
  return false;
};

const gh = (args) => {
  if (args[0] === '-R' || args[0] === '--repo') args = args.slice(2);
  else if (args[0]?.startsWith('--repo=')) args = args.slice(1);
  if (args[0] === '--version') return args.length === 1;
  const [group, action, ...rest] = args;
  if (['issue', 'pr'].includes(group)) {
    return ['view', 'list', 'diff', 'checks', 'status'].includes(action) && noWeb(rest);
  }
  if (['repo', 'release', 'run', 'label'].includes(group)) {
    return ['view', 'list'].includes(action) && noWeb(rest);
  }
  if (group === 'search') return noWeb(args);
  if (group === 'api') {
    // Allowlist the flags: anything else (-X, -f, -F, --input, -H, --hostname)
    // can turn the call into a write or send it elsewhere.
    const apiArgs = args.slice(1);
    const positionals = [];
    for (let i = 0; i < apiArgs.length; i += 1) {
      const arg = apiArgs[i];
      if (!arg.startsWith('-')) {
        positionals.push(arg);
        continue;
      }
      if (['--paginate', '--slurp'].includes(arg)) continue;
      if (['-X', '--method'].includes(arg) && apiArgs[i + 1] === 'GET') {
        i += 1;
        continue;
      }
      if (['--jq', '-q', '--template', '-t'].includes(arg)) {
        i += 1;
        continue;
      }
      return false;
    }
    // One endpoint path on github.com; absolute URLs would reach other hosts.
    return positionals.length === 1 && positionals[0] !== 'graphql' && !positionals[0].includes('://');
  }
  return false;
};

const tools = new Set([
  'cat', 'head', 'tail', 'grep', 'ls', 'wc', 'cut', 'diff', 'stat', 'echo',
  'printf', 'test', 'pwd', 'tr', 'nl', 'column', 'basename', 'dirname',
  'realpath', 'true', 'shasum', 'sha256sum', 'date', 'which', 'tree',
]);

const allowed = ([name, ...args]) => {
  if (name === 'git') return git(args);
  if (name === 'gh') return gh(args);
  if (name === 'find') return !hasArg(args, /^-(exec|execdir|delete|ok|okdir|fprint|fls)/);
  // GNU-style tools accept unique prefixes of long options, so match prefixes.
  if (name === 'sort') return !hasArg(args, /^(-[^-]*o|--o|--c)/);
  if (name === 'rg') return !hasArg(args, /^(-[^-]*z|--(pre|search-zip))/);
  if (name === 'tree') return !hasArg(args, /^(-[^-]*o|--o)/);
  if (name === 'uniq') return args.filter((arg) => !arg.startsWith('-')).length <= 1;
  if (name === 'jq') return !hasArg(args, /env|input_filename|\$__loc__/i);
  if (name === 'file') return !hasArg(args, /^(-[^-]*C|--c)/);
  if (name === 'sed') {
    return (
      args.length === 3 &&
      args[0] === '-n' &&
      /^\d+(,(\d+|\$))?p$/.test(args[1]) &&
      !args[2].startsWith('-')
    );
  }
  if (name === 'node') {
    return args[0] === '--version' ? args.length === 1 : args[0] === '.agents/skills/design-references/scripts/hig.mjs';
  }
  if (name === 'pnpm') {
    const script = args.join(' ');
    return (
      /^(-s )?(agent:check|agent:doctor)$/.test(script) ||
      /^(-s )?agent:shadcn (info|search|docs|view)( [\w@./-]+)*$/.test(script) ||
      /^(-s )?agent:impeccable context( [\w@./-]+)*$/.test(script)
    );
  }
  return tools.has(name);
};

for (const argv of commands) {
  if (!allowed(argv)) block(`\`${argv.join(' ')}\` is not on the read-only allowlist`);
}
process.exit(0);
