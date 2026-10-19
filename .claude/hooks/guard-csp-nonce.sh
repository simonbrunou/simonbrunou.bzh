#!/usr/bin/env bash
# PostToolUse(Edit|Write): when the server or the site app (CSP-nonce machinery) is edited,
# point at the tests that hold the nonce rules, plus the one rule they can't check.
input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$path" in
  */server.js|server.js|*/site.js|site.js)
    jq -n '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:"⚠ server.js / site.js edited (site.js holds the CSP-nonce machinery). Run `npm test`; test/site.test.js holds the nonce rules (CSP header, a nonce on every <script>, private no-store HTML, baseline headers, static headers, 404). Tests cannot check Cloudflare: Rocket Loader and Auto Minify must stay OFF in the dashboard."}}'
    ;;
esac
exit 0
