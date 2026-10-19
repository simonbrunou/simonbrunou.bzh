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
colours; projects without shots get one line under the bands. A new banded
project needs its own `.band-<id>` colours in `styles.css`. The Main job gets
the slate band. Fonts (Big Shoulders Display, Besley) are self-hosted under
`fonts/`; screenshots live in `images/` as WebP.

**Two rendering targets, one Profile.**

1. `index.html` + `app.js` + `styles.css` — the live site at `/`. `app.js`
   builds the whole page from the Profile into `#page`. Bilingual (EN/FR),
   client-side language toggle that also rewrites `?lang=`. `app.js` keeps
   one JSON-LD `Person` block in `<head>` and rewrites it on a language
   switch. `404.html` reuses `styles.css`.
2. `pdf-template/{index.html,app.js,styles.css}` — build-time template
   rendered once to `simon-brunou-cv.pdf`. **Not served in production** (the
   Dockerfile strips this directory). French-only, print-styled, no JSON-LD.

Both pages load `data.js`, `profile.js` and their `app.js` as
`<script type="module">`. Listing all three lets the browser fetch them in
parallel instead of following the imports one round trip at a time. List a
new module the same way: a `<link rel="modulepreload">` would need a nonce
the server does not add. `404.html` keeps its inline language check, a twin
of `visitorLang`: as a module it would wait for a fetch, and a French Visitor
would see the English page first.

**PDF generation flow** (`scripts/build-pdf.js`): spins up a tiny static HTTP
server on a random localhost port that exposes `pdf-template/` and the repo
root, drives headless Chrome at `/pdf-template/`, waits for the
`html[data-render-complete]` sentinel set by `pdf-template/app.js` once all
images **and** `document.fonts.ready` have resolved, then snapshots to A4
PDF with `printBackground: true`. The sentinel is load-bearing — don't drop
either gate or the PDF races (image gate → missing photo; font gate → system
fallback glyphs instead of Big Shoulders Display / Besley).

**Server — `server.js` + `site.js` (Hono on Node 22).** `site.js` is the site
app: it holds the routes, headers and CSP machinery. It exports
`createSiteApp(files)` and `loadSiteFiles(root)`, plus `ROOT_FILES`,
`staticAssets`, `HTML_PAGES`, `NOT_FOUND_HTML` and `injectNonce` for the
tests. Importing it reads no file and opens no port. It imports `profile.js`
for the boot check below, so a broken `data.js` also fails the import.
`server.js` is the entry point (`npm start`, Docker `CMD`,
the CI probe): it loads every served file into memory once, builds the app
from them, listens, and handles signals. `test/site.test.js` drives the app
in-process with `app.request(...)` and holds the CSP nonce rules below as
assertions, so run `npm test` after touching `site.js`. Key concerns:

- **Per-request CSP nonce.** `BASE_CSP` is rewritten on each HTML response to
  inject `'nonce-<random>' 'strict-dynamic'` into `script-src`. Every
  `<script` tag in the served HTML is decorated with the matching `nonce=…`
  attribute. HTML responses are forced to `Cache-Control: private, no-store`
  so a shared cache can't replay a nonce to multiple visitors. Modules that a
  nonced `<script type="module">` imports inherit its nonce, so `import`
  works under this policy. The JSON-LD block that `app.js` injects needs no
  nonce: a
  `type="application/ld+json"` script is a data block the browser never
  executes, so `script-src` does not apply to it. What `'strict-dynamic'`
  does here: CSP3 browsers ignore `'self'`, so only the nonced tags run, and
  any `<script>` element that running page JS creates and appends runs
  without a nonce.
- **Static asset map.** `site.js` builds the allowlist of non-HTML routes
  once at boot: every `images/*.webp`, every `fonts/*.woff2`, and the root
  files named in `ROOT_FILES`. `FILE_TYPES` sets `Content-Type` and
  `Cache-Control` per file extension. A new screenshot or font needs no edit
  to `site.js`, only a line in `STATIC_HEADERS` in `test/site.test.js`,
  which lists every route the site serves. A new root file needs a
  `ROOT_FILES` entry, a new extension a `FILE_TYPES` entry, a new asset
  directory an `ASSET_DIRS` entry. The `*.webp.json` provenance sidecars and
  `OFL-*.txt` licences next to the assets are not served. No request reaches
  the filesystem, so there is no directory traversal. Boot fails, naming the
  file, when a `shots[].src` in `data.js`, the homepage photo, `/styles.css`
  or a font in its `@font-face` rules has no route. The CSP allows only
  `'self'` for styles and fonts, so no third-party font CDN and no inline
  styles.
- **`HTML_PAGES`** in `site.js` maps each page route to its HTML file; every
  entry becomes a route with the nonce treatment. `404.html` is served via
  `app.notFound(...)` with the same machinery.

**Deployment — Coolify + Docker.** Build runs `npm install --omit=dev`, then
ships a browser-free Alpine image. `puppeteer-core` is a devDependency only
(no Chromium in production). Traefik fronts the container; `HEALTHCHECK` hits
`/healthz`. `pdf-template/`, `scripts/` and `test/` are removed from the
runtime image in the Dockerfile. CI runs `npm test`, then boots
`node server.js` and probes `/healthz`.

## Things that have bitten us

- **Cloudflare proxy options break CSP.** Rocket Loader and Auto Minify
  inject/rewrite scripts in a way that defeats the strict-dynamic nonce
  policy — they must stay **off** in the Cloudflare dashboard for this site.
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
- **The `data-render-complete` sentinel** is required by `scripts/build-pdf.js`
  to know when the page is fully painted. If you refactor `pdf-template/app.js`
  and drop the image-load barrier, the PDF will sometimes ship without the
  profile photo. If you drop the `document.fonts.ready` barrier, the PDF will
  sometimes ship with system-fallback glyphs instead of Big Shoulders Display /
  Besley (the woff2 files load lazily, so DOMContentLoaded alone is not
  enough).
- **The CV is two fixed A4 pages.** Each `.page` in `pdf-template/` has a set
  height with overflow hidden, and page 1 ends after the first employer. When
  content outgrows a page, `pdf-template/app.js` sets `data-render-error`
  instead of the sentinel and `npm run build:pdf` fails; move content between
  pages rather than shrinking type.
- **The dev server caches every file at boot.** Restart `npm run dev` after
  editing HTML, CSS, JS or assets. Screenshots in `images/` are served with a
  one-day `max-age`, so a browser keeps showing the old image after a swap;
  disable the cache when checking one.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Agent skills

### Issue tracker

Forgejo issues on `git.sbrn.eu` via the `fj` CLI, with the REST API for JSON reads and blocking links. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
