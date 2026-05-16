#!/usr/bin/env bash
# Claude Code PostToolUse hook for Bash.
# When the command was a `git commit` AND the branch has an open PR,
# return additionalContext asking Claude to run /code-review.

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# Only act on git-commit invocations (tolerates `git -c key=val commit ...`)
printf '%s' "$cmd" | grep -qE '\bgit\b.*\bcommit\b' || exit 0

# Defensive: bail if the runtime ever reports tool_response.success === false here
printf '%s' "$input" | jq -e '.tool_response.success == false' >/dev/null 2>&1 && exit 0

command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in ""|main|master|HEAD) exit 0 ;; esac

pr_number=$(gh pr view "$branch" --json number --jq '.number' 2>/dev/null) || exit 0
[ -z "$pr_number" ] && exit 0

sha=$(git rev-parse --short HEAD 2>/dev/null) || exit 0

jq -n --arg branch "$branch" --arg pr "$pr_number" --arg sha "$sha" '
{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "A new commit (\($sha)) was just created on branch \"\($branch)\", which has open PR #\($pr). Before pushing or continuing, invoke the /code-review skill to review the change. Address any findings with a follow-up commit; only push once the review is clean."
  }
}'
