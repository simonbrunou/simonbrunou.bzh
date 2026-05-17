# simonbrunou.bzh

Personal portfolio for Simon Brunou. Self-hosted on Coolify; a single Node/Hono
service serves the static site. The FR CV ships as a pre-built PDF
(`/simon-brunou-cv.pdf`), generated ahead of time from a shared data file.

## Stack

- **Static**: `index.html` (EN/FR, bilingual), `404.html`, `photo.png`
- **Data**: `data.js` is the single source of truth for the site and the PDF
- **Shared rendering**: `render.js` exposes helpers (`pickLang`, `splitPeriod`,
  `injectJsonLd`)
- **PDF template** (build-time only, not served): `pdf-template/index.html` +
  `pdf-template/styles.css` + `pdf-template/app.js`. Rendered to
  `simon-brunou-cv.pdf` by `scripts/build-pdf.js` (Puppeteer + headless Chrome).
- **Server** (`server.js`):
  - Hono on Node 22 (`@hono/node-server`)
  - Per-request CSP nonce stitched into `script-src` and onto every inline
    `<script>` tag, with `'strict-dynamic'` so `render.js` can inject the
    JSON-LD block. HTML responses are forced to `Cache-Control: private,
    no-store` so a shared cache can't replay a nonce to multiple users.
  - Serves `simon-brunou-cv.pdf` as a normal static asset.
  - `GET /healthz` for the container healthcheck.

## Local development

Requires Node ≥ 22. Rebuilding the PDF additionally requires a Chromium
binary; the build script auto-detects `google-chrome-stable`, `chromium`, or
`chromium-browser`, or honors `$CHROMIUM_PATH`.

```sh
npm install
npm run dev                # node --watch server.js
npm run build:pdf          # rebuild simon-brunou-cv.pdf from pdf-template/
```

Browse [http://localhost:3000](http://localhost:3000).

The PDF is committed to the repo so production deploys don't need a browser.
Run `npm run build:pdf` after editing `data.js` or `pdf-template/`, then
commit the regenerated file.

### Docker

```sh
docker build -t simonbrunou-bzh .
docker run --rm -p 3000:3000 simonbrunou-bzh
```

The runtime image is browser-free — Puppeteer is a devDependency and the PDF
is baked into the image as a static asset.

## Coolify deployment

1. **Create an app** of type *Dockerfile* pointing at this Git repo.
2. **Port**: `3000`.
3. **Environment variables**: `PORT` and `HOST` keep defaults unless you're
   customising — no secrets required.
4. **Healthcheck**: Coolify picks up the Dockerfile `HEALTHCHECK` automatically.
   Path `/healthz`, port `3000`.
5. **Domain**: set in Coolify; Traefik handles TLS via Let's Encrypt.

Pushing to `main` (with a Coolify Git webhook configured) triggers a rebuild.

## Security headers

Baseline headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP, CORP,
…) are set in `server.js`. CSP `script-src` is rewritten per-response to inject
the nonce. If Traefik / Coolify also adds headers, deduplicate them — double
`Strict-Transport-Security` is harmless but double CSP is not.
