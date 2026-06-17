#!/usr/bin/env bash
# PostToolUse(Edit|Write): when server.js's CSP-nonce machinery is edited, surface the
# invariants — there is no test suite to catch a silent break of the security spine.
input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$path" in
  */server.js|server.js)
    jq -n '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:"⚠ server.js CSP-nonce spine edited (no test suite guards it). Re-verify: (1) cspWithNonce() injects BOTH the per-request nonce AND strict-dynamic into script-src; (2) injectNonce()/SCRIPT_RE adds nonce=\"<n>\" to EVERY served <script>, matching the CSP header nonce per request; (3) HTML responses stay Cache-Control: private, no-store (a shared cache replaying one nonce breaks CSP); (4) Cloudflare Rocket Loader / Auto Minify stay OFF. Load / and confirm scripts run with no CSP console errors before shipping."}}'
    ;;
esac
exit 0
