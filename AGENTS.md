# AGENTS.md

This file provides guidance to coding agents (Claude Code, Codex, OpenCode, Copilot, Pi, omp) when working with code in this repository. It is the single source of truth: `CLAUDE.md` only imports it, so edit this file.

## Commands

- `npm run dev` — start the server in watch mode (Hono on `:3000`)
- `npm start` — production start (no watch)
- `npm run build:pdf` — re-render `simon-brunou-cv.pdf` from `pdf-template/`
  using Puppeteer. Requires a local Chromium (`google-chrome-stable`,
  `chromium`, or `chromium-browser` on PATH, or set `CHROMIUM_PATH`).
  The PDF is committed to the repo; rerun and commit after editing `data.js`
  or anything under `pdf-template/`.

There is no test suite, no linter, no bundler. Vanilla HTML/CSS/JS served by
a tiny Node server.

## Architecture

**Single source of truth — `data.js`.** Defines `window.RESUME_DATA` (personal
info, about paragraphs, projects with their screenshots, experience grouped by
employer with positions oldest first, skills, education, languages, interests,
UI strings). Consumed by the live site and the PDF template. Most content
changes start here.

**Design — Bands** (`docs/adr/0001-replace-iris.md`, `DESIGN.md`). Each
project with `shots` in `data.js` gets a full-width band in its own app's
colours; projects without shots get one line under the bands. A new banded
project needs its own `.band-<id>` colours in `styles.css`. The longest-held
job gets the slate band. Fonts (Big Shoulders Display, Besley) are
self-hosted under `fonts/`; screenshots live in `images/` as WebP.

**Two rendering targets, one data model.**

1. `index.html` + `app.js` + `styles.css` — the live site at `/`. `app.js`
   builds the whole page from `data.js` into `#page`. Bilingual (EN/FR),
   client-side language toggle that also rewrites `?lang=`. JSON-LD `Person`
   block injected at runtime. `404.html` reuses `styles.css`.
2. `pdf-template/{index.html,app.js,styles.css}` — build-time template
   rendered once to `simon-brunou-cv.pdf`. **Not served in production** (the
   Dockerfile strips this directory). French-only, print-styled.

`render.js` is loaded by both pages and exposes shared helpers on
`window.SBRender`: `pickLang`, `buildPersonJsonLd`, `injectJsonLd`.

**PDF generation flow** (`scripts/build-pdf.js`): spins up a tiny static HTTP
server on a random localhost port that exposes `pdf-template/` and the repo
root, drives headless Chrome at `/pdf-template/`, waits for the
`html[data-render-complete]` sentinel set by `pdf-template/app.js` once all
images **and** `document.fonts.ready` have resolved, then snapshots to A4
PDF with `printBackground: true`. The sentinel is load-bearing — don't drop
either gate or the PDF races (image gate → missing photo; font gate → system
fallback glyphs instead of Big Shoulders Display / Besley).

**Server — `server.js` (Hono on Node 22).** Reads every asset into memory at
boot, then serves from cache. Key concerns:

- **Per-request CSP nonce.** `BASE_CSP` is rewritten on each HTML response to
  inject `'nonce-<random>' 'strict-dynamic'` into `script-src`. Every
  `<script` tag in the served HTML is decorated with the matching `nonce=…`
  attribute. HTML responses are forced to `Cache-Control: private, no-store`
  so a shared cache can't replay a nonce to multiple visitors. `'strict-dynamic'`
  is required so `render.js` can inject the JSON-LD `<script>` block at runtime.
- **Static asset map** — `STATIC_ASSETS` is the allowlist of routes; adding a
  new file (a screenshot in `images/`, a font in `fonts/`) means adding an
  entry here. There is no directory traversal. The CSP allows only `'self'`
  for styles and fonts, so no third-party font CDN and no inline styles.
- **`HTML_PAGES`** lists pages that get the nonce treatment. `404.html` is
  served via `app.notFound(...)` with the same machinery.

**Deployment — Coolify + Docker.** Build runs `npm install --omit=dev`, then
ships a browser-free Alpine image. `puppeteer-core` is a devDependency only
(no Chromium in production). Traefik fronts the container; `HEALTHCHECK` hits
`/healthz`. `pdf-template/` and `scripts/` are removed from the runtime image
in the Dockerfile.

## Things that have bitten us

- **Cloudflare proxy options break CSP.** Rocket Loader and Auto Minify
  inject/rewrite scripts in a way that defeats the strict-dynamic nonce
  policy — they must stay **off** in the Cloudflare dashboard for this site.
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
