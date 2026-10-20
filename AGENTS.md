# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, OpenCode, Copilot, Pi, omp) when working with code in this repository. It is the single source of truth: `CLAUDE.md` only imports it, so edit this file.

## Commands

- `npm run dev` — start the server in watch mode (Hono on `:3000`)
- `npm start` — production start (no watch)
- `npm test` — run `test/*.test.js` with `node --test`. The site app tests
  send requests in-process and the Profile tests import `profile.js`, so
  they need no port or browser.
- `npm run build:pdf` — re-render `simon-brunou-cv.pdf` from `pdf-template/`
  using Puppeteer. Requires a local Chromium (`google-chrome-stable`,
  `chromium`, or `chromium-browser` on PATH, or set `CHROMIUM_PATH`).
  The PDF is committed to the repo; rerun and commit after editing `data.js`,
  `profile.js` or anything under `pdf-template/`.

There is no linter and no bundler. Vanilla HTML/CSS/JS served by a tiny Node
server.

## Architecture

**Single source of truth — `data.js`.** An ES module whose default export is
the content: personal info, about paragraphs, projects with their
screenshots, experience grouped by employer with positions oldest first,
skills, education, languages, interests, UI strings. Most content changes
start here. Only `profile.js` imports it.

**Rules — `profile.js`.** Builds the Profile (GLOSSARY.md) from `data.js` and
owns every rule derived from it: which projects are Featured projects
(non-empty `shots`), the Main job, employer years, position periods (derived
from `startDate`/`endDate`; `data.js` holds no period text), the location,
skill groups, `pick` for the language, `visitorLang` and the Person JSON-LD.
Both renderers ask it, so a new rule goes here, not in a renderer. Building
the Profile checks the shape of `data.js` and throws with the field and its
owner (`data.js: projects[cinder].stack is missing`), so a broken edit fails
`npm test` in CI before it blanks the homepage. The module must not touch
`window` or `document` when imported.

**Node loads the data with `import`.** `import profile from "./profile.js"`
gives the Profile of `data.js`, with the raw content on `profile.data`.
`createProfile(data)` builds one from any object; tests use it on edited
copies (`test/profile.test.js`). No `vm` or adapter is involved.

**Design — Bands** (`docs/adr/0001-replace-iris.md`, `DESIGN.md`). Each
project with `shots` in `data.js` gets a full-width band in its own app's
colours; projects without shots get one line under the bands. Those colours
are the project's `palette` in `data.js`, which the band and its CV strip
share, so a new banded project needs no CSS. Bands alternate sides by
position (`isMirrored` in `profile.js`). The Main job gets the slate band.
Fonts (Big Shoulders Display, Besley) are self-hosted under
`fonts/`; screenshots live in `images/` as WebP.

**Two rendering targets, one Profile.**

1. `index.html` + `app.js` + `styles.css` — the live site at `/`. `app.js`
   builds the whole page from the Profile into `#page`. Bilingual (EN/FR),
   client-side language toggle that also rewrites `?lang=`. `app.js` keeps
   one JSON-LD `Person` block in `<head>` and rewrites it on a language
   switch. `404.html` reuses `styles.css`.
2. `pdf-template/{index.html,app.js,render-outcome.js,styles.css}` —
   build-time template rendered once to `simon-brunou-cv.pdf`. **Not served in
   production** (the Dockerfile does not copy it). French-only,
   print-styled, no JSON-LD.

Both pages load `data.js`, `profile.js` and their `app.js` as
`<script type="module">`. Listing all three lets the browser fetch them in
parallel instead of following the imports one round trip at a time. List a
new module the same way: a `<link rel="modulepreload">` would need a nonce
the server does not add. The CV lists `pdf-template/render-outcome.js`
before the others (see "The CV render outcome" below). `404.html` keeps its
inline language check, a twin of `visitorLang`: as a module it would wait for
a fetch, and a French Visitor would see the English page first.

**PDF generation flow** (`scripts/build-pdf.js`): spins up a tiny static HTTP
server on a random localhost port that exposes `pdf-template/` and the repo
root, drives headless Chrome at `/pdf-template/`, waits for the render
outcome that `pdf-template/render-outcome.js` writes on `<html>`, then
snapshots to A4 PDF with `printBackground: true`. On a failed render it logs
the reason and exits 1 (see "The CV render outcome" below).

