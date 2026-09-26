#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Runtime error: %s\n' "$*" >&2
  exit 1
}

if [[ $# -eq 0 ]]; then
  fail 'Usage: bash tooling/with-node.sh <command> [args...]'
fi

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

# A directory, rather than NODE_PATH (Node's module lookup setting), selects
# the runtime for pnpm and every child process that resolves node via PATH.
if [[ -n "${ITERA_NODE_BIN:-}" ]]; then
  [[ "$ITERA_NODE_BIN" = /* ]] || fail 'ITERA_NODE_BIN must be an absolute directory containing node.'
  [[ "$ITERA_NODE_BIN" != *:* ]] || fail 'ITERA_NODE_BIN cannot contain a colon (PATH separator).'
  [[ -f "$ITERA_NODE_BIN/node" && -x "$ITERA_NODE_BIN/node" ]] || fail 'ITERA_NODE_BIN must contain an executable node file.'
  export PATH="$ITERA_NODE_BIN:$PATH"
fi

command -v node >/dev/null 2>&1 || fail 'Node is missing. Set ITERA_NODE_BIN to the required Node bin directory.'
# .node-version names a release series. Any patch inside it is accepted: the
# lockfile fixes dependency resolution, so patch differences do not change it.
# This is the check that matters, because PATH's Node runs the builds and tests.
expected_node="$(tr -d '\r\n' < "$project_root/.node-version")"
actual_node="$(node --version)"
case "$actual_node" in
  "v$expected_node" | "v$expected_node".*) ;;
  *) fail "Expected Node $expected_node series, found $actual_node. Set ITERA_NODE_BIN to the required Node bin directory." ;;
esac

expected_pnpm="$(node --input-type=module - "$project_root/package.json" <<'NODE'
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const pnpm = pkg.packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/)?.[1];
if (!pnpm || pkg.engines?.pnpm !== pnpm) {
  console.error('Runtime error: packageManager and engines.pnpm must specify the same exact pnpm version.');
  process.exit(1);
}
console.log(pnpm);
NODE
)"

command -v pnpm >/dev/null 2>&1 || fail "pnpm is missing. Install pnpm $expected_pnpm using the selected Node."
actual_pnpm="$(pnpm --version)"
[[ "$actual_pnpm" = "$expected_pnpm" ]] || fail "Expected pnpm $expected_pnpm, found $actual_pnpm. Install the required version using the selected Node."

exec "$@"
