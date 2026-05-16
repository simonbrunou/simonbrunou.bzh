# simonbrunou.bzh

Personal portfolio (`/`) and résumé (`/resume/`) for Simon Brunou. Self-hosted
on Coolify; a single Node/Hono service serves the static pages and renders the
FR CV to PDF via Puppeteer.

## Stack

- **Static**: `index.html` (EN/FR, bilingual), `resume/index.html` (FR),
  `404.html`
- **Data**: `data.js` is the single source of truth for both pages
- **Shared rendering**: `render.js` exposes helpers (`splitPeriod`,
  `injectJsonLd`) used by both pages
- **Server** (`server.js`):
  - Hono on Node 22 (`@hono/node-server`)
  - Per-request CSP nonce stitched into `script-src` and onto every inline
    `<script>` tag in the served HTML, with `'strict-dynamic'` so `render.js`
    can inject the JSON-LD block. HTML responses are forced to
    `Cache-Control: private, no-store` so a shared cache can't replay a nonce
    to multiple users.
  - Hosts the `POST /resume/simon-brunou-cv.pdf` endpoint: validates `Origin`,
    rate-limits in-memory (5 req / 60 s / IP), verifies a Turnstile token, and
    renders the FR CV with `puppeteer-core` against a local Chromium. Waits
    for an explicit `data-render-complete` sentinel on `<html>` before
    snapshotting.
  - `GET /healthz` for the container healthcheck.

## Local development

Requires Node ≥ 22 and a Chromium binary on `$CHROMIUM_PATH` if you want to
exercise the PDF endpoint.

```sh
cp .env.example .env       # then set TURNSTILE_SECRET_KEY for PDF tests
npm install
npm run dev                # node --watch server.js
```

Browse [http://localhost:3000](http://localhost:3000).

### Docker

```sh
docker build -t simonbrunou-bzh .
docker run --rm -p 3000:3000 \
  -e TURNSTILE_SECRET_KEY="$TURNSTILE_SECRET_KEY" \
  -e ALLOWED_ORIGIN="http://localhost:3000" \
  simonbrunou-bzh
```

The image bundles Chromium from Alpine. PDF generation drives the in-process
server (`http://127.0.0.1:${PORT}/resume/?pdf=1`), so no outbound network is
needed for the render itself — only for Turnstile siteverify.

## Coolify deployment

1. **Create an app** of type *Dockerfile* pointing at this Git repo.
2. **Port**: `3000`.
3. **Environment variables** — copy from `.env.example`:
   - `TURNSTILE_SECRET_KEY` — secret, never commit.
   - `ALLOWED_ORIGIN` — explicit override that always wins when set. Leave
     it unset on Coolify if you want PR preview deploys to auto-pick up
     their own hostname from `$COOLIFY_URL` (injected per deploy; the
     server rewrites `http://` → `https://`). Set it explicitly when you
     need to pin an origin regardless of what Coolify injects.
   - `PORT`, `HOST`, `CHROMIUM_PATH`, `TRUST_PROXY` keep defaults unless
     you're customising.
4. **Healthcheck**: Coolify picks up the Dockerfile `HEALTHCHECK` automatically.
   Path `/healthz`, port `3000`.
5. **Domain**: set in Coolify; Traefik handles TLS via Let's Encrypt.

Pushing to `main` (with a Coolify Git webhook configured) triggers a rebuild.

## Security headers

Baseline headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP, CORP,
…) are set in `server.js`. CSP `script-src` is rewritten per-response to inject
the nonce. If Traefik / Coolify also adds headers, deduplicate them — double
`Strict-Transport-Security` is harmless but double CSP is not.

## Turnstile

The PDF endpoint requires a Cloudflare Turnstile secret key. The matching site
key is public and lives in `resume/index.html`; update both if you rotate the
keypair.