**Server — `server.js` + `site.js` (Hono on Node 24).** `site.js` is the site
app: it holds the routes, headers and CSP machinery. It exports
`createSiteApp(files)` and `loadSiteFiles(root)`, plus `ROOT_FILES`,
`staticAssets`, `HTML_PAGES`, `NOT_FOUND_HTML` and `injectNonce` for the
tests and `scripts/check-image.js`. Importing it reads no file and opens no
port. It imports `profile.js` for the boot check below, so a broken
`data.js` also fails the import.
`server.js` is the entry point (`npm start`, Docker `CMD`,
the CI probe): it loads every served file into memory once, builds the app
from them, listens, and handles signals. `test/site.test.js` drives the app
in-process with `app.request(...)` and holds the CSP nonce rules below as
assertions, so run `npm test` after touching `site.js`. Key concerns:

- **Per-request CSP nonce.** On each HTML response `script-src` is
  `'nonce-<random>'` alone, with no `'self'` and no `'strict-dynamic'`
  (`docs/adr/0002-scripts-run-by-nonce-only.md`). Every `<script` tag in the
  served HTML is decorated with the matching `nonce=…` attribute. HTML
  responses are forced to `Cache-Control: private, no-store` so a shared
  cache can't replay a nonce to multiple visitors. Modules that a nonced
  `<script type="module">` imports inherit its nonce, so `import` works
  under this policy. The JSON-LD block that `app.js` injects needs no nonce:
  a `type="application/ld+json"` script is a data block the browser never
  executes, so `script-src` does not apply to it. A `<script>` element that
  page JS creates runs only if the code sets its `nonce`. Cloudflare writes
  the Web Analytics beacon tag with the nonce, and its JS Detections loader
  sets it on the scripts it creates; check the browser console after
  turning on any other Cloudflare feature that adds scripts.
- **Static asset map.** `site.js` builds the allowlist of non-HTML routes
  once at boot: every `images/*.webp`, every `fonts/*.woff2`, and the root
  files named in `ROOT_FILES`. `FILE_TYPES` sets `Content-Type` and
  `Cache-Control` per file extension. A new screenshot or font needs no edit
  to `site.js`, only a line in `STATIC_HEADERS` in `test/site.test.js`,
  which lists every route the site serves. A new root file needs a
  `ROOT_FILES` entry and a `COPY` line in the `Dockerfile`, a new extension
  a `FILE_TYPES` entry, a new asset directory or a changed extension for
  one an `ASSET_DIRS` entry and a matching `COPY` glob. The `*.webp.json`
  provenance sidecars and
  `OFL-*.txt` licences next to the assets are not served. No request reaches
  the filesystem, so there is no directory traversal. Boot fails, naming the
  file, when a `shots[].src` in `data.js`, the homepage photo, `/styles.css`
  or a font in its `@font-face` rules has no route. The CSP allows only
  `'self'` for styles and fonts, so no third-party font CDN and no inline
  styles.
- **`HTML_PAGES`** in `site.js` maps each page route to its HTML file; every
  entry becomes a route with the nonce treatment, and its file needs a
  `COPY` line in the `Dockerfile`. `404.html` is served via
  `app.notFound(...)` with the same machinery.

