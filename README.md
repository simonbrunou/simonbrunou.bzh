# simonbrunou.bzh

Personal portfolio for Simon Brunou. Self-hosted on Coolify; a single Node/Hono
service serves the static site. The FR CV ships as a pre-built PDF
(`/simon-brunou-cv.pdf`), generated ahead of time from a shared data file.

## Stack

- **Static**: `index.html` (EN/FR, bilingual, rendered by `app.js`),
  `404.html`, `styles.css`, `photo.png`, project screenshots in `images/`,
  self-hosted fonts in `fonts/` (Big Shoulders Display and Besley, SIL OFL)
- **Data**: `data.js` is the single source of truth for the site and the PDF
- **Rules**: `profile.js` builds the Profile from `data.js`, checks its shape,
  and owns every derived rule (Featured projects, the Main job, periods, the
  Person JSON-LD). The browser and Node load it as an ES module; `npm test`
  checks it.
- **Design**: Bands, see `docs/adr/0001-replace-iris.md` and `DESIGN.md`
- **PDF template** (build-time only, not served): `pdf-template/index.html` +
  `pdf-template/styles.css` + `pdf-template/app.js`. Rendered to
  `simon-brunou-cv.pdf` by `scripts/build-pdf.js` (Puppeteer + headless Chrome).
- **Server** (`server.js` loads the files and listens; `site.js` is the app):
  - Hono on Node 24 (`@hono/node-server`)
  - Per-request CSP nonce: `script-src` allows only that nonce, and the
    server stitches it onto every `<script>` tag. The JSON-LD block that
    `app.js` injects needs none: it is a data block the browser never
    executes. HTML responses are forced to `Cache-Control: private,
    no-store` so a shared cache can't replay a nonce to multiple users.
  - Serves `simon-brunou-cv.pdf` as a normal static asset.
  - `GET /healthz` for the container healthcheck.

## Local development

Requires Node 24. Rebuilding the PDF additionally requires a Chromium
binary; the build script auto-detects `google-chrome-stable`, `chromium`, or
`chromium-browser`, or honors `$CHROMIUM_PATH`.

```sh
npm install
npm run dev                # node --watch server.js
npm test                   # in-process tests of the site app, its CSP and the Profile
npm run build:pdf          # rebuild simon-brunou-cv.pdf from pdf-template/
```

Browse [http://localhost:3000](http://localhost:3000).

The PDF is committed to the repo so production deploys don't need a browser.
Run `npm run build:pdf` after editing `data.js`, `profile.js` or
`pdf-template/`, then
commit the regenerated file.

### Docker

```sh
docker build -t simonbrunou-bzh .
docker run --rm --cap-drop=ALL --init -p 3000:3000 simonbrunou-bzh
```

`--cap-drop=ALL --init` matches how production runs the container.

The runtime image is browser-free — Puppeteer is a devDependency and the PDF
is baked into the image as a static asset. The Dockerfile copies only the
server and the files it serves, so a new page or root file needs a `COPY`
line there as well as its `HTML_PAGES` or `ROOT_FILES` entry in `site.js`.
Screenshots and fonts are
copied by extension (`images/*.webp`, `fonts/*.woff2`), as the server serves
them.

## Coolify deployment

1. **Create an app** with the *Dockerfile* build pack pointing at this Git repo.
2. **Port**: `3000`.
3. **Environment variables**: `PORT` and `HOST` keep defaults unless you're
   customising — no secrets required.
4. **Healthcheck**: Coolify runs its own check instead of the Dockerfile
   `HEALTHCHECK`. Path `/healthz`, port `3000`, host `127.0.0.1`. Not
   `localhost`: Alpine resolves it to `::1` and the server listens on IPv4.
5. **Custom Docker options**: `--cap-drop=ALL --init`. The image has no
   init of its own.
6. **Domain**: set in Coolify; Traefik handles TLS via Let's Encrypt.

Pushing to `main` (with a Coolify Git webhook configured) triggers a rebuild.

## Security headers

Baseline headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP, CORP,
…) are set in `site.js`. CSP `script-src` is rewritten per-response to inject
the nonce. If Traefik / Coolify also adds headers, deduplicate them — double
`Strict-Transport-Security` is harmless but double CSP is not.
