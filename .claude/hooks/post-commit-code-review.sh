#!/usr/bin/env bash
# Claude Code PostToolUse hook for Bash. Two responsibilities:
#   1) After a `git commit` that ACTUALLY advanced HEAD on a PR branch,
#      ask Claude to run /code-review before pushing.
#   2) Tripwire — if origin/<branch> already equals HEAD, a `git push`
#      was chained into the same Bash call and the review-before-push
#      policy was bypassed. Emit a loud `decision: block` alert with a
#      top-level `reason` so the feedback surfaces in the tool result.
#
# Dry-run guard: the PreToolUse companion (pre-bash-block-chained-push.sh)
# snapshots HEAD before every Bash call. We compare the snapshot to
# post-command HEAD — only emit when HEAD actually moved.

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

# Confirm HEAD actually advanced. Distinguishes a real commit from
# `git commit --dry-run`, no-op `--allow-empty --no-edit`, etc.
session=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
prefile="/tmp/claude-bash-prehead-${session}.txt"
pre_head=$(cat "$prefile" 2>/dev/null)
rm -f "$prefile"
post_head=$(git rev-parse HEAD 2>/dev/null)
if [ -z "$pre_head" ] || [ "$pre_head" = "$post_head" ]; then
  exit 0
fi

sha=$(git rev-parse --short HEAD 2>/dev/null) || exit 0

# Tripwire — `git push` updates the local tracking ref as a side effect.
remote_sha=$(git rev-parse "refs/remotes/origin/$branch" 2>/dev/null) || remote_sha=""
bypassed=0
if [ -n "$remote_sha" ] && [ "$remote_sha" = "$post_head" ]; then
  bypassed=1
fi

if [ "$bypassed" = "1" ]; then
  # Top-level `reason` surfaces in tool-result feedback; `additionalContext`
  # carries the full instructions Claude needs to act on.
  jq -n --arg branch "$branch" --arg pr "$pr_number" --arg sha "$sha" '
  {
    decision: "block",
    reason: "REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on PR-branch \"\($branch)\" (PR #\($pr)) was already pushed in the same Bash call. Run /code-review NOW on the pushed commit. From now on, run `git commit` and `git push` as SEPARATE Bash invocations.",
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