**Deployment — Coolify + Docker.** Coolify (application 4) builds the
`Dockerfile` with its Dockerfile build pack on every push to `main`, and
Traefik fronts the container. The image is Alpine with Node 24 and no
browser: `puppeteer-core` is a devDependency only. Dependencies install with
`npm ci --omit=dev` from the lockfile. The `COPY` lines are the allowlist of
what ships: `server.js`, `site.js`, `package.json`, production
`node_modules`, and every file `site.js` serves (`profile.js` and `data.js`
are also imports of `site.js`). The files belong to root and
the server runs as `node`, so it cannot change them. Coolify runs the
container with `--cap-drop=ALL --init`, set in application 4's custom
Docker options (outside the repo, #123). `--cap-drop=ALL` empties the
capability bounding set, so no process in the container can gain a
capability, even through `docker exec -u root`. With `--init`, Docker's
init is PID 1: it forwards signals to node and reaps orphans. That is why
the image has no dumb-init. Coolify replaces
the Dockerfile `HEALTHCHECK` with its own check of
`http://127.0.0.1:3000/healthz` (`curl`, falling back to the image's busybox
`wget`). Its health check host must stay `127.0.0.1`: in Alpine `localhost`
resolves to `::1` first and the server listens on IPv4 only.

CI runs `npm test`, boots `node server.js` and probes `/healthz`. It then
builds the image, runs it with the same `--cap-drop=ALL --init`, waits for
Docker to report it healthy, and runs
`scripts/check-image.js` inside it against the files the checkout's
`site.js` serves: each of their routes answers, `/app` outside
`node_modules` holds exactly those files plus `server.js`, `site.js` and
`package.json`, and nothing under `/app` is writable. Last, it runs
`docker stop` and expects exit code 0, as when Coolify replaces the
container on a deploy.

**Operating production.** Coolify (`coolify` and its Postgres `coolify-db`)
runs in CT 104 and the site container in CT 105; reach both through
`pct exec` from the Proxmox host.

- **Latest deploys**, in CT 104:

  ```sh
  echo "select id,status,left(commit,8),created_at from application_deployment_queues where application_id='4' order by id desc limit 3;" |
    docker exec -i coolify-db psql -U coolify -d coolify -At -F "|"
  ```

  A deploy's build log is its row's `logs` column, a JSON array of entries
  whose `output` holds each line.
- **Running container**, in CT 105:
  `docker ps --format "{{.Names}}|{{.Image}}|{{.Status}}"`. The site's
  container is the one whose image tag is the full SHA of the deployed commit.
- **Queue a deploy** the way the UI does. Change application 4 through
  Coolify's PHP (its model and helpers), not with SQL. Save this as
  `deploy.php`:

  ```php
  $app = App\Models\Application::find(4);
  queue_application_deployment(application: $app, deployment_uuid: new_public_id(), force_rebuild: false);
  ```

  and pipe it into tinker in CT 104 (a file spares quoting `$` through ssh,
  `pct` and `sh`):

  ```sh
  docker exec -i coolify sh -c 'cat > /tmp/x.php && php artisan tinker --execute="$(cat /tmp/x.php)"' < deploy.php
  ```

  The new row then shows in the latest deploys.
- **Browser checks against production** from the home LAN log one console
  error: its Pi-hole resolves `static.cloudflareinsights.com` (the Web
  Analytics beacon) to `0.0.0.0`, so the beacon fails with
  `ERR_CONNECTION_REFUSED`, not a CSP violation. For a clean console, start
  Chrome with `--host-resolver-rules="MAP static.cloudflareinsights.com <ip>"`,
  taking `<ip>` from `dig +short @1.1.1.1 static.cloudflareinsights.com`.

## Things that have bitten us

- **Cloudflare proxy options break CSP.** Rocket Loader and Auto Minify
  inject/rewrite scripts in a way that defeats the nonce policy — they must
  stay **off** in the Cloudflare dashboard for this site.
- **Cloudflare Browser Cache TTL must stay on "Respect Existing Headers".**
  Any other value overrides the server's `max-age=0, must-revalidate` on
  `data.js`, `profile.js`, `app.js` and `styles.css`. `index.html` stays
  `no-store`, so a returning Visitor would run the new page with old copies
  of those files. With a 4-hour TTL (`max-age=14400`), the move to ES modules
  (#104) meant a browser still holding the old `data.js` or `app.js` showed
  a blank homepage, as reproduced against production (#118). Reverting does
  not fix that: it moves the breakage to whoever loaded the new files.
  Check that `curl -sI https://simonbrunou.bzh/app.js` shows
  `max-age=0, must-revalidate`.
- **Cloudflare Email Obfuscation is on.** It rewrites any email address in
  static HTML into `[email protected]` plus a decoder script, and the CSP
  blocks that script, so the visitor sees `[email protected]`. Wrap every
  static address in `<!--email_off-->…<!--/email_off-->` (see `404.html`).
  Addresses that `app.js` writes at runtime are not affected.
- **The CV render outcome.** `pdf-template/render-outcome.js` sets
  `data-render-complete` on `<html>` once every image has decoded and every
  web font has loaded, and `scripts/build-pdf.js` writes the PDF right after.
  Keep both gates: without the image gate the PDF sometimes ships without the
  photo, without the font gate it ships with system fallback glyphs instead
  of Big Shoulders Display and Besley (the woff2 files load lazily, so
  DOMContentLoaded is not enough). The CV is two fixed A4 pages: each `.page`
  has a set height with overflow hidden, and page 1 ends after the first
  employer. A page that overflows, an uncaught exception, or an image or font
  that fails to load sets `data-render-error` with the reason instead, and
  `npm run build:pdf` logs the reason and exits 1. Move content between pages
  rather than shrinking type. `render-outcome.js` stays the first module in
  `pdf-template/index.html`: `profile.js` throws its shape-check error while
  it is imported, and a listener added later would miss it.
- **Homepage pixel diffs need the same image and font gates.** Two full-page
  Puppeteer captures of the same code at 390x844 differed by 30k to 100k
  pixels (found during #104): `renderShot` in `app.js` gives every Band
  screenshot `decoding="async"` and all but the first band's first one
  `loading="lazy"`, so a shot can be loaded but not yet painted when the
  capture runs. Before `page.screenshot({ fullPage: true })`, set lazy images
  to eager, wait for `document.fonts.ready` and every `img.complete`, then
  `await Promise.all([...document.images].map((i) => i.decode().catch(() => {})))`
  and two `requestAnimationFrame`s. Capture with `deviceScaleFactor: 1` and
  `prefers-reduced-motion: reduce` emulated, which stops the Band shots'
  scroll-driven animation (above 900px) and every transition. Capture the
  base and the change twice each, and trust a non-zero diff only when both
  runs of each match.
- **The dev server caches every file at boot.** Restart `npm run dev` after
  editing HTML, CSS, JS or assets. Screenshots in `images/` are served with a
  one-day `max-age`, so a browser keeps showing the old image after a swap;
  disable the cache when checking one.
- **Coolify ignored the Dockerfile until 2026-10-19.** Its railpack build
  pack built the image without it, so production ran as root with every repo
  file inside. Application 4 now uses the Dockerfile build pack; keep it, or
  Dockerfile changes stop reaching production.
- **Coolify's health check host must be `127.0.0.1`.** Coolify runs its own
  `curl … || wget …` check inside the container instead of the Dockerfile
  `HEALTHCHECK`. In Alpine `localhost` resolves to `::1` first and the server
  listens on IPv4 `0.0.0.0` only, so a `localhost` check is refused and
  Coolify rolls the deploy back (deploy 2481). The image must also keep
  `curl` or `wget`; busybox `wget` is the one it has.
- **Coolify drops or mangles some custom Docker options.** Coolify 4.4.6
  turns the run options into compose keys and keeps only the flags it maps
  (`--cap-add`, `--cap-drop`, `--security-opt`, `--init`, `--ulimit` and a
  few more), without a warning. It also cuts most values at their first
  hyphen. So `--read-only` is dropped, and
  `--security-opt=no-new-privileges` becomes `security_opt: ["no"]`, an
  invalid value (#123). Before adding an option to application 4, check
  what Coolify makes of it in CT 104: `docker exec coolify php artisan
  tinker --execute="echo json_encode(convertDockerRunToCompose('<options>'));"`.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Merge authority

Agents may merge their own PR without asking once all three hold: a code review ran on the diff (the `code-review` skill or the `pr-review-toolkit:code-reviewer` agent) and its real findings are fixed; CI is green on the pushed SHA; the branch is up to date with `origin/main`. The production deploy that the merge triggers is accepted. Ask first only when the PR drops or rewrites stored data (a destructive migration, a backfill that overwrites rows).

## Agent skills

### Issue tracker

Forgejo issues on `git.sbrn.eu` via the `fj` CLI, with the REST API for JSON reads and blocking links. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
