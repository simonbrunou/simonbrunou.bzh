#!/usr/bin/env bash
# Claude Code PostToolUse hook for Bash.
#
# Two responsibilities:
#   1) After a `git commit` on a PR branch, ask Claude to run /code-review
#      before pushing (normal flow).
#   2) Tripwire — if the local HEAD already matches origin/<branch>, a
#      `git push` was chained into the same Bash call and the
#      review-before-push policy was bypassed. State-based check, so it
#      catches subshells, heredocs, $(...), and anything else a pure
#      text-matching detector would miss.

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# Only act on git-commit invocations (tolerates `git -c key=val commit ...`)
printf '%s' "$cmd" | grep -qE '\bgit\b.*\bcommit\b' || exit 0

# Defensive: bail if the runtime ever reports tool_response.success === false
printf '%s' "$input" | jq -e '.tool_response.success == false' >/dev/null 2>&1 && exit 0

command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in ""|main|master|HEAD) exit 0 ;; esac

pr_number=$(gh pr view "$branch" --json number --jq '.number' 2>/dev/null) || exit 0
[ -z "$pr_number" ] && exit 0

sha=$(git rev-parse --short HEAD 2>/dev/null) || exit 0

# Tripwire — `git push` updates the local tracking ref as a side effect
# of a successful push. If origin/<branch> already equals the new HEAD,
# the push happened in the same Bash call.
remote_sha=$(git rev-parse "refs/remotes/origin/$branch" 2>/dev/null) || remote_sha=""
local_sha=$(git rev-parse HEAD 2>/dev/null)
bypassed=0
if [ -n "$remote_sha" ] && [ "$remote_sha" = "$local_sha" ]; then
  bypassed=1
fi

if [ "$bypassed" = "1" ]; then
  jq -n --arg branch "$branch" --arg pr "$pr_number" --arg sha "$sha" '
  {
    decision: "block",
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "⚠️  REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on branch \"\($branch)\" (PR #\($pr)) has already been pushed — origin/\($branch) matches HEAD. The /code-review reminder was supposed to fire BETWEEN commit and push but the push happened in the same Bash call. ACTION REQUIRED: run the /code-review skill now on the pushed commit. If the review finds issues, address them in a follow-up commit (do not amend or force-push). For all future commits on a PR branch, run `git commit` and `git push` as SEPARATE Bash calls — never chain them with `&&`, `;`, subshells, or `$(...)`."
    }
  }'
else
  jq -n --arg branch "$branch" --arg pr "$pr_number" --arg sha "$sha" '
  {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "A new commit (\($sha)) was just created on branch \"\($branch)\", which has open PR #\($pr). Before pushing or continuing, invoke the /code-review skill to review the change. Address any findings with a follow-up commit; only push once the review is clean."
    }
  }'
fi
