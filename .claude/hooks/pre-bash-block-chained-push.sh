#!/usr/bin/env bash
# Claude Code PreToolUse hook for Bash. Two jobs:
#   1) Capture HEAD into a per-session temp file so PostToolUse can
#      distinguish a real commit from `git commit --dry-run` / `--no-edit`
#      and similar no-ops.
#   2) Deny chained `git commit ... + git push ...` in a single Bash call
#      on a PR branch — so the post-commit hook can ask Claude to run
#      /code-review BETWEEN commit and push.

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# (1) Snapshot HEAD. Per-session keyed; overwritten on every Bash call.
# PostToolUse removes the file after reading.
session=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
prefile="/tmp/claude-bash-prehead-${session}.txt"
git rev-parse HEAD 2>/dev/null > "$prefile" || rm -f "$prefile"

[ -z "$cmd" ] && exit 0

# (2) Deny chained commit+push — only on PR branches (symmetric with PostToolUse).
command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in ""|main|master|HEAD) exit 0 ;; esac
gh pr view "$branch" --json number >/dev/null 2>&1 || exit 0

# Strip ONLY -m/-F (and long-form) message values so a literal "git push"
# inside a commit message doesn't trip the detector. `bash -c "..."`
# payloads stay intact and remain analysable.
stripped=$(printf '%s' "$cmd" | sed -E "
  s/-m[[:space:]]+'[^']*'//g
  s/-m[[:space:]]+\"[^\"]*\"//g
  s/--message[[:space:]]*=[[:space:]]*'[^']*'//g
  s/--message[[:space:]]*=[[:space:]]*\"[^\"]*\"//g
  s/-F[[:space:]]+[^[:space:]]+//g
  s/--file[[:space:]]*=[[:space:]]*[^[:space:]]+//g
")

# Looser regex — matches `git ... commit` / `git ... push` with any flag
# between (so `git -c k=v commit`, `git -C path commit`, etc. all match).
# Limited to a single chain-segment via the [^|;&] character class.
commit_re='\bgit\b[^|;&]*\bcommit\b'
push_re='\bgit\b[^|;&]*\bpush\b'

if printf '%s' "$stripped" | grep -qE "$commit_re" \
   && printf '%s' "$stripped" | grep -qE "$push_re"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Do not chain `git commit` and `git push` in a single Bash call on a PR branch. Run them as separate Bash invocations so the post-commit hook can ask you to run /code-review between commit and push. Split this command and try again."
    }
  }'
  exit 0
fi
exit 0
