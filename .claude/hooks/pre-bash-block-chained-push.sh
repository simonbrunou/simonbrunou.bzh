#!/usr/bin/env bash
# Claude Code PreToolUse hook for Bash.
# Blocks Bash commands that chain `git commit` with `git push` in a
# single tool call, so the PostToolUse code-review reminder isn't
# bypassed. Forces splitting commit and push into separate Bash calls.

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
[ -z "$cmd" ] && exit 0

# Strip quoted strings first so a literal "git push" inside a commit
# message can't trip the detector. Naive but good enough for shell that
# Claude actually writes.
stripped=$(printf '%s' "$cmd" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")

commit_re='\bgit([[:space:]]+-c[[:space:]]+[^[:space:]]+)*[[:space:]]+commit\b'
push_re='\bgit([[:space:]]+-c[[:space:]]+[^[:space:]]+)*[[:space:]]+push\b'

if printf '%s' "$stripped" | grep -qE "$commit_re" \
   && printf '%s' "$stripped" | grep -qE "$push_re"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Do not chain `git commit` and `git push` in a single Bash call. Run them as separate Bash invocations so the post-commit hook can ask you to run /code-review between commit and push. Split this command and try again."
    }
  }'
  exit 0
fi

exit 0
