#!/usr/bin/env bash
# Claude Code PostToolUse hook for Bash. Three responsibilities:
#   1) After ANY operation that advanced the PR-branch's tip (whether
#      that branch is still checked out or we've since switched away),
#      ask Claude to run /code-review before pushing. Pure state-based
#      via the PreToolUse snapshot of HEAD + branch name.
#   2) Tripwire — if the new commit is now reachable via ANY remote
#      tracking ref AND the command contained `git push`, a push was
#      chained into the same Bash call.
#   3) Don't false-fire on `git pull --ff-only` (which also leaves a
#      remote ref pointing at HEAD without the user pushing) — we
#      require the command text to include `git push`.

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# Defensive: bail if the runtime ever reports tool_response.success === false
printf '%s' "$input" | jq -e '.tool_response.success == false' >/dev/null 2>&1 && exit 0

command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0

# Read the pre-command snapshot.
session=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
prefile_head="/tmp/claude-bash-prehead-${session}.txt"
prefile_branch="/tmp/claude-bash-prebranch-${session}.txt"
pre_head=$(cat "$prefile_head" 2>/dev/null)
pre_branch=$(cat "$prefile_branch" 2>/dev/null)
rm -f "$prefile_head" "$prefile_branch"
post_head=$(git rev-parse HEAD 2>/dev/null) || exit 0
post_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0

# Determine which branch the commit landed on (could be the current
# branch, OR pre_branch if the same Bash call did `git commit && git
# switch other`).
if [ -n "$pre_branch" ] && [ "$pre_branch" != "$post_branch" ]; then
  # Branch changed during the call. Did the original PR branch's tip advance?
  target_tip=$(git rev-parse "refs/heads/$pre_branch" 2>/dev/null) || exit 0
  if [ -z "$pre_head" ] || [ "$target_tip" = "$pre_head" ]; then
    exit 0  # original branch didn't advance, just a switch
  fi
  target_branch="$pre_branch"
  target_sha="$target_tip"
else
  # Same branch — standard case
  if [ -z "$pre_head" ] || [ "$pre_head" = "$post_head" ]; then
    exit 0  # no HEAD movement (covers --dry-run, --no-edit, status, fetch, etc.)
  fi
  target_branch="$post_branch"
  target_sha="$post_head"
fi

case "$target_branch" in ""|main|master|HEAD) exit 0 ;; esac

# Resolve PR for the target branch. For the same-branch case use the
# default (no-arg) resolver so `gh pr checkout --branch <local>` setups
# work; for the cross-branch case pass the branch name explicitly.
if [ "$target_branch" = "$post_branch" ]; then
  pr_number=$(gh pr view --json number --jq '.number' 2>/dev/null) || exit 0
else
  pr_number=$(gh pr view "$target_branch" --json number --jq '.number' 2>/dev/null) || exit 0
fi
[ -z "$pr_number" ] && exit 0

target_sha_short=$(git rev-parse --short "$target_sha" 2>/dev/null) || exit 0

# Tripwire — require BOTH (a) a remote tracking ref pointing at the new
# commit AND (b) `git push` actually appearing in the command. Without
# (b), `git pull --ff-only` would falsely fire (it advances HEAD AND
# updates the remote ref at the same time). Quoted message values are
# stripped first so `commit -m "fix git push race"` doesn't false-trip.
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
push_in_cmd=0
printf '%s' "$stripped" | grep -qE '\bgit\b[^|;&]*\bpush\b' && push_in_cmd=1

bypassed_ref=""
if [ "$push_in_cmd" = "1" ]; then
  bypassed_ref=$(git for-each-ref --points-at "$target_sha" refs/remotes/ --format='%(refname:short)' 2>/dev/null | head -n 1)
fi

if [ -n "$bypassed_ref" ]; then
  jq -n --arg branch "$target_branch" --arg pr "$pr_number" --arg sha "$target_sha_short" --arg ref "$bypassed_ref" '
  {
    decision: "block",
    reason: "REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on PR-branch \"\($branch)\" (PR #\($pr)) was already pushed to \($ref) in the same Bash call. Run /code-review NOW on the pushed commit. From now on, run any HEAD-advancing git operation and `git push` as SEPARATE Bash invocations.",
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "⚠️  REVIEW-BEFORE-PUSH BYPASSED: commit \($sha) on branch \"\($branch)\" (PR #\($pr)) has already been pushed — remote ref `\($ref)` points at the new commit. The /code-review reminder was supposed to fire BETWEEN commit-creation and push but the push happened in the same Bash call. ACTION REQUIRED: run the /code-review skill now on the pushed commit. If the review finds issues, address them in a follow-up commit (do not amend or force-push). For all future HEAD-advancing operations on a PR branch (commit, revert, cherry-pick, merge, rebase, am), run them and `git push` as SEPARATE Bash calls — never chain them with `&&`, `;`, subshells, or `$(...)`."
    }
  }'
else
  jq -n --arg branch "$target_branch" --arg pr "$pr_number" --arg sha "$target_sha_short" '
  {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "A new commit (\($sha)) was just created on branch \"\($branch)\", which has open PR #\($pr). Before pushing or continuing, invoke the /code-review skill to review the change. Address any findings with a follow-up commit; only push once the review is clean."
    }
  }'
fi
