#!/usr/bin/env bash
# SessionStart hook: give Claude Code's Bash commands this checkout's direnv
# environment (.envrc selects the pinned Node from Devbox and this checkout's
# pnpm). direnv's shell hook only runs at an interactive prompt, so without this
# the Agent's non-interactive Bash would use the host Node.
#
# Claude Code runs the export statements appended to CLAUDE_ENV_FILE before each
# Bash command. Problems never block the session: the hook reports them to the
# user (systemMessage) and to the model (additionalContext) and exits 0.
set -uo pipefail

report() {
  # Messages are fixed strings without quotes or backslashes, so no JSON escaping.
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$1" "$1"
  exit 0
}

[[ -n "${CLAUDE_ENV_FILE:-}" ]] || exit 0
cd -- "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
[[ -f .envrc ]] || exit 0

command -v direnv >/dev/null 2>&1 ||
  report 'direnv was not found, so Bash uses the host Node. Install direnv, run direnv allow ., and restart the session.'

# A blocked .envrc makes direnv exit non-zero while still printing statements
# that unload the environment, so nothing is appended unless it succeeds.
if ! exports="$(direnv export bash 2>/dev/null)"; then
  report 'direnv could not load .envrc (not allowed yet, or it failed). Run direnv allow . in this checkout and restart the session.'
fi
printf '%s\n' "$exports" >>"$CLAUDE_ENV_FILE"

expected="$(tr -d '\r\n' <.node-version 2>/dev/null)"
actual="$(eval "$exports" && node --version 2>/dev/null)"
case "$actual" in
  "v$expected" | "v$expected".*) ;;
  *) report "Bash uses Node ${actual:-none}, but this repository needs Node $expected. Check Devbox and .envrc, then restart the session." ;;
esac
