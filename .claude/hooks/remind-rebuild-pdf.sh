#!/usr/bin/env bash
# PostToolUse(Edit|Write): data.js and pdf-template/ feed the committed, served CV PDF,
# which only rebuilds via `npm run build:pdf`. Warn so the PDF doesn't silently desync.
input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$path" in
  */data.js|data.js|*/pdf-template/*)
    jq -n '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:"📄 data.js or pdf-template/* edited — these feed the committed CV PDF served by the site. Run `npm run build:pdf` (node scripts/build-pdf.js; needs Chromium / CHROMIUM_PATH) and commit the regenerated PDF, or it desyncs from the live site."}}'
    ;;
esac
exit 0
