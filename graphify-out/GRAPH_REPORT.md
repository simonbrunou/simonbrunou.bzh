# Graph Report - simonbrunou.bzh  (2026-10-14)

## Corpus Check
- 26 files · ~18,620 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 183 nodes · 210 edges · 25 communities (13 shown, 12 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Site Pages & Rendering
- package.json Manifest
- PDF Build Pipeline
- Hono Server Internals
- CSP, Deployment & CI
- Agent Instructions & Tracker
- Site app.js Internals
- PDF Template Sections
- Renovate Config
- Shared Render Helpers
- Iris Color Palettes
- Iris Plan & Spec
- Iris Design Language
- CSP Nonce Guard Hook
- PDF Rebuild Reminder Hook
- Accessibility Spot Checks
- Iris Scope Boundaries
- Motion & Reduced Motion
- Profile Photo
- Graphify Integration
- Resume PDF Skip Path
- Section Heading Keys
- Robots & Sitemap

## God Nodes (most connected - your core abstractions)
1. `index.html live site` - 19 edges
2. `404 page` - 10 edges
3. `Simon Brunou CV (PDF)` - 10 edges
4. `PDF template (FR-only build-time)` - 7 edges
5. `server.js Hono server` - 7 edges
6. `Stack overview` - 7 edges
7. `serveHtml()` - 5 edges
8. `data.js single source of truth` - 5 edges
9. `scripts` - 4 edges
10. `buildPersonJsonLd()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Back home and Resume actions` --references--> `Simon Brunou CV (PDF)`  [EXTRACTED]
  404.html → simon-brunou-cv.pdf
- `Boot server and probe /healthz gate` --references--> `/healthz endpoint`  [INFERRED]
  .forgejo/workflows/ci.yml → README.md
- `Two rendering targets, one data model` --references--> `Simon Brunou CV (PDF)`  [EXTRACTED]
  AGENTS.md → simon-brunou-cv.pdf
- `Hero header` --references--> `Simon Brunou CV (PDF)`  [EXTRACTED]
  index.html → simon-brunou-cv.pdf
- `Noscript static fallback` --references--> `Simon Brunou CV (PDF)`  [EXTRACTED]
  index.html → simon-brunou-cv.pdf

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Iris design system: palette + typography across dark site, light résumé, 404** — iris_spec_iris_codename, iris_spec_palette_dark, iris_spec_palette_light, iris_plan_inter_jbmono [EXTRACTED 1.00]
- **Agent guidance docs** — agents, claude, docs_agents_domain, docs_agents_issue_tracker, docs_agents_triage_labels [INFERRED 0.85]
- **Server security and deployment stack** — agents_server_js, agents_csp_nonce, agents_static_assets_allowlist, agents_cloudflare_csp_pitfall [EXTRACTED 1.00]
- **CV PDF build pipeline** — agents_data_js, agents_pdf_generation_flow, agents_render_complete_sentinel, simon_brunou_cv [EXTRACTED 1.00]

## Communities (25 total, 12 thin omitted)

### Community 0 - "Site Pages & Rendering"
Cohesion: 0.08
Nodes (35): 404 page, Focus, reduced-motion and forced-colors support, Back home and Resume actions, Inline theme/lang bootstrap script, Google Fonts Inter + JetBrains Mono, Saved-language restore (EN/FR strings), Breton countryside 404 message, Theme toggle with localStorage and theme-color meta (+27 more)

### Community 1 - "package.json Manifest"
Cohesion: 0.08
Nodes (25): author, dependencies, hono, @hono/node-server, description, devDependencies, puppeteer-core, engines (+17 more)

### Community 2 - "PDF Build Pipeline"
Cohesion: 0.11
Nodes (15): PDF generation flow (build-pdf.js), Noscript static fallback, puppeteer-core, __dirname, main(), MIME, OUTPUT, resolveChromium() (+7 more)

### Community 3 - "Hono Server Internals"
Cohesion: 0.15
Nodes (14): app, BASELINE_HEADERS, cspWithNonce(), __dirname, generateNonce(), HTML_PAGES, htmlCache, injectNonce() (+6 more)

### Community 4 - "CSP, Deployment & CI"
Cohesion: 0.17
Nodes (12): Coolify + Docker deployment, server.js Hono server, STATIC_ASSETS allowlist, Forgejo CI workflow, Boot server and probe /healthz gate, Chromium requirement / CHROMIUM_PATH, Coolify deployment steps, Docker build and run (+4 more)

### Community 5 - "Agent Instructions & Tracker"
Cohesion: 0.25
Nodes (7): Domain docs guidance, docs/adr ADRs, GLOSSARY.md, Issue tracker: Forgejo, fj CLI, Wayfinding map/child tickets, Triage labels

### Community 6 - "Site app.js Internals"
Cohesion: 0.33
Nodes (5): isLight(), onScrollOrResize(), toggleTheme(), updateScrollUI(), updateThemeIcon()

### Community 7 - "PDF Template Sections"
Cohesion: 0.25
Nodes (8): // compétences section (langages, frameworks, outils), // expérience section, // formation section, // centres d'intérêt section, // langues section, // open source section, // profil section, PDF template (FR-only build-time)

### Community 8 - "Renovate Config"
Cohesion: 0.33
Nodes (5): config:recommended, extends, packageRules, platformAutomerge, $schema

### Community 9 - "Shared Render Helpers"
Cohesion: 0.53
Nodes (4): buildPersonJsonLd(), dedupeBySchool(), injectJsonLd(), pickLang()

### Community 10 - "Iris Color Palettes"
Cohesion: 0.67
Nodes (4): Iris palette (warm purple-pink), Radial gradient mesh background, Dark-surface palette (#0c0a14 ground + accent ramp), Light-surface palette (résumé / PDF register)

### Community 11 - "Iris Plan & Spec"
Cohesion: 0.67
Nodes (3): DOM construction via createElement + textContent (no innerHTML), Iris Redesign implementation plan, Engineering-elegant Iris redesign spec

### Community 12 - "Iris Design Language"
Cohesion: 0.67
Nodes (3): Inter + JetBrains Mono typography pairing, Codename Iris (design language), Linear / Vercel / Stripe aesthetic lineage

## Knowledge Gaps
- **48 isolated node(s):** `config:recommended`, `Iris Redesign implementation plan`, `Inter + JetBrains Mono typography pairing`, `DOM construction via createElement + textContent (no innerHTML)`, `New section_heading_* keys in data.js ui.en/ui.fr` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 98 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simon Brunou CV (PDF)` connect `PDF Build Pipeline` to `Site Pages & Rendering`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `index.html live site` (e.g. with `Per-request CSP nonce with strict-dynamic` and `server.js Hono server`) actually correct?**
  _`index.html live site` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config:recommended`, `Iris Redesign implementation plan`, `Inter + JetBrains Mono typography pairing` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Site Pages & Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.0761904761904762 - nodes in this community are weakly interconnected._
- **Why does `index.html live site` connect `Site Pages & Rendering` to `PDF Build Pipeline`, `CSP, Deployment & CI`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `package.json Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Why does `puppeteer-core` connect `PDF Build Pipeline` to `package.json Manifest`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._