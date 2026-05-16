#!/usr/bin/env bash
# Claude Code PostToolUse hook for Bash. Detects locally-created
# commits on PR branches and asks Claude to run /code-review before
# pushing — even when the commit landed on a branch we switched TO,
# or on a branch we switched AWAY from. Distinguishes locally-created
# commits from pull/fetch-imported commits, and chained-push from a
# normal pull-and-push.

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0

# Defensive: bail if the runtime ever reports tool_response.success === false
printf '%s' "$input" | jq -e '.tool_response.success == false' >/dev/null 2>&1 && exit 0

command -v git >/dev/null 2>&1 || exit 0
command -v gh  >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$input" | jq -r '.session_id // "default"' 2>/dev/null)
prefile_branch="/tmp/claude-bash-prebranch-${session}.txt"
prefile_branches="/tmp/claude-bash-prebranches-${session}.txt"
prefile_remote_shas="/tmp/claude-bash-preremoteshas-${session}.txt"

cleanup() {
  rm -f "$prefile_branch" "$prefile_branches" "$prefile_remote_shas"
}

post_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || { cleanup; exit 0; }
pre_branch=$(cat "$prefile_branch" 2>/dev/null)

# Decide which branch the commit (if any) landed on.
#   - If the *current* branch's tip moved since pre-snapshot, that's
#     where the commit went (covers both same-branch and switched-TO
#     cases like `git switch feature && git commit`).
#   - Else if a *previous* branch's tip moved (we switched away after
#     committing), fire the reminder against that one.
target_branch=""
target_sha=""

post_branch_now=$(git rev-parse HEAD 2>/dev/null)
post_branch_pre=$(grep "^${post_branch} " "$prefile_branches" 2>/dev/null | awk '{print $2}')
if [ -n "$post_branch_pre" ] && [ -n "$post_branch_now" ] && [ "$post_branch_pre" != "$post_branch_now" ]; then
  target_branch="$post_branch"
  target_sha="$post_branch_now"
elif [ -n "$pre_branch" ] && [ "$pre_branch" != "$post_branch" ]; then
  pre_branch_pre=$(grep "^${pre_branch} " "$prefile_branches" 2>/dev/null | awk '{print $2}')
  pre_branch_now=$(git rev-parse "refs/heads/${pre_branch}" 2>/dev/null)
  if [ -n "$pre_branch_pre" ] && [ -n "$pre_branch_now" ] && [ "$pre_branch_pre" != "$pre_branch_now" ]; then
    target_branch="$pre_branch"
    target_sha="$pre_branch_now"
  fi
fi

if [ -z "$target_branch" ]; then
  cleanup; exit 0
fi

case "$target_branch" in ""|main|master|HEAD) cleanup; exit 0 ;; esac

# Was target_sha already reachable via a remote ref BEFORE this Bash
# call? If so, the "advance" came from `git pull`/`fetch`, not a local
# commit. Skip silently.
if [ -f "$prefile_remote_shas" ] && grep -qx "$target_sha" "$prefile_remote_shas"; then
  cleanup; exit 0
fi

cleanup

# Resolve PR for target_branch. Use gh's default (no-arg) resolver
# when target_branch IS the current branch — it reads tracking metadata
# and handles `gh pr checkout 123 --branch <local>` correctly. For the
# switched-away case, fall back to the configured upstream's branch
# name if available, then to the local branch name.
pr_number=""
if [ "$target_branch" = "$post_branch" ]; then
  pr_number=$(gh pr view --json number --jq '.number' 2>/dev/null)
else
  upstream=$(git config --get "branch.${target_branch}.merge" 2>/dev/null | sed 's|^refs/heads/||')
  if [ -n "$upstream" ]; then
    pr_number=$(gh pr view "$upstream" --json number --jq '.number' 2>/dev/null)
  fi
  if [ -z "$pr_number" ]; then
    pr_number=$(gh pr view "$target_branch" --json number --jq '.number' 2>/dev/null)
  fi
fi
[ -z "$pr_number" ] && exit 0

target_sha_short=$(git rev-parse --short "$target_sha" 2>/dev/null) || exit 0

# Tripwire — fire only if BOTH (a) the command actually mentions
# `git push` (after stripping message values, so commit messages can't
# false-trip) AND (b) some remote ref now points at target_sha. Without
# (a), `git pull --ff-only && git push` would alarm even though the
# user pushed nothing new.
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
