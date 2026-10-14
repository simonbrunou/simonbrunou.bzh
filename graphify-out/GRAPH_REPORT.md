# Graph Report - simonbrunou.bzh  (2026-10-14)

## Corpus Check
- Corpus is ~18,620 words - fits in a single context window. You may not need a graph.

## Summary
- 256 nodes · 325 edges · 29 communities (17 shown, 12 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Site Pages & Rendering
- Server & PDF Build Scripts
- package.json Manifest
- CV Profile, Education & Languages
- CV BYSTAMP & Diversif Work
- CSP, Deployment & CI
- Site Hero & Skills
- Site Bootstrap & JSON-LD
- Agent Instructions & Tracker
- Site app.js Internals
- PDF Template Sections
- Tisanerie Project & Frameworks
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
1. `Simon Brunou` - 23 edges
2. `index.html live site` - 19 edges
3. `SEO / Open Graph / Twitter meta tags` - 12 edges
4. `Développeur Fullstack — BYSTAMP, juil. 2017 – fév. 2025` - 12 edges
5. `Fullstack Developer role` - 11 edges
6. `404 page` - 10 edges
7. `Stack overview` - 7 edges
8. `server.js Hono server` - 7 edges
9. `PDF template (FR-only build-time)` - 7 edges
10. `Simon Brunou CV` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Fullstack Developer role` --semantically_similar_to--> `Développeur Fullstack`  [INFERRED] [semantically similar]
  index.html → simon-brunou-cv.pdf
- `Simon Brunou (person)` --semantically_similar_to--> `Simon Brunou`  [INFERRED] [semantically similar]
  index.html → simon-brunou-cv.pdf
- `Brittany, France (location)` --conceptually_related_to--> `Profil: Rust et programmation système, Bretagne`  [INFERRED]
  index.html → simon-brunou-cv.pdf
- `Rust` --conceptually_related_to--> `Langages: Rust, Dart, Kotlin, Swift, Java, JavaScript, TypeScript, Python, C`  [INFERRED]
  index.html → simon-brunou-cv.pdf
- `Apps de démonstration SDK: Flutter, Xamarin, React Native, Kotlin, Swift` --references--> `Flutter`  [EXTRACTED]
  simon-brunou-cv.pdf → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CV PDF build pipeline** — agents_data_js, agents_pdf_generation_flow, agents_render_complete_sentinel, simon_brunou_cv [EXTRACTED 1.00]
- **Iris design system: palette + typography across dark site, light résumé, 404** — iris_spec_iris_codename, iris_spec_palette_dark, iris_spec_palette_light, iris_plan_inter_jbmono [EXTRACTED 1.00]
- **Server security and deployment stack** — agents_server_js, agents_csp_nonce, agents_static_assets_allowlist, agents_cloudflare_csp_pitfall [EXTRACTED 1.00]
- **Agent guidance docs** — agents, claude, docs_agents_domain, docs_agents_issue_tracker, docs_agents_triage_labels [INFERRED 0.85]
- **Head SEO and discoverability metadata** — index_seo_meta, index_hreflang, index_canonical_url, index_jsonld_placeholder [EXTRACTED 1.00]
- **Progressive enhancement and failure fallbacks** — index_noscript_fallback, index_fade_rescue, index_theme_bootstrap, index_intersectionobserver_reveals [INFERRED 0.85]
- **Script load chain data.js render.js app.js** — index_data_js, index_render_js, index_app_js, index_scripts [EXTRACTED 1.00]
- **BYSTAMP connected stamp ecosystem** — simon_brunou_cv_pdf_sign, simon_brunou_cv_device_mgmt, simon_brunou_cv_middleware, simon_brunou_cv_sdk, simon_brunou_cv_backend, simon_brunou_cv_desktop_apps [EXTRACTED 1.00]
- **Skill groups** — simon_brunou_cv_lang, simon_brunou_cv_fw, simon_brunou_cv_tools [EXTRACTED 1.00]
- **Education path** — simon_brunou_cv_dut, simon_brunou_cv_licence, simon_brunou_cv_master [EXTRACTED 1.00]

## Communities (29 total, 12 thin omitted)

### Community 0 - "Site Pages & Rendering"
Cohesion: 0.07
Nodes (33): 404 page, Focus, reduced-motion and forced-colors support, Back home and Resume actions, Inline theme/lang bootstrap script, Google Fonts Inter + JetBrains Mono, Saved-language restore (EN/FR strings), Breton countryside 404 message, Theme toggle with localStorage and theme-color meta (+25 more)

### Community 1 - "Server & PDF Build Scripts"
Cohesion: 0.09
Nodes (23): puppeteer-core, __dirname, main(), MIME, OUTPUT, resolveChromium(), ROOT, serveFile() (+15 more)

### Community 2 - "package.json Manifest"
Cohesion: 0.08
Nodes (25): author, dependencies, hono, @hono/node-server, description, devDependencies, puppeteer-core, engines (+17 more)

### Community 3 - "CV Profile, Education & Languages"
Cohesion: 0.10
Nodes (26): Backend Spring Boot (Java/Kotlin) migré vers Rust, Application mobile compagnon (POC) Dart/Flutter, Allemand — notions, DUT Informatique — IUT de Vannes, simon.brunou@proton.me, Anglais — courant, Stage — IUT de Vannes, mars 2014 – juin 2014, Développeur Fullstack — Startup (confidentiel), fév. 2025 – juil. 2025 (+18 more)

### Community 4 - "CV BYSTAMP & Diversif Work"
Cohesion: 0.10
Nodes (23): Authentification maison: Argon2id, passkeys WebAuthn, BYSTAMP, Apps de démonstration SDK: Flutter, Xamarin, React Native, Kotlin, Swift, Apps desktop Windows/macOS/Linux React + Electron, Gestion objet connecté: onboarding, appairage Bluetooth, OTA, configuration, DevOps: GitLab CI/CD, Docker, Proxmox, Terraform, Stack Diversif: SvelteKit, Svelte 5, TypeScript, Postgres, Drizzle, Tailwind, Docker, Diversif — diversification alimentaire bébé (2026 – présent) (+15 more)

### Community 5 - "CSP, Deployment & CI"
Cohesion: 0.17
Nodes (12): Coolify + Docker deployment, server.js Hono server, STATIC_ASSETS allowlist, Forgejo CI workflow, Boot server and probe /healthz gate, Chromium requirement / CHROMIUM_PATH, Coolify deployment steps, Docker build and run (+4 more)

### Community 6 - "Site Hero & Skills"
Cohesion: 0.30
Nodes (14): Brittany, France (location), DevOps, Flutter, Fullstack Developer role, Hero header, Kotlin, Noscript static fallback, photo.png profile photo (+6 more)

### Community 7 - "Site Bootstrap & JSON-LD"
Cohesion: 0.25
Nodes (10): app.js (page bootstrap), Contact section, data.js (single source of truth), Fade-in rescue timer (4s safety net), JSON-LD Person schema (runtime injection), Dynamic JSON-LD from data.js, Noscript contact links (email, GitHub, LinkedIn), render.js (shared helpers) (+2 more)

### Community 8 - "Agent Instructions & Tracker"
Cohesion: 0.25
Nodes (7): Domain docs guidance, docs/adr ADRs, GLOSSARY.md, Issue tracker: Forgejo, fj CLI, Wayfinding map/child tickets, Triage labels

### Community 9 - "Site app.js Internals"
Cohesion: 0.33
Nodes (5): isLight(), onScrollOrResize(), toggleTheme(), updateScrollUI(), updateThemeIcon()

### Community 10 - "PDF Template Sections"
Cohesion: 0.25
Nodes (8): // compétences section (langages, frameworks, outils), // expérience section, // formation section, // centres d'intérêt section, // langues section, // open source section, // profil section, PDF template (FR-only build-time)

### Community 11 - "Tisanerie Project & Frameworks"
Cohesion: 0.33
Nodes (7): Astro, Architecture content-as-data (~60 plantes, 12 besoins, Zod), Frameworks: Flutter, React Native, Android, iOS, React, Electron, Angular, Spring Boot, Node.js, React, Stack Tisanerie: Astro, React, TypeScript, Tailwind, Zod, Docker, Tisanerie — recommandation de tisanes (2026 – présent), Zod

### Community 12 - "Renovate Config"
Cohesion: 0.33
Nodes (5): config:recommended, extends, packageRules, platformAutomerge, $schema

### Community 13 - "Shared Render Helpers"
Cohesion: 0.53
Nodes (4): buildPersonJsonLd(), dedupeBySchool(), injectJsonLd(), pickLang()

### Community 14 - "Iris Color Palettes"
Cohesion: 0.67
Nodes (4): Iris palette (warm purple-pink), Radial gradient mesh background, Dark-surface palette (#0c0a14 ground + accent ramp), Light-surface palette (résumé / PDF register)

### Community 15 - "Iris Plan & Spec"
Cohesion: 0.67
Nodes (3): DOM construction via createElement + textContent (no innerHTML), Iris Redesign implementation plan, Engineering-elegant Iris redesign spec

### Community 16 - "Iris Design Language"
Cohesion: 0.67
Nodes (3): Inter + JetBrains Mono typography pairing, Codename Iris (design language), Linear / Vercel / Stripe aesthetic lineage

## Knowledge Gaps
- **62 isolated node(s):** `config:recommended`, `Iris Redesign implementation plan`, `Focus, reduced-motion and forced-colors support`, `Google Fonts Inter + JetBrains Mono`, `Breton countryside 404 message` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 112 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simon Brunou` connect `CV Profile, Education & Languages` to `Site Pages & Rendering`, `Tisanerie Project & Frameworks`, `CV BYSTAMP & Diversif Work`, `Site Hero & Skills`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Fullstack Developer role` (e.g. with `Développeur Fullstack` and `Hero header`) actually correct?**
  _`Fullstack Developer role` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config:recommended`, `Iris Redesign implementation plan`, `Focus, reduced-motion and forced-colors support` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Site Pages & Rendering` be split into smaller, more focused modules?**
  _Cohesion score 0.06825396825396825 - nodes in this community are weakly interconnected._
- **Why does `Simon Brunou CV` connect `Site Pages & Rendering` to `Server & PDF Build Scripts`, `CV Profile, Education & Languages`, `Site Hero & Skills`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **Should `Server & PDF Build Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.08602150537634409 - nodes in this community are weakly interconnected._
- **Why does `index.html live site` connect `Site Pages & Rendering` to `CSP, Deployment & CI`, `Site Hero & Skills`, `Site Bootstrap & JSON-LD`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._