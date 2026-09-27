#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$project_root"

bash tooling/with-node.sh pnpm install --frozen-lockfile
bash tooling/with-node.sh pnpm exec lefthook install
bash tooling/with-node.sh pnpm agent:setup
# The browser is shared across checkouts through a per-user cache, so
# this is quick once any worktree has downloaded it. Only UI verification needs
# it, so a failure (for example, offline) warns instead of failing setup.
if ! bash tooling/with-node.sh pnpm agent:browser:install; then
  echo 'Warning: could not install the Agent browser. Retry with: pnpm agent:browser:install' >&2
fi

cat <<'MESSAGE'
Setup complete.
Run commands with this worktree's direnv environment and selected runtime:
  direnv exec . bash tooling/with-node.sh pnpm check
  direnv exec . bash tooling/with-node.sh pnpm agent:doctor
MESSAGE
