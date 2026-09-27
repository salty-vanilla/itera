#!/usr/bin/env bash
# SessionStart hook: give Claude Code's Bash commands this checkout's direnv
# environment (.envrc selects the pinned Node from Devbox and this checkout's
# pnpm). direnv's shell hook only runs at an interactive prompt, so without this
# the Agent's non-interactive Bash would use the host Node.
#
# Claude Code runs the export statements appended to CLAUDE_ENV_FILE before each
# Bash command. The hook runs on every SessionStart source (startup, resume,
# clear, compact); appending the same exports again is harmless. Problems never
# block the session: the hook reports them to the user (systemMessage) and to the
# model (additionalContext) and exits 0.
set -uo pipefail

report() {
  # Callers pass no quotes or backslashes, so the message needs no JSON escaping.
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$1" "$1"
  exit 0
}

[[ -n "${CLAUDE_ENV_FILE:-}" ]] || exit 0
cd -- "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
[[ -f .envrc ]] || exit 0

command -v direnv >/dev/null 2>&1 ||
  report 'direnv was not found, so Bash uses the host Node. Install direnv, run direnv allow ., and restart the session.'

# Clearing direnv's state makes it print the full environment even when Claude
# Code was started from a shell that had already loaded this .envrc; otherwise it
# would print nothing, and Bash, which does not inherit that environment
# reliably, would fall back to the host Node.
# A blocked .envrc makes direnv exit non-zero while still printing statements
# that unload the environment, so nothing is appended unless it succeeds.
if ! exports="$(env -u DIRENV_DIR -u DIRENV_FILE -u DIRENV_DIFF -u DIRENV_WATCHES direnv export bash 2>/dev/null)"; then
  report 'direnv could not load .envrc (not allowed yet, or it failed). Run direnv allow . in this checkout and restart the session.'
fi
printf '%s\n' "$exports" >>"$CLAUDE_ENV_FILE"

# Same checks as tooling/with-node.sh, against the environment Bash will get.
# Only version-shaped values are echoed, which keeps the JSON in report() valid.
version() { tr -cd '0-9.v' | head -c 32; }
expected_node="$(version <.node-version 2>/dev/null)"
expected_pnpm="$(sed -n 's/.*"packageManager": *"pnpm@\([0-9.]*\)".*/\1/p' package.json 2>/dev/null | version)"
actual_node="$(eval "$exports" && node --version 2>/dev/null | version)"
actual_pnpm="$(eval "$exports" && pnpm --version 2>/dev/null | version)"
case "$actual_node" in
  "v$expected_node" | "v$expected_node".*) ;;
  *) report "Bash uses Node ${actual_node:-none}, but this repository needs Node $expected_node. Check Devbox and .envrc, then restart the session." ;;
esac
[[ -z "$expected_pnpm" || "$actual_pnpm" = "$expected_pnpm" ]] ||
  report "Bash uses pnpm ${actual_pnpm:-none}, but this repository needs pnpm $expected_pnpm. Check .envrc, then restart the session."
