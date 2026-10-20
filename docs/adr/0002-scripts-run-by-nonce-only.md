# Scripts run by nonce only

The HTML responses send `script-src 'nonce-<random>'`, with no `'self'` and no `'strict-dynamic'` (#103). Until October 2026 the policy was `script-src 'self' 'nonce-<random>' 'strict-dynamic'`. Its only documented reason, injecting the JSON-LD block, was wrong (#102): a `type="application/ld+json"` script is a data block, and `script-src` does not apply to it.

In a CSP3 browser that policy already ignored `'self'`, so only the nonced tags ran. What `'strict-dynamic'` added was trust passed on to any `<script>` element that running JS creates, nonce or not. No site script creates one. Every script the site loads is a tag in the served HTML, and the server gives each one the nonce.

Cloudflare adds scripts to every page at the edge: the JS Detections loader, which builds an iframe and loads `/cdn-cgi/challenge-platform/scripts/jsd/main.js` from it, and the Web Analytics beacon from `static.cloudflareinsights.com`. Both carry the page's nonce: Cloudflare writes it on the tags it adds, and the JS Detections loader sets it on the script elements it creates. They need neither `'self'` nor `'strict-dynamic'`.

## Evidence

On 2026-10-20 headless Chrome loaded `/`, `/?lang=fr` and `/nope` from the public site twice under each of three policies. A CDP response rewrite swapped only the `script-src` value and kept the nonce Cloudflare had served:

| `script-src` | Loads | Enforced CSP violations | JS Detections POST | Beacon `/cdn-cgi/rum` POST |
|---|---|---|---|---|
| `'self' 'nonce-…' 'strict-dynamic'` | 6 | 0 | 6 | 6 |
| `'self' 'nonce-…'` | 6 | 0 | 6 | 5 |
| `'nonce-…'` | 6 | 0 | 6 | 5 |

On `/` and `/?lang=fr`, `app.js` built the page in the requested language in every load. Each missing beacon POST came with `ERR_CONNECTION_REFUSED` on `static.cloudflareinsights.com` and no CSP violation. The same failure hit the old policy in an earlier run.

## Considered options

- **Keep `'strict-dynamic'`.** Rejected: it trusts any script that running JS creates, and nothing on the site needs that.
- **`'self' 'nonce-…'`.** Rejected: `'self'` allows every same-origin script, including Cloudflare's `/cdn-cgi/` paths, without a nonce. Nothing needs it.
- **`'nonce-…'` only.** Chosen. In a CSP3 browser it allows a subset of what the old policy allowed.

## Consequences

- A new Cloudflare feature that creates a script without setting its nonce is blocked. After turning one on, load the public site and check the console.
- A browser that predates CSP nonces (Safari 9 and older) runs no script, and the homepage stays empty. With the old policy it fell back to `'self'`.
- A new script on the site needs a `<script>` tag in the served HTML, which gets the nonce, or a module `import`, which inherits it.
