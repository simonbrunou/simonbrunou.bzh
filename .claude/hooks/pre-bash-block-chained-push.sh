#!/usr/bin/env bash
# Claude Code PreToolUse hook for Bash. Two jobs:
#   1) Snapshot HEAD AND the current branch name into per-session temp
#      files so PostToolUse can detect commits that advance the same
#      branch's tip (vs. branch switches, which also change HEAD), and
#      handle commits that landed on a now-switched-away branch.
#   2) Deny chaining a HEAD-advancing git operation with `git push` in
#      a single Bash call on a PR branch — so the post-commit hook can
#      ask Claude to run /code-review BETWEEN the commit-creating
#      operation and the push. Recognised operations: commit, revert,
#      cherry-pick, merge, rebase, am.

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# (1) Snapshot HEAD + branch. Per-session keyed; overwritten every Bash call.
session=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
prefile_head="/tmp/claude-bash-prehead-${session}.txt"
prefile_branch="/tmp/claude-bash-prebranch-${session}.txt"
git rev-parse HEAD 2>/dev/null > "$prefile_head" || rm -f "$prefile_head"
git rev-parse --abbrev-ref HEAD 2>/dev/null > "$prefile_branch" || rm -f "$prefile_branch"

[ -z "$cmd" ] && exit 0

# (2) Deny chained HEAD-advance + push — only on PR branches.
command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in ""|main|master|HEAD) exit 0 ;; esac
# Use gh pr view's default resolution (current branch) — handles
# `gh pr checkout 123 --branch review-123` correctly because gh reads
# the branch's tracking metadata, not just the local name.
gh pr view --json number >/dev/null 2>&1 || exit 0

# Strip ONLY message-/file-flag values so a literal "git push" inside a
# commit message doesn't trip the detector. Both `=`-form and
# space-separated `-m`/`--message`/`-F`/`--file` are handled.
stripped=$(printf '%s' "$cmd" | sed -E "
  s/-m[[:space:]]+'[^']*'//g
  s/-m[[:space:]]+\"[^\"]*\"//g
  s/--message[[:space:]]*=[[:space:]]*'[^']*'//g
  s/--message[[:space:]]*=[[:space:]]*\"[^\"]*\"//g
  s/--message[[:space:]]+'[^']*'//g
  s/--message[[:space:]]+\"[^\"]*\"//g
  s/-F[[:space:]]+[^[:space:]]+//g
  s/--file[[:space:]]*=[[:space:]]*[^[:space:]]+//g
  s/--file[[:space:]]+[^[:space:]]+//g
")

# HEAD-advancing operations chained with push. Limited to a single
# chain-segment via the [^|;&] character class. Tolerates global
# options like `git -c k=v ...` and `git -C path ...` between git and
# the subcommand.
head_adv_re='\bgit\b[^|;&]*\b(commit|revert|cherry-pick|merge|rebase|am)\b'
push_re='\bgit\b[^|;&]*\bpush\b'

if printf '%s' "$stripped" | grep -qE "$head_adv_re" \
   && printf '%s' "$stripped" | grep -qE "$push_re"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Do not chain a HEAD-advancing git operation (commit, revert, cherry-pick, merge, rebase, am) with `git push` in a single Bash call on a PR branch. Run them as separate Bash invocations so the post-commit hook can ask you to run /code-review between the change and the push. Split this command and try again."
    }
  }'
  exit 0
fi
exit 0
