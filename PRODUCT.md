# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The Visitor: a recruiter or prospective client who already has Simon Brunou's name or CV, often from an email or a LinkedIn message. They skim the homepage for about 30 seconds, then either email Simon or download the CV. Secondary: people arriving from Diversif, Cinder or Tisanerie.

## Product Purpose

simonbrunou.bzh is Simon's personal site: a homepage, a 404 page and a downloadable CV, all generated from one shared data file (`data.js`). It exists to make the Visitor want to get in touch, and to hand them the CV. Success is an email or a CV download after a short visit.

## Positioning

Two things another fullstack developer could not easily claim together:

- **He stays and maintains.** Eight years on one product line at BYSTAMP (2017 to 2025), across every layer of the software around a connected signing stamp, while training apprentices.
- **He ships whole products alone.** In 2026 he built and shipped Diversif, Cinder and Tisanerie himself, from data model to interface to self-hosted deployment.

## Operating Context

- The Visitor often has the CV PDF open in another tab and compares the two.
- Language: English and French, switchable on the homepage. The CV PDF is French only.
- Simon lives in Saint-Nolff, near Vannes, in Brittany.

## Capabilities and Constraints

- Static site served by a small Node/Hono server with a per-request CSP nonce (`'strict-dynamic'`). Vanilla HTML, CSS and JS, no bundler, no test suite. New assets must be added to the server's static allowlist.
- The CV PDF is rendered at build time from `pdf-template/` with Puppeteer and committed.
- Cloudflare Rocket Loader and Auto Minify must stay off (they break the CSP).

## Brand Commitments

- Voice: first person, short plain sentences, facts instead of self-praise ("committed", "motivated" and "passionate" are out), no exclamation marks, no em dashes. French is written as French, not translated line by line.
- Brittany appears as text only (place names), never as symbols or imagery.
- The Iris patterns listed in `docs/adr/0001-replace-iris.md` are banned.
- No theme toggle: each surface commits to one colour mode.

## Evidence on Hand

- `data.js`: experience (BYSTAMP 2017 to 2025, a 2025 startup contract, two internships), education, skills, spoken languages, interests (homelab, coffee, cycling, climbing).
- Diversif: live at https://diversif.app (interface in French), source at https://github.com/simonbrunou/diversif.
- Cinder: public GPLv3 repo at https://github.com/simonbrunou/cinder, v3.0, over 1,100 commits since June 2026. No public demo.
- Tisanerie: live at https://tisanerie.app.
- Screenshots in `prototype/assets/` (prototype branch). The Cinder ones show an empty test instance and must be retaken with real data before shipping.
- `photo.png` is 76×76 px. No larger photo is available yet.
- No testimonials, client names or metrics exist. Do not invent any.

## Product Principles

1. The Visitor's 30 seconds decide everything: the email and the CV are always one step away.
2. Show shipped work, not adjectives: the projects and the years carry the claims.
3. Every fact matches `data.js` and the project repos.
4. English and French are equals.
