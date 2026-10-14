# Graph Report - simonbrunou.bzh  (2026-10-14)

## Corpus Check
- Corpus is ~39,637 words - fits in a single context window. You may not need a graph.

## Summary
- 211 nodes · 256 edges · 26 communities (17 shown, 9 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- package.json Manifest
- Site Architecture Docs
- Iris Replacement Decision
- Bands Design System
- Homepage Renderer (app.js)
- Hono Server and CSP
- PDF Build Script
- Diversif Home Screenshot
- CV Template Renderer
- Cinder Dashboard Screenshot
- Cinder Library Screenshot
- Renovate Config
- Diversif Allergens Screenshot
- Shared Render Helpers
- Forgejo Issue Tracker
- Self-hosted Fonts
- Domain Docs
- SB Favicon
- Coolify Deployment
- CSP Nonce Hook
- PDF Rebuild Hook
- Bands Palette Rule
- Sitemap

## God Nodes (most connected - your core abstractions)
1. `el()` - 11 edges
2. `render()` - 9 edges
3. `Simon Brunou CV (French PDF)` - 9 edges
4. `ADR 0001: Replace Iris with a recruiter-first, product-led design` - 8 edges
5. `pick()` - 7 edges
6. `renderBand()` - 7 edges
7. `Iris Redesign Implementation Plan (superseded)` - 7 edges
8. `link()` - 6 edges
9. `renderIntro()` - 6 edges
10. `Homepage index.html` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Profile photo used in the CV header and as the Open Graph / social preview image for the personal site` --references--> `CV PDF template page`  [INFERRED]
  photo.png → pdf-template/index.html
- `BYSTAMP experience section in CV` --semantically_similar_to--> `BYSTAMP (employer 2017-2025)`  [INFERRED] [semantically similar]
  simon-brunou-cv.pdf → PRODUCT.md
- `CV PDF template page` --references--> `Simon Brunou CV (French PDF)`  [INFERRED]
  pdf-template/index.html → simon-brunou-cv.pdf
- `Headshot portrait of a young man with short dark wavy hair, light stubble, neutral expression, framed from shoulders up against a plain light background` --conceptually_related_to--> `Simon Brunou CV (French PDF)`  [INFERRED]
  photo.png → simon-brunou-cv.pdf
- `CV` --references--> `Simon Brunou CV (French PDF)`  [INFERRED]
  GLOSSARY.md → simon-brunou-cv.pdf

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Bands design language rules** — design_md_bands_north_star, design_md_own_band_rule, design_md_flat_field_rule, design_md_shots_only_shadow_rule [EXTRACTED 1.00]
- **One data model, two rendering targets** — agents_data_js_single_source, index_html, pdf_template_index_html, simon_brunou_cv_pdf [EXTRACTED 1.00]
- **Featured products shipped in 2026** — product_md_diversif, product_md_cinder, product_md_tisanerie [EXTRACTED 1.00]
- **Iris design language components** — docs_superpowers_specs_2026_05_16_engineering_elegant_redesign_design_palette, docs_superpowers_specs_2026_05_16_engineering_elegant_redesign_design_typography, docs_superpowers_specs_2026_05_16_engineering_elegant_redesign_design_gradient_mesh, docs_superpowers_specs_2026_05_16_engineering_elegant_redesign_design_motion [EXTRACTED 1.00]
- **Three redesigned surfaces** — docs_superpowers_specs_2026_05_16_engineering_elegant_redesign_design_homepage, docs_superpowers_specs_2026_05_16_engineering_elegant_redesign_design_resume_page, docs_superpowers_specs_2026_05_16_engineering_elegant_redesign_design_404_page [EXTRACTED 1.00]
- **Cinder dashboard panels** — images_cinder_dashboard_pipeline_stats, images_cinder_dashboard_run_maintenance, images_cinder_dashboard_service_health, images_cinder_dashboard_pending_approvals [EXTRACTED 1.00]
- **Cinder Library page layout** — images_cinder_library_sidebar_navigation, images_cinder_library_media_tabs, images_cinder_library_poster_card_grid, images_cinder_library_adopt_existing_library [INFERRED 0.85]
- **Diversif feature cards** — images_diversif_home_carnet, images_diversif_home_allergens, images_diversif_home_coparents, images_diversif_home_guide [EXTRACTED 1.00]

## Communities (26 total, 9 thin omitted)

### Community 0 - "package.json Manifest"
Cohesion: 0.08
Nodes (25): author, dependencies, hono, @hono/node-server, description, devDependencies, puppeteer-core, engines (+17 more)

### Community 1 - "Site Architecture Docs"
Cohesion: 0.10
Nodes (22): 404 page, 404 inline EN/FR language script, Per-request CSP nonce with strict-dynamic, data.js single source of truth, PDF generation flow (build-pdf.js), data-render-complete sentinel, render.js SBRender shared helpers, server.js Hono server (+14 more)

### Community 2 - "Iris Replacement Decision"
Cohesion: 0.14
Nodes (17): ADR 0001: Replace Iris with a recruiter-first, product-led design, Featured projects Diversif and Cinder, Visitor (recruiter or client skimming ~30s), Iris Redesign Implementation Plan (superseded), render(lang) live EN/FR re-render, Resume data-render-complete sentinel and Turnstile PDF flow, Engineering-elegant redesign spec (superseded), 404 page design (+9 more)

### Community 3 - "Bands Design System"
Cohesion: 0.11
Nodes (16): Cinder band (dark/ember), Diversif band (peach/sage), Creative North Star: Bands, Project band component, Scroll-driven screenshot slide, Slate band for longest job (BYSTAMP), Band, Featured project (+8 more)

### Community 4 - "Homepage Renderer (app.js)"
Cohesion: 0.33
Nodes (16): el(), hostOf(), link(), pick(), render(), renderBand(), renderContact(), renderExperience() (+8 more)

### Community 5 - "Hono Server and CSP"
Cohesion: 0.15
Nodes (14): app, BASELINE_HEADERS, cspWithNonce(), __dirname, generateNonce(), HTML_PAGES, htmlCache, injectNonce() (+6 more)

### Community 6 - "PDF Build Script"
Cohesion: 0.18
Nodes (9): puppeteer-core, __dirname, main(), MIME, OUTPUT, resolveChromium(), ROOT, serveFile() (+1 more)

### Community 7 - "Diversif Home Screenshot"
Cohesion: 0.20
Nodes (9): Allergenes suivis card (12 allergens), Carnet d'aliments card, Co-parents card, Creer mon compte / Se connecter CTAs, Guide par etape card, Hero: Diversifier en confiance, a votre rythme, Top navigation (Accueil, Guide, Allergenes, Sources), Diversif homepage screenshot (FR) (+1 more)

### Community 8 - "CV Template Renderer"
Cohesion: 0.36
Nodes (4): addContact(), el(), link(), strip()

### Community 9 - "Cinder Dashboard Screenshot"
Cohesion: 0.29
Nodes (6): Cinder admin dashboard screenshot, Cinder (media request/pipeline app), Pending approvals empty state, Pipeline stats summary (219 movies, 155 TV wanted), Run maintenance task cards, Service health panel (TMDB, Prowlarr, QBittorrent, Sabnzbd, Plex, Audiobookshelf, OpenSubtitles)

### Community 10 - "Cinder Library Screenshot"
Cohesion: 0.40
Nodes (6): Adopt existing library action, Cinder media management app, Library tabs: Movies 229, Series 91, Books 126, Poster card grid with Monitored badge, size, Cancel/Delete actions, Cinder Library page screenshot (Series tab, dark UI, poster grid), Sidebar navigation (Everyone/Admin sections, theme and EN/FR toggles)

### Community 11 - "Renovate Config"
Cohesion: 0.33
Nodes (5): config:recommended, extends, packageRules, platformAutomerge, $schema

### Community 12 - "Diversif Allergens Screenshot"
Cohesion: 0.40
Nodes (4): Cited sources: HCSP 2020, EAACI 2021, NEJM 2015/2016, EU reg 1169/2011, Diversif (baby food diversification app), Early allergen introduction guidance (4-6 months; LEAP and EAT studies), Diversif Allergens page screenshot (French UI, 12 tracked allergens)

### Community 13 - "Shared Render Helpers"
Cohesion: 0.70
Nodes (4): buildPersonJsonLd(), dedupeBySchool(), injectJsonLd(), pickLang()

### Community 14 - "Forgejo Issue Tracker"
Cohesion: 0.50
Nodes (4): Issue tracker: Forgejo, fj CLI, Wayfinding map/child tickets, Triage labels

### Community 15 - "Self-hosted Fonts"
Cohesion: 0.67
Nodes (3): Typography: Big Shoulders Display + Besley, Besley OFL license, Big Shoulders Display OFL license

### Community 16 - "Domain Docs"
Cohesion: 0.67
Nodes (3): Domain docs guidance, docs/adr ADRs, GLOSSARY.md

## Knowledge Gaps
- **47 isolated node(s):** `config:recommended`, `Forgejo CI workflow`, `GLOSSARY.md`, `docs/adr ADRs`, `fj CLI` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 103 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Simon Brunou CV (French PDF)` connect `Site Architecture Docs` to `Bands Design System`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Simon Brunou CV (French PDF)` (e.g. with `CV` and `CV PDF template page`) actually correct?**
  _`Simon Brunou CV (French PDF)` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config:recommended`, `Forgejo CI workflow`, `GLOSSARY.md` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Why does `BYSTAMP experience section in CV` connect `Bands Design System` to `Site Architecture Docs`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Should `Site Architecture Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.10144927536231885 - nodes in this community are weakly interconnected._
- **Should `Iris Replacement Decision` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._