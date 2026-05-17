# Graph Report - .  (2026-05-17)

## Corpus Check
- Corpus is ~17,041 words - fits in a single context window. You may not need a graph.

## Summary
- 132 nodes · 138 edges · 25 communities (15 shown, 10 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.86)
- Token cost: 125,359 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_CV Profile & Skills|CV Profile & Skills]]
- [[_COMMUNITY_Site Rendering Pipeline|Site Rendering Pipeline]]
- [[_COMMUNITY_Professional Experience|Professional Experience]]
- [[_COMMUNITY_Site app.js Internals|Site app.js Internals]]
- [[_COMMUNITY_Hono Server & CSP|Hono Server & CSP]]
- [[_COMMUNITY_Stack & Languages|Stack & Languages]]
- [[_COMMUNITY_PDF Pipeline & Build|PDF Pipeline & Build]]
- [[_COMMUNITY_Shared Render Helpers|Shared Render Helpers]]
- [[_COMMUNITY_PDF Build Script|PDF Build Script]]
- [[_COMMUNITY_CSP & Cloudflare Gotchas|CSP & Cloudflare Gotchas]]
- [[_COMMUNITY_Iris Color Palettes|Iris Color Palettes]]
- [[_COMMUNITY_Iris Implementation Plan|Iris Implementation Plan]]
- [[_COMMUNITY_Iris Design Language|Iris Design Language]]
- [[_COMMUNITY_Language Toggle|Language Toggle]]
- [[_COMMUNITY_Theme Toggle|Theme Toggle]]
- [[_COMMUNITY_Deployment Hosting|Deployment Hosting]]
- [[_COMMUNITY_Accessibility Spot Checks|Accessibility Spot Checks]]
- [[_COMMUNITY_Motion & Reduced Motion|Motion & Reduced Motion]]
- [[_COMMUNITY_Iris Scope Boundaries|Iris Scope Boundaries]]
- [[_COMMUNITY_Profile Photo|Profile Photo]]
- [[_COMMUNITY_404 Page Copy|404 Page Copy]]
- [[_COMMUNITY_Robots & Sitemap|Robots & Sitemap]]
- [[_COMMUNITY_Graphify Integration|Graphify Integration]]

