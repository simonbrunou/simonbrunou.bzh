# simonbrunou.bzh

Personal portfolio (`/`) and résumé (`/resume/`) for Simon Brunou. Deployed to
Cloudflare Workers with Static Assets.

## Stack

- **Static**: `index.html` (EN/FR, bilingual), `resume/index.html` (FR), `404.html`
- **Data**: `data.js` is the single source of truth for both pages
- **Shared rendering**: `render.js` exposes helpers (`splitPeriod`, `injectJsonLd`)
  used by both pages
- **Worker** (`worker.js`):
  - Serves static assets via `env.ASSETS.fetch`
  - Injects a per-response CSP nonce on inline `<script>` tags via
    `HTMLRewriter`, with `'strict-dynamic'` so render.js can dynamically inject
    the JSON-LD block. HTML responses are forced to `Cache-Control: private,
    no-store` so a shared cache doesn't replay one nonce to many users.
  - Hosts the `POST /resume/simon-brunou-cv.pdf` endpoint: validates Origin,
    rate-limits by IP, verifies a Turnstile token, and renders the FR CV with
    `@cloudflare/puppeteer` (Browser Rendering). Waits for an explicit
    `data-render-complete` sentinel on `<html>` before snapshotting.

## Local development

```sh
npm install
npm run dev   # → wrangler dev
```

## Deploy

```sh
npm run deploy   # → wrangler deploy
```

## Secrets

The PDF endpoint requires a Cloudflare Turnstile secret key. Provision once
per environment:

```sh
wrangler secret put TURNSTILE_SECRET_KEY
```

The matching public sitekey is hard-coded in `resume/index.html` (Turnstile
sitekeys are public). Update both if you rotate the keypair.

## Bindings

Configured in `wrangler.jsonc`:

- `ASSETS` — Static Assets binding for the repo root (see `.assetsignore`
  for files excluded from public serving)
- `BROWSER` — Browser Rendering binding for puppeteer
- `RATE_LIMITER` — 5 requests / 60s per IP, keyed on `CF-Connecting-IP`

## Security headers

Baseline headers in `_headers` (CSP, HSTS, X-Frame-Options, Permissions-Policy,
etc.). The Worker overrides `Cache-Control` and rewrites the CSP `script-src`
on HTML responses so the nonce is meaningful.
