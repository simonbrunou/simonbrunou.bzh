#!/usr/bin/env bash
# Claude Code PostToolUse hook for Bash. Two responsibilities:
#   1) After ANY operation that advanced the CURRENT BRANCH's tip on a
#      PR branch, ask Claude to run /code-review before pushing. Pure
#      state-based: PreToolUse snapshots both the branch NAME and HEAD;
#      we exit if the branch changed (branch switch, not a commit) or
#      its tip didn't move (no-op / dry-run).
#   2) Tripwire — if the new HEAD is now reachable via ANY remote
#      tracking ref, a `git push` was chained into the same Bash call.
#      Uses `git for-each-ref --points-at HEAD refs/remotes/` so any
#      ref shape (`origin/<branch>`, `fork/<branch>`, differently-named
#      upstream like `origin/feature` from local `review/25`) is caught.

input=$(cat 2>/dev/null) || exit 0

# Defensive: bail if the runtime ever reports tool_response.success === false
printf '%s' "$input" | jq -e '.tool_response.success == false' >/dev/null 2>&1 && exit 0

command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0

post_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$post_branch" in ""|main|master|HEAD) exit 0 ;; esac

pr_number=$(gh pr view "$post_branch" --json number --jq '.number' 2>/dev/null) || exit 0
[ -z "$pr_number" ] && exit 0

# Read the pre-command snapshot. We need BOTH branch name and HEAD —
# branch name to distinguish a commit from a branch switch, HEAD to
# distinguish a commit from a no-op.
session=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
prefile_head="/tmp/claude-bash-prehead-${session}.txt"
prefile_branch="/tmp/claude-bash-prebranch-${session}.txt"
pre_head=$(cat "$prefile_head" 2>/dev/null)
pre_branch=$(cat "$prefile_branch" 2>/dev/null)
rm -f "$prefile_head" "$prefile_branch"
post_head=$(git rev-parse HEAD 2>/dev/null)

# Branch switch: HEAD differs because we're on a different branch, not
# because we made a commit. Exit silently.
if [ -n "$pre_branch" ] && [ "$pre_branch" != "$post_branch" ]; then
  exit 0
fi

# No HEAD movement: covers --dry-run, --no-edit no-op, status, fetch, etc.
if [ -z "$pre_head" ] || [ "$pre_head" = "$post_head" ]; then
  exit 0
fi

sha=$(git rev-parse --short HEAD 2>/dev/null) || exit 0

# Tripwire — does ANY remote tracking ref now point at the new HEAD?
# A new commit's SHA can only be reachable via a remote ref if `git push`
# just put it there. Catches non-`origin` remotes AND differently-named
# upstreams in one query.
bypassed_ref=$(git for-each-ref --points-at HEAD refs/remotes/ --format='%(refname:short)' 2>/dev/null | head -n 1)

if [ -n "$bypassed_ref" ]; then
  jq -n --arg branch "$post_branch" --arg pr "$pr_number" --arg sha "$sha" --arg ref "$bypassed_ref" '
  {
    decision: "block",
    reason: "REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on PR-branch \"\($branch)\" (PR #\($pr)) was already pushed to \($ref) in the same Bash call. Run /code-review NOW on the pushed commit. From now on, run any HEAD-advancing git operation and `git push` as SEPARATE Bash invocations.",
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "⚠️  REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on branch \"\($branch)\" (PR #\($pr)) has already been pushed — remote ref `\($ref)` points at the new HEAD. The /code-review reminder was supposed to fire BETWEEN commit-creation and push but the push happened in the same Bash call. ACTION REQUIRED: run the /code-review skill now on the pushed commit. If the review finds issues, address them in a follow-up commit (do not amend or force-push). For all future HEAD-advancing operations on a PR branch (commit, revert, cherry-pick, merge, rebase, am), run them and `git push` as SEPARATE Bash calls — never chain them with `&&`, `;`, subshells, or `$(...)`."
    }
  }'
else
  jq -n --arg branch "$post_branch" --arg pr "$pr_number" --arg sha "$sha" '
  {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "A new commit (\($sha)) was just created on branch \"\($branch)\", which has open PR #\($pr). Before pushing or continuing, invoke the /code-review skill to review the change. Address any findings with a follow-up commit; only push once the review is clean."
    }
  }'
fi