## God Nodes (most connected - your core abstractions)
1. `Simon Brunou (CV subject)` - 24 edges
2. `PDF template (FR-only build-time)` - 11 edges
3. `Fullstack Developer role` - 8 edges
4. `Fullstack — BYSTAMP Jul 2017 – Feb 2025` - 8 edges
5. `data.js (single source of truth)` - 6 edges
6. `serveHtml()` - 5 edges
7. `buildPersonJsonLd()` - 4 edges
8. `Simon Brunou (person)` - 4 edges
9. `Puppeteer/headless Chrome PDF build` - 4 edges
10. `Diversif — baby food diversification PWA (2026-)` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Simon Brunou (CV subject)` --semantically_similar_to--> `Simon Brunou (person)`  [EXTRACTED] [semantically similar]
  simon-brunou-cv.pdf → index.html
- `DevOps: GitLab CI/CD, Docker, Proxmox, Terraform` --semantically_similar_to--> `DevOps`  [INFERRED] [semantically similar]
  simon-brunou-cv.pdf → index.html
- `Développeur Fullstack (role)` --semantically_similar_to--> `Fullstack Developer role`  [EXTRACTED] [semantically similar]
  simon-brunou-cv.pdf → index.html
- `Languages: Rust, Dart, Kotlin, Swift, Java, JavaScript, TypeScript, Python, C` --semantically_similar_to--> `Rust`  [EXTRACTED] [semantically similar]
  simon-brunou-cv.pdf → index.html
- `Frameworks: Flutter, React Native, Android, iOS, React, Electron, Angular, Spring Boot, Node.js` --semantically_similar_to--> `Flutter`  [EXTRACTED] [semantically similar]
  simon-brunou-cv.pdf → index.html

## Hyperedges (group relationships)
- **Shared render pipeline: data.js + render.js feeds both site and PDF template, then Puppeteer snapshots** — index_data_js, index_render_js, pdftpl_template, readme_puppeteer_build [EXTRACTED 1.00]
- **CSP strict-dynamic nonce setup vs Cloudflare proxy gotchas** — readme_csp_nonce, readme_cloudflare_proxy_warning, claudemd_cf_rocket_loader_warning [EXTRACTED 1.00]
- **Iris design system: palette + typography across dark site, light résumé, 404** — iris_spec_iris_codename, iris_spec_palette_dark, iris_spec_palette_light, iris_plan_inter_jbmono [EXTRACTED 1.00]

## Communities (25 total, 10 thin omitted)

### Community 0 - "CV Profile & Skills"
Cohesion: 0.09
Nodes (26): HCSP, LEAP, EAT recommendations cited, SvelteKit, Svelte 5, TypeScript, Postgres, Drizzle, Tailwind, Docker, DUT Informatique — IUT de Vannes (2012-2014), Licence Mathématiques, Informatique, Statistiques — UBS (2014-2015), Master Multimédia, Web, Réseaux — UBS (2015-2017), simon.brunou@proton.me, IUT de Vannes (employer/institution), Stage — IUT de Vannes Mar 2014 – Jun 2014 (+18 more)

### Community 1 - "Site Rendering Pipeline"
Cohesion: 0.13
Nodes (17): data.js as single source of truth, Two rendering targets, one data model, app.js (page bootstrap), data.js (single source of truth), Fade-rescue safety net (4s timeout), IntersectionObserver fade-in reveals, JSON-LD Person schema (runtime injection), render.js (shared helpers) (+9 more)

### Community 2 - "Professional Experience"
Cohesion: 0.2
Nodes (10): Maître d'apprentissage / mentoring alternants, DevOps: GitLab CI/CD, Docker, Proxmox, Terraform, OTA firmware updates for connected tampon, PDF signature app via Bluetooth tampon connecté, Multi-language SDK distribution to partners, Sentry integration across mobile, desktop, backend, SDK, BYSTAMP (employer), Fullstack — BYSTAMP Jul 2017 – Feb 2025 (+2 more)

### Community 3 - "Site app.js Internals"
Cohesion: 0.31
Nodes (3): isLight(), toggleTheme(), updateThemeIcon()

### Community 4 - "Hono Server & CSP"
Cohesion: 0.36
Nodes (7): cspWithNonce(), generateNonce(), injectNonce(), loadHtml(), log(), serveHtml(), shutdown()

### Community 5 - "Stack & Languages"
Cohesion: 0.22
Nodes (9): Développeur Fullstack (role), Frameworks: Flutter, React Native, Android, iOS, React, Electron, Angular, Spring Boot, Node.js, Languages: Rust, Dart, Kotlin, Swift, Java, JavaScript, TypeScript, Python, C, Fullstack Developer role, Flutter, Kotlin, React, Rust (+1 more)

### Community 6 - "PDF Pipeline & Build"
Cohesion: 0.29
Nodes (7): data-render-complete sentinel for PDF build, Brittany, France (location), Simon Brunou (person), simon-brunou-cv.pdf download link, ?pdf=1 skip path on resume, pdf-template/ build-time directory, Puppeteer/headless Chrome PDF build

### Community 7 - "Shared Render Helpers"
Cohesion: 0.53
Nodes (4): buildPersonJsonLd(), dedupeBySchool(), injectJsonLd(), pickLang()

### Community 8 - "PDF Build Script"
Cohesion: 0.6
Nodes (3): main(), resolveChromium(), startStaticServer()

### Community 9 - "CSP & Cloudflare Gotchas"
Cohesion: 0.5
Nodes (5): Cloudflare Rocket Loader breaks strict-dynamic CSP, Cloudflare Rocket Loader / Auto Minify break CSP, Per-request CSP nonce + strict-dynamic, GET /healthz container healthcheck, Hono on Node 22 server

### Community 10 - "Iris Color Palettes"
Cohesion: 0.67
Nodes (4): Iris palette (warm purple-pink), Radial gradient mesh background, Dark-surface palette (#0c0a14 ground + accent ramp), Light-surface palette (résumé / PDF register)

### Community 11 - "Iris Implementation Plan"
Cohesion: 0.67
Nodes (3): DOM construction via createElement + textContent (no innerHTML), Iris Redesign implementation plan, Engineering-elegant Iris redesign spec

### Community 12 - "Iris Design Language"
Cohesion: 0.67
Nodes (3): Inter + JetBrains Mono typography pairing, Codename Iris (design language), Linear / Vercel / Stripe aesthetic lineage

## Knowledge Gaps
- **60 isolated node(s):** `Brittany, France (location)`, `Kotlin`, `Swift`, `React`, `JSON-LD Person schema (runtime injection)` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simon Brunou (CV subject)` connect `CV Profile & Skills` to `Professional Experience`, `Stack & Languages`, `PDF Pipeline & Build`?**
  _High betweenness centrality (0.203) - this node is a cross-community bridge._
- **Why does `Puppeteer/headless Chrome PDF build` connect `PDF Pipeline & Build` to `Site Rendering Pipeline`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `simon-brunou-cv.pdf download link` connect `PDF Pipeline & Build` to `CV Profile & Skills`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `data.js (single source of truth)` (e.g. with `render.js (shared helpers)` and `app.js (page bootstrap)`) actually correct?**
  _`data.js (single source of truth)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Brittany, France (location)`, `Kotlin`, `Swift` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CV Profile & Skills` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Site Rendering Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._