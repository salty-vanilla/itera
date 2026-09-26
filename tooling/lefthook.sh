#!/usr/bin/env bash
# Runs this checkout's lefthook with the pinned Node and pnpm. Git hooks may be
# started by a GUI without the shell environment, so load direnv when it is
# installed; otherwise rely on ITERA_NODE_BIN or PATH (checked by with-node.sh).
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if command -v direnv >/dev/null 2>&1; then
  exec direnv exec . bash tooling/with-node.sh pnpm exec lefthook "$@"
fi
exec bash tooling/with-node.sh pnpm exec lefthook "$@"
