#!/usr/bin/env bash
# Claude Code PostToolUse hook for Bash. Two responsibilities:
#   1) After ANY operation that advanced HEAD on a PR branch (commit,
#      revert, cherry-pick, merge, rebase, am — anything), ask Claude
#      to run /code-review before pushing. Detection is purely
#      state-based: PreToolUse snapshots HEAD into a per-session temp
#      file; we compare to post-command HEAD. If HEAD didn't move,
#      exit silently — no text guessing, no enumerating commands.
#   2) Tripwire — if HEAD already matches ANY remote tracking ref for
#      this branch, a `git push` was chained into the same Bash call.
#      Checks every configured remote, not just `origin`, so fork-based
#      workflows (`git push fork branch`) are caught.

input=$(cat 2>/dev/null) || exit 0

# Defensive: bail if the runtime ever reports tool_response.success === false
printf '%s' "$input" | jq -e '.tool_response.success == false' >/dev/null 2>&1 && exit 0

command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$branch" in ""|main|master|HEAD) exit 0 ;; esac

pr_number=$(gh pr view "$branch" --json number --jq '.number' 2>/dev/null) || exit 0
[ -z "$pr_number" ] && exit 0

# Did HEAD actually advance during this Bash call?
session=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
prefile="/tmp/claude-bash-prehead-${session}.txt"
pre_head=$(cat "$prefile" 2>/dev/null)
rm -f "$prefile"
post_head=$(git rev-parse HEAD 2>/dev/null)
if [ -z "$pre_head" ] || [ "$pre_head" = "$post_head" ]; then
  exit 0
fi

sha=$(git rev-parse --short HEAD 2>/dev/null) || exit 0

# Tripwire — did the new HEAD land on ANY remote? `git push` updates
# the local tracking ref as a side effect, regardless of which remote
# was the target. Walk every configured remote.
bypassed=0
bypassed_remote=""
while IFS= read -r remote; do
  [ -z "$remote" ] && continue
  remote_sha=$(git rev-parse "refs/remotes/$remote/$branch" 2>/dev/null) || continue
  if [ "$remote_sha" = "$post_head" ]; then
    bypassed=1
    bypassed_remote="$remote"
    break
  fi
done < <(git remote 2>/dev/null)

if [ "$bypassed" = "1" ]; then
  # Top-level `reason` surfaces in tool-result feedback; `additionalContext`
  # carries the full instructions Claude needs to act on.
  jq -n --arg branch "$branch" --arg pr "$pr_number" --arg sha "$sha" --arg rem "$bypassed_remote" '
  {
    decision: "block",
    reason: "REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on PR-branch \"\($branch)\" (PR #\($pr)) was already pushed to \($rem) in the same Bash call. Run /code-review NOW on the pushed commit. From now on, run any HEAD-advancing git operation and `git push` as SEPARATE Bash invocations.",
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "⚠️  REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on branch \"\($branch)\" (PR #\($pr)) has already been pushed to remote `\($rem)` — \($rem)/\($branch) matches HEAD. The /code-review reminder was supposed to fire BETWEEN commit-creation and push but the push happened in the same Bash call. ACTION REQUIRED: run the /code-review skill now on the pushed commit. If the review finds issues, address them in a follow-up commit (do not amend or force-push). For all future HEAD-advancing operations on a PR branch (commit, revert, cherry-pick, merge, rebase, am), run them and `git push` as SEPARATE Bash calls — never chain them with `&&`, `;`, subshells, or `$(...)`."
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
