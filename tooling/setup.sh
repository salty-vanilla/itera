#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$project_root"

bash tooling/with-node.sh pnpm agent:setup

cat <<'MESSAGE'
Setup complete.
Run commands with this worktree's direnv environment and selected runtime:
  direnv exec . bash tooling/with-node.sh pnpm agent:doctor
Browser for UI verification (when needed):
  direnv exec . bash tooling/with-node.sh pnpm agent:browser:install
MESSAGE
