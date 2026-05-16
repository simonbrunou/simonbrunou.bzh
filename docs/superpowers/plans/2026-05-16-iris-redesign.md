# Iris Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the homepage (`/`), résumé (`/resume/`), and 404 page into the Iris language (engineering-elegant, Stripe-lineage warm purple-pink palette) while preserving every piece of content in `data.js` and the bilingual EN/FR toggle.

**Architecture:** Pure HTML / embedded CSS / vanilla JS edits matching the project's existing single-file-per-page pattern. One additive change to `data.js` for new H2 strings; no shape change. Inter added as the primary font, JetBrains Mono kept as a code/data accent.

**Tech Stack:** HTML, embedded CSS (via `<style>` blocks), vanilla JS, Google Fonts (Inter + JetBrains Mono). No build step, no test framework — verification is "open in browser, check it."

**DOM construction:** all JS that injects content into the DOM uses `createElement` + `textContent` + `appendChild`. Never `innerHTML = '<...>'` with interpolated strings, even when the strings come from the trusted `data.js`.

**Reference:** `docs/superpowers/specs/2026-05-16-engineering-elegant-redesign-design.md` — palette tokens, motion language, page-by-page detail.

---

## File map

- **`data.js`** — additive only. New `section_heading_*` keys under `ui.en` and `ui.fr`.
- **`index.html`** — full visual rewrite of the embedded `<style>` block + body markup. Preserve verbatim: head-of-document theme bootstrap (with `js` class + `__fadeRescueId` rescue), IntersectionObserver fade-in setup, EN/FR toggle handlers, `data.js` + `render.js` consumption, JSON-LD injection point.
- **`resume/index.html`** — full visual rewrite of the embedded `<style>` block + body markup. Preserve verbatim: Turnstile widget config, `?pdf=1` skip path, `data-render-complete` sentinel logic (including the image-load barrier), PDF download button + error states, FR copy.
- **`404.html`** — full visual rewrite. Preserve theme toggle and the localStorage FR-language-restore block.
- **`render.js`** — no changes expected.

## Setup (do once before Task 1)

- [ ] Confirm you're on the `claude/iris-redesign` branch:

  ```sh
  git branch --show-current
  # → claude/iris-redesign
  ```

- [ ] Local preview workflow: either `npm install && npm run dev`, or open the HTML files directly via `file://` (the PDF endpoint won't work that way, but you can defer that to Task 12).

- [ ] Keep `data.js` open in another tab — you'll reference it constantly for content guarantees.

---

## Task 1: Add new H2 string keys to `data.js`

**Files:**
- Modify: `data.js` — append keys to `ui.en` and `ui.fr` (around lines 254-289).

- [ ] **Step 1: Add the EN keys**

In the `ui.en` block, after `contact_title:`, add:

```js
        section_heading_about: "Building end-to-end, from connected device to backend.",
        section_heading_skills: "What I work with",
        section_heading_exp: "Selected work",
        section_heading_edu: "Studied at",
        section_heading_lang: "Spoken tongues",
        section_heading_interests: "Off-keyboard",
        section_heading_contact: "Let's connect",
```

- [ ] **Step 2: Add the FR keys**

In the `ui.fr` block, after `contact_title:`, add:

```js
        section_heading_about: "Construire de bout en bout, du capteur au backend.",
        section_heading_skills: "Ce avec quoi je travaille",
        section_heading_exp: "Sélection de réalisations",
        section_heading_edu: "Parcours académique",
        section_heading_lang: "Langues parlées",
        section_heading_interests: "Hors-clavier",
        section_heading_contact: "Restons en contact",
```

- [ ] **Step 3: Verify it parses and the keys exist**

  ```sh
  node -e "var w={}; require('vm').runInNewContext(require('fs').readFileSync('data.js','utf8'), { window: w }); console.log(Object.keys(w.RESUME_DATA.ui.en).filter(k => k.startsWith('section_heading_')).length)"
  ```

  Expected: `7`.

- [ ] **Step 4: Commit**

  ```sh
  git add data.js
  git commit -m "Add section H2 strings (EN/FR) for the Iris redesign"
  ```

---

## Task 2: Rewrite `index.html` `<head>` — fonts and theme bootstrap

**Files:**
- Modify: `index.html` (head block, lines 1-95 roughly)

- [ ] **Step 1: Add Inter to the font preloads**

Find the `<link id="font-jbmono" ...>` line. Insert immediately before it:

```html
<link id="font-inter" rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" />
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" /></noscript>
<script>document.getElementById('font-inter').rel='stylesheet';</script>
```

Keep the JBM preload — still needed for accent text.

- [ ] **Step 2: Update theme-color constants in the bootstrap script**

In the first `<script>` block at the top of `<head>`, change:

```js
var THEME_COLOR_LIGHT = '#eef0f7';
var THEME_COLOR_DARK  = '#1a1a2e';
```

to:

```js
var THEME_COLOR_LIGHT = '#fbfaff';
var THEME_COLOR_DARK  = '#0c0a14';
```

The rest of the bootstrap (the `js` class add, saved-theme read, `window.__setThemeColor` global, `__fadeRescueId` 4-second rescue setTimeout) stays exactly as written.

- [ ] **Step 3: Update the static `<meta name="theme-color">`**

```html
<meta name="theme-color" content="#0c0a14" />
```

- [ ] **Step 4: Verify in browser**

Open `index.html`. DevTools → Network: both Inter and JetBrains Mono `.css` files load. DevTools → Elements: `<meta name="theme-color">` reads `#0c0a14`. Page styling is broken (next tasks fix that) — that's OK.

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Preload Inter + update Iris theme-color constants on index"
  ```

---

## Task 3: Rewrite `index.html` `<style>` block — base tokens & typography

**Files:**
- Modify: `index.html` (style block opens around line 94)

- [ ] **Step 1: Replace the `:root` blocks**

Find the existing `:root` and `:root.light` (or media-query light) declarations near the top of `<style>`. Replace them with:

```css
:root {
    /* Iris — dark (default) */
    --bg-page: #0c0a14;
    --bg-elev: rgba(255, 255, 255, 0.03);
    --bg-elev-strong: rgba(255, 255, 255, 0.06);
    --border: rgba(255, 255, 255, 0.06);
    --border-strong: rgba(255, 255, 255, 0.10);
    --text-primary: #efe9f5;
    --text-secondary: rgba(239, 233, 245, 0.75);
    --text-muted: rgba(239, 233, 245, 0.50);
    --accent-1: #b964ff;
    --accent-2: #d98cff;
    --accent-3: #ff8cb3;
    --accent-soft: rgba(217, 140, 255, 0.10);
    --accent-border: rgba(217, 140, 255, 0.30);
    --status-ok: #a8e892;
    --shadow-soft: 0 8px 28px rgba(185, 100, 255, 0.18);
    --shadow-glow: 0 8px 24px rgba(185, 100, 255, 0.25);
    --gradient-text: linear-gradient(90deg, var(--accent-2), var(--accent-3));
    --gradient-button: linear-gradient(180deg, var(--accent-1), #a04ce6);
    --gradient-mesh: radial-gradient(ellipse at 70% 20%, rgba(217, 108, 255, 0.28), transparent 55%),
                     radial-gradient(ellipse at 20% 50%, rgba(255, 118, 180, 0.22), transparent 55%);
    color-scheme: dark light;
}

:root.light {
    --bg-page: #fbfaff;
    --bg-elev: rgba(26, 23, 38, 0.03);
    --bg-elev-strong: rgba(26, 23, 38, 0.06);
    --border: rgba(26, 23, 38, 0.08);
    --border-strong: rgba(26, 23, 38, 0.12);
    --text-primary: #1a1726;
    --text-secondary: #5f5a6e;
    --text-muted: #8c879a;
    --accent-1: #8e3dd1;
    --accent-2: #a14de3;
    --accent-3: #c84686;
    --accent-soft: rgba(142, 61, 209, 0.08);
    --accent-border: rgba(142, 61, 209, 0.25);
    --status-ok: #4ea863;
    --shadow-soft: 0 6px 18px rgba(120, 80, 170, 0.14);
    --shadow-glow: 0 6px 18px rgba(120, 80, 170, 0.20);
    --gradient-text: linear-gradient(90deg, var(--accent-1), var(--accent-3));
    --gradient-button: linear-gradient(180deg, var(--accent-1), #7530b0);
    --gradient-mesh: radial-gradient(ellipse at 70% 20%, rgba(142, 61, 209, 0.10), transparent 55%),
                     radial-gradient(ellipse at 20% 50%, rgba(200, 70, 134, 0.08), transparent 55%);
}
```

- [ ] **Step 2: Replace the base body / typography rules**

Find the existing `body { ... }` and the typography rules just below it. Replace with:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body { background: var(--bg-page); color: var(--text-primary); }

body {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
}

a { color: inherit; text-decoration: none; }
a:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 3px; border-radius: 4px; }

h1, h2, h3 { font-weight: 600; letter-spacing: -0.025em; line-height: 1.15; }
h1 { font-size: 3rem; letter-spacing: -0.035em; line-height: 1.0; }
h2 { font-size: 1.8rem; }
h3 { font-size: 1.05rem; }

.accent {
    background: var(--gradient-text);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: var(--accent-2);
}

.section-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-muted);
    font-family: "JetBrains Mono", ui-monospace, monospace;
    margin-bottom: 8px;
}

.container { max-width: 880px; margin: 0 auto; padding: 0 24px; }

.sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); clip-path: inset(50%); white-space: nowrap; border: 0;
}

.skip-link {
    position: absolute; top: -100%; left: 0;
    background: var(--accent-1); color: #fff;
    padding: 12px 20px; font-weight: 600; z-index: 200;
    text-decoration: none; border-radius: 0 0 8px 0;
}
.skip-link:focus { top: 0; }

@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }
}
```

- [ ] **Step 3: Open `index.html` in a browser**

Expected: dark Iris background, Inter font. Page broken (no section styles yet). Toggle theme via existing button → background swaps to light Iris.

- [ ] **Step 4: Commit**

  ```sh
  git add index.html
  git commit -m "Establish Iris palette + base typography on index"
  ```

---

## Task 4: `index.html` — top bar (theme + language toggle)

**Files:**
- Modify: `index.html` — append CSS in `<style>` block; new markup at the start of `<body>`

- [ ] **Step 1: Append top bar CSS**

```css
.topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 0;
    background: var(--bg-page);
}

.topbar .chip {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 100px;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    transition: background 200ms cubic-bezier(0.22, 1, 0.36, 1),
                border-color 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.topbar .chip:hover { background: var(--bg-elev-strong); border-color: var(--border-strong); }
.topbar .chip:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }

.theme-toggle { width: 38px; height: 38px; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
.theme-toggle svg { width: 1rem; height: 1rem; stroke: currentColor; fill: none; stroke-width: 1.75; }

.lang-toggle { display: inline-flex; padding: 0; height: 38px; overflow: hidden; }
.lang-toggle button {
    background: transparent;
    border: 0;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 500;
    padding: 0 14px;
    cursor: pointer;
    height: 100%;
}
.lang-toggle button[aria-current="true"] {
    background: var(--gradient-button);
    color: #fff;
    border-radius: 100px;
}
.lang-toggle button:focus-visible { outline: 2px solid var(--accent-2); outline-offset: -2px; }
```

- [ ] **Step 2: Replace / move the top bar markup**

Find the existing theme-toggle and lang-toggle controls (currently embedded in the hero region). Remove them from their current spot and insert this at the very start of `<body>`, after any skip link:

```html
<nav class="container topbar" aria-label="Page controls">
    <button id="theme-toggle" class="chip theme-toggle" type="button" aria-label="Toggle theme" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
    <div class="chip lang-toggle" role="group" aria-label="Language">
        <button type="button" data-lang="en" aria-current="true">EN</button>
        <button type="button" data-lang="fr" aria-current="false">FR</button>
    </div>
</nav>
```

The IDs / data-attributes match what the existing theme + language handlers select on (`#theme-toggle`, `[data-lang]`). Cross-check the existing handler code near the bottom of `index.html` — either keep these selectors or update both in tandem.

- [ ] **Step 3: Verify**

Click theme toggle → page swaps light/dark. Click FR → `localStorage.lang` should now be `"fr"` (verify in DevTools console: `localStorage.getItem('lang')`).

- [ ] **Step 4: Commit**

  ```sh
  git add index.html
  git commit -m "Add sticky top bar with theme + EN/FR controls on index"
  ```

---

## Task 5: `index.html` — hero section

**Files:**
- Modify: `index.html` — append CSS; replace hero markup; update the render IIFE

- [ ] **Step 1: Append hero CSS**

```css
.hero {
    position: relative;
    text-align: center;
    padding: 48px 0 64px;
    overflow: hidden;
}
.hero::before {
    content: "";
    position: absolute;
    inset: -10% -10% 30% -10%;
    background: var(--gradient-mesh);
    filter: blur(60px);
    pointer-events: none;
    z-index: 0;
}
.hero > * { position: relative; z-index: 1; }

.hero-photo {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
    margin: 0 auto 18px;
    border: 2px solid var(--border-strong);
    box-shadow: var(--shadow-soft);
}

.eyebrow {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-muted);
    margin-bottom: 12px;
}

.hero h1 { margin-bottom: 14px; }
.hero .role { font-size: 1.05rem; color: var(--text-secondary); margin-bottom: 22px; }

.status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 12px;
    border: 1px solid var(--accent-border);
    background: var(--accent-soft);
    border-radius: 100px;
    font-size: 0.78rem;
    color: var(--accent-2);
    margin-bottom: 26px;
}
.status .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--status-ok);
    box-shadow: 0 0 8px var(--status-ok);
}

.actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

.btn {
    padding: 11px 20px;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.86rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
                background 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.btn-primary {
    background: var(--gradient-button);
    color: #fff;
    border-color: var(--border-strong);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset, var(--shadow-glow);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 12px 28px rgba(185, 100, 255, 0.30); }
.btn-secondary {
    background: var(--bg-elev);
    color: var(--text-primary);
    border-color: var(--border-strong);
}
.btn-secondary:hover { background: var(--bg-elev-strong); }
.btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }
```

- [ ] **Step 2: Replace the hero markup**

The H1's name + last-name structure is static markup with a `<span class="accent">` — that's hardcoded, no JS interpolation, no XSS concern.

```html
<header class="container hero">
    <img src="/resume/photo.png" alt="Simon Brunou" class="hero-photo" width="96" height="96" loading="eager" />
    <div class="eyebrow" id="hero-eyebrow"></div>
    <h1>Simon <span class="accent">Brunou</span></h1>
    <div class="role" id="hero-role"></div>
    <div class="status" id="hero-status" hidden>
        <span class="dot" aria-hidden="true"></span>
        <span id="hero-status-label"></span>
    </div>
    <div class="actions">
        <a class="btn btn-primary" href="#contact" id="hero-cta"></a>
        <a class="btn btn-secondary" href="/resume/" id="hero-resume-link"></a>
    </div>
</header>
```

- [ ] **Step 3: Wire `data.js` content into the hero — `textContent` only**

In the existing render IIFE (the block that already runs after data.js + render.js load), add (or update existing equivalents):

```js
var D = window.RESUME_DATA;
var lang = (localStorage.getItem('lang') === 'fr') ? 'fr' : 'en';
var pick = window.SBRender.pickLang;

document.getElementById('hero-eyebrow').textContent = pick(D.personal.location, lang);
document.getElementById('hero-role').textContent = pick(D.title, lang);
document.getElementById('hero-cta').textContent = D.ui[lang].cta + ' →';
document.getElementById('hero-resume-link').textContent = D.ui[lang].resume_link;

if (D.availability && D.availability.open) {
    document.getElementById('hero-status-label').textContent = pick(D.availability.label, lang);
    document.getElementById('hero-status').hidden = false;
}
```

- [ ] **Step 4: Verify visually**

Photo, eyebrow, name (last name gradient), role, status pill, two CTAs. Hover primary → subtle lift. Tab through controls → focus rings.

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Rebuild hero on index in the Iris language"
  ```

---

## Task 6: `index.html` — About section

**Files:**
- Modify: `index.html` — append CSS; replace About markup; extend render IIFE

The About H2 is plain (no gradient on a substring). Hierarchy comes from the eyebrow + size + weight; no decorative text effect needed.

- [ ] **Step 1: Append section + about CSS**

```css
.section { padding: 56px 0 0; }
.section h2 { margin: 0 0 24px; font-size: 1.8rem; font-weight: 600; }

.about p {
    font-size: 1.05rem;
    line-height: 1.65;
    color: var(--text-secondary);
    max-width: 640px;
}
```

- [ ] **Step 2: Replace About markup**

```html
<section class="container section about" id="about" aria-labelledby="about-heading">
    <div class="section-label" id="about-eyebrow"></div>
    <h2 id="about-heading"></h2>
    <p id="about-text"></p>
</section>
```

- [ ] **Step 3: Wire content (textContent only)**

```js
document.getElementById('about-eyebrow').textContent = D.ui[lang].about_title;
document.getElementById('about-heading').textContent = D.ui[lang].section_heading_about;
document.getElementById('about-text').textContent = pick(D.about, lang);
```

- [ ] **Step 4: Verify**

Eyebrow ("About" / "À propos"), heading (the long descriptive sentence from data.js), paragraph (full about copy). Toggle EN/FR → all three update.

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Rebuild About section on index"
  ```

---

## Task 7: `index.html` — Skills section

**Files:**
- Modify: `index.html` — append CSS; replace Skills markup; extend render IIFE

- [ ] **Step 1: Append skills CSS**

```css
.skills-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 22px;
    margin-top: 6px;
}
@media (max-width: 960px) { .skills-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .skills-grid { grid-template-columns: 1fr; } }

.skill-cat {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px 18px 16px;
}
.skill-cat-label {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    margin-bottom: 12px;
}

.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-skill {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.78rem;
    padding: 4px 10px;
    border-radius: 100px;
    background: var(--accent-soft);
    border: 1px solid var(--accent-border);
    color: var(--accent-2);
    line-height: 1.4;
}
```

- [ ] **Step 2: Replace Skills markup**

```html
<section class="container section skills" id="skills" aria-labelledby="skills-heading">
    <div class="section-label" id="skills-eyebrow"></div>
    <h2 id="skills-heading"></h2>
    <div class="skills-grid" id="skills-grid"></div>
</section>
```

- [ ] **Step 3: Render all skills — DOM construction only**

```js
document.getElementById('skills-eyebrow').textContent = D.ui[lang].skills_title;
document.getElementById('skills-heading').textContent = D.ui[lang].section_heading_skills;

var grid = document.getElementById('skills-grid');
grid.textContent = '';
['languages', 'frameworks', 'tools'].forEach(function (cat) {
    var card = document.createElement('div');
    card.className = 'skill-cat';

    var label = document.createElement('div');
    label.className = 'skill-cat-label';
    label.textContent = '// ' + pick(D.skillCategoryLabels[cat], lang).toLowerCase();
    card.appendChild(label);

    var chips = document.createElement('div');
    chips.className = 'chips';
    D.skills[cat].forEach(function (s) {
        var c = document.createElement('span');
        c.className = 'chip-skill';
        c.textContent = s;
        chips.appendChild(c);
    });
    card.appendChild(chips);

    grid.appendChild(card);
});
```

- [ ] **Step 4: Verify counts**

Expect exactly **9 languages**, **9 frameworks**, **6 tools** (24 chips total). DevTools console: `document.querySelectorAll('#skills-grid .chip-skill').length` → `24`.

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Rebuild Skills section on index"
  ```

---

## Task 8: `index.html` — Experience timeline

**Files:**
- Modify: `index.html` — append CSS; replace Experience markup; extend render IIFE

- [ ] **Step 1: Append timeline CSS**

```css
.timeline { position: relative; padding-left: 28px; margin-top: 8px; }
.timeline::before {
    content: "";
    position: absolute;
    left: 5px;
    top: 6px;
    bottom: 12px;
    width: 1px;
    background: linear-gradient(180deg, var(--accent-border), transparent);
}

.tl-item { position: relative; padding-bottom: 32px; }
.tl-item::before {
    content: "";
    position: absolute;
    left: -28px;
    top: 8px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--bg-page);
    border: 2px solid var(--accent-2);
    box-shadow: 0 0 0 4px var(--accent-soft);
}

.tl-meta {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.78rem;
    color: var(--accent-2);
    margin-bottom: 4px;
}

.tl-item h3 { font-size: 1.05rem; font-weight: 600; margin: 0 0 4px; }
.tl-company { font-size: 0.92rem; color: var(--text-secondary); margin-bottom: 10px; }
.tl-item ul { padding-left: 18px; margin: 0; color: var(--text-secondary); }
.tl-item li { font-size: 0.95rem; line-height: 1.55; margin-bottom: 4px; }
```

- [ ] **Step 2: Replace Experience markup**

```html
<section class="container section experience" id="experience" aria-labelledby="experience-heading">
    <div class="section-label" id="experience-eyebrow"></div>
    <h2 id="experience-heading"></h2>
    <div class="timeline" id="experience-timeline"></div>
</section>
```

- [ ] **Step 3: Render all experience entries — DOM construction only**

```js
document.getElementById('experience-eyebrow').textContent = D.ui[lang].exp_title;
document.getElementById('experience-heading').textContent = D.ui[lang].section_heading_exp;

var tl = document.getElementById('experience-timeline');
tl.textContent = '';
D.experience.forEach(function (exp) {
    var item = document.createElement('div');
    item.className = 'tl-item';

    var meta = document.createElement('div');
    meta.className = 'tl-meta';
    meta.textContent = pick(exp.period, lang);
    item.appendChild(meta);

    var role = document.createElement('h3');
    role.textContent = pick(exp.role, lang);
    item.appendChild(role);

    var co = document.createElement('div');
    co.className = 'tl-company';
    co.textContent = pick(exp.company, lang);
    item.appendChild(co);

    var ul = document.createElement('ul');
    pick(exp.description, lang).forEach(function (b) {
        var li = document.createElement('li');
        li.textContent = b;
        ul.appendChild(li);
    });
    item.appendChild(ul);

    tl.appendChild(item);
});
```

- [ ] **Step 4: Verify all entries**

```js
document.querySelectorAll('.tl-item').length      // → 4
document.querySelectorAll('.tl-item:nth-child(2) li').length  // → 10
```

Toggle EN/FR: all bullets re-render.

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Rebuild Experience timeline on index"
  ```

---

## Task 9: `index.html` — Education, Languages, Interests

**Files:**
- Modify: `index.html` — append CSS; replace three section markups; extend render IIFE

- [ ] **Step 1: Append CSS for all three sections**

```css
.edu-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-top: 6px;
}
@media (max-width: 640px) { .edu-grid { grid-template-columns: 1fr; } }
.edu-card {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
}
.edu-card .degree { font-weight: 600; font-size: 0.96rem; margin-bottom: 4px; }
.edu-card .school { font-size: 0.86rem; color: var(--text-secondary); }
.edu-card .year { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.78rem; color: var(--accent-2); margin-top: 8px; }

.lang-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 6px;
}
@media (max-width: 640px) { .lang-grid { grid-template-columns: 1fr; } }
.lang-card {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
}
.lang-card .name { font-weight: 600; font-size: 0.96rem; }
.lang-card .level { font-size: 0.82rem; color: var(--text-muted); margin-top: 2px; }
.lang-card .level::before {
    content: "";
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent-2);
    margin-right: 7px;
    vertical-align: middle;
    opacity: 0.7;
}

.interests-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.interest {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 100px;
    font-size: 0.88rem;
    transition: border-color 180ms, background 180ms;
}
.interest:hover { border-color: var(--accent-border); background: var(--bg-elev-strong); }
```

- [ ] **Step 2: Replace the three section markups**

```html
<section class="container section education" id="education" aria-labelledby="education-heading">
    <div class="section-label" id="education-eyebrow"></div>
    <h2 id="education-heading"></h2>
    <div class="edu-grid" id="education-grid"></div>
</section>

<section class="container section languages" id="languages" aria-labelledby="languages-heading">
    <div class="section-label" id="languages-eyebrow"></div>
    <h2 id="languages-heading"></h2>
    <div class="lang-grid" id="languages-grid"></div>
</section>

<section class="container section interests" id="interests" aria-labelledby="interests-heading">
    <div class="section-label" id="interests-eyebrow"></div>
    <h2 id="interests-heading"></h2>
    <div class="interests-row" id="interests-row"></div>
</section>
```

- [ ] **Step 3: Render content — DOM construction only**

```js
// Helper to build a simple .name + .meta card (used by edu and languages)
function buildSimpleCard(className, nameText, metaText, metaClass) {
    var card = document.createElement('div');
    card.className = className;
    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = nameText;
    card.appendChild(name);
    var meta = document.createElement('div');
    meta.className = metaClass;
    meta.textContent = metaText;
    card.appendChild(meta);
    return card;
}

// Education
document.getElementById('education-eyebrow').textContent = D.ui[lang].edu_title;
document.getElementById('education-heading').textContent = D.ui[lang].section_heading_edu;
var eduGrid = document.getElementById('education-grid');
eduGrid.textContent = '';
D.education.forEach(function (e) {
    var card = document.createElement('div');
    card.className = 'edu-card';

    var degree = document.createElement('div');
    degree.className = 'degree';
    degree.textContent = pick(e.degree, lang);
    card.appendChild(degree);

    var school = document.createElement('div');
    school.className = 'school';
    school.textContent = e.school;
    card.appendChild(school);

    var year = document.createElement('div');
    year.className = 'year';
    year.textContent = e.startYear + ' — ' + e.endYear;
    card.appendChild(year);

    eduGrid.appendChild(card);
});

// Languages
document.getElementById('languages-eyebrow').textContent = D.ui[lang].lang_title;
document.getElementById('languages-heading').textContent = D.ui[lang].section_heading_lang;
var langGrid = document.getElementById('languages-grid');
langGrid.textContent = '';
D.languages.forEach(function (l) {
    langGrid.appendChild(buildSimpleCard('lang-card', pick(l.name, lang), pick(l.level, lang), 'level'));
});

// Interests
document.getElementById('interests-eyebrow').textContent = D.ui[lang].interests_title;
document.getElementById('interests-heading').textContent = D.ui[lang].section_heading_interests;
var iRow = document.getElementById('interests-row');
iRow.textContent = '';
D.interests.forEach(function (i) {
    var s = document.createElement('span');
    s.className = 'interest';
    s.textContent = i.emoji + ' ' + pick(i.label, lang);
    iRow.appendChild(s);
});
```

- [ ] **Step 4: Verify counts**

3 education cards, 3 language cards, 4 interest chips. EN/FR toggle re-renders everything.

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Rebuild Education, Languages, Interests sections on index"
  ```

---

## Task 10: `index.html` — Contact + Footer

**Files:**
- Modify: `index.html` — append CSS; replace Contact + Footer markup; extend render IIFE

The contact H2 uses the gradient on the whole heading (single decorative phrase, no substring weirdness).

- [ ] **Step 1: Append Contact + Footer CSS**

```css
.contact-card {
    background: linear-gradient(135deg, var(--accent-soft), rgba(255, 118, 180, 0.06));
    border: 1px solid var(--accent-border);
    border-radius: 18px;
    padding: 32px 28px;
    text-align: center;
    margin-top: 8px;
}
.contact-card h2 { margin-bottom: 8px; }
.contact-card p { color: var(--text-secondary); font-size: 1rem; max-width: 460px; margin: 0 auto 20px; }
.contact-links { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.contact-link {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.86rem;
    padding: 8px 14px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--bg-elev);
    color: var(--text-primary);
    transition: border-color 180ms, background 180ms;
}
.contact-link:hover { border-color: var(--accent-border); background: var(--bg-elev-strong); }

.site-footer {
    margin-top: 80px;
    padding: 18px 0 32px;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 0.82rem;
    text-align: center;
}
```

- [ ] **Step 2: Replace Contact + Footer markup**

The `<h2>` has a hardcoded `<span class="accent">` wrapper — text content gets set via `textContent` on the span. No JS HTML construction.

```html
<section class="container section contact" id="contact" aria-labelledby="contact-heading">
    <div class="contact-card">
        <div class="section-label" id="contact-eyebrow"></div>
        <h2 id="contact-heading"><span class="accent" id="contact-heading-text"></span></h2>
        <p id="contact-text"></p>
        <div class="contact-links" id="contact-links"></div>
    </div>
</section>

<footer class="container site-footer">
    <p id="footer-text"></p>
</footer>
```

- [ ] **Step 3: Wire content — DOM construction only**

```js
document.getElementById('contact-eyebrow').textContent = D.ui[lang].contact_title;
document.getElementById('contact-heading-text').textContent = D.ui[lang].section_heading_contact;
document.getElementById('contact-text').textContent = D.ui[lang].contact_text;

var cLinks = document.getElementById('contact-links');
cLinks.textContent = '';
[
    { href: 'mailto:' + D.personal.email, label: D.personal.email, external: false },
    { href: D.personal.githubUrl, label: D.personal.githubDisplay, external: true },
    { href: D.personal.linkedinUrl, label: D.personal.linkedinDisplay, external: true },
].forEach(function (l) {
    var a = document.createElement('a');
    a.className = 'contact-link';
    a.href = l.href;
    a.textContent = l.label;
    if (l.external) { a.rel = 'me noopener'; a.target = '_blank'; }
    cLinks.appendChild(a);
});

document.getElementById('footer-text').textContent = D.ui[lang].footer;
```

- [ ] **Step 4: Verify**

Contact card with tinted gradient, three mono-font link chips, footer line. Clicking any link opens the right target.

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Rebuild Contact + Footer on index"
  ```

---

## Task 11: `index.html` — fade-in motion + toggle wiring against new markup

**Files:**
- Modify: `index.html` — the existing JS IIFE that owns IntersectionObserver and toggle handlers

The original site already has fade-in scroll reveals and a language toggle. Verify they work against the new markup; tighten where needed.

- [ ] **Step 1: Decide on fade-in target — choose Option A or B**

The existing observer code likely selects `.fade-in`. The new sections carry `class="container section X"`. Pick one:

- **Option A (preserves observer code, minimal JS change):** add `fade-in` to each section's class list — change `class="container section about"` → `class="container section fade-in about"` everywhere (also on `.hero`). The bootstrap script's `.js .fade-in { opacity: 0 }` and the 4-second `__fadeRescueId` rescue continue to work.
- **Option B (cleaner, changes one JS line):** change the observer's `document.querySelectorAll('.fade-in')` to `document.querySelectorAll('.section, .hero')`.

Pick one and apply.

- [ ] **Step 2: Make the EN/FR toggle re-render live (no reload)**

Wrap the per-language render code from Tasks 5-10 in a single `function render(lang) { ... }`. Call it twice:

```js
// On initial load
var initialLang = (localStorage.getItem('lang') === 'fr') ? 'fr' : 'en';
render(initialLang);
syncLangButtons(initialLang);

// On language button click
document.querySelectorAll('.lang-toggle button[data-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var newLang = btn.getAttribute('data-lang');
        try { localStorage.setItem('lang', newLang); } catch (_) {}
        document.documentElement.lang = newLang;
        syncLangButtons(newLang);
        render(newLang);
    });
});

function syncLangButtons(activeLang) {
    document.querySelectorAll('.lang-toggle button[data-lang]').forEach(function (b) {
        b.setAttribute('aria-current', b.getAttribute('data-lang') === activeLang ? 'true' : 'false');
    });
}
```

- [ ] **Step 3: Verify theme toggle still works**

Click theme button → root gains `.light`, all variables swap, `meta[name=theme-color]` updates to `#fbfaff`.

- [ ] **Step 4: Verify reduced motion**

DevTools → Rendering → emulate `prefers-reduced-motion: reduce`. Reload. Sections appear visible immediately (no fade-in).

- [ ] **Step 5: Commit**

  ```sh
  git add index.html
  git commit -m "Wire fade-in + toggle handlers against new markup"
  ```

---

## Task 12: `resume/index.html` — full visual rewrite

**Files:**
- Modify: `resume/index.html` — replace `<style>`, replace header + sections, preserve Turnstile + PDF-download JS verbatim.

The résumé is **light-by-default** (document register). Same Iris hue family in light tones; no theme variant. PDF render pipeline unchanged.

- [ ] **Step 1: Replace `:root` + base CSS**

Replace the existing `:root` and any dark-mode block with:

```css
:root {
    --bg-page: #fbfaff;
    --bg-card: #ffffff;
    --text-primary: #1a1726;
    --text-secondary: #5f5a6e;
    --text-muted: #8c879a;
    --accent-1: #8e3dd1;
    --accent-2: #a14de3;
    --accent-3: #c84686;
    --accent-soft: rgba(142, 61, 209, 0.08);
    --accent-border: rgba(142, 61, 209, 0.22);
    --border: rgba(26, 23, 38, 0.08);
    --photo-shadow: 0 6px 18px rgba(120, 80, 170, 0.18);
    --gradient-text: linear-gradient(90deg, var(--accent-1), var(--accent-3));
    color-scheme: light;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.55;
    color: var(--text-primary);
    background: var(--bg-page);
    -webkit-font-smoothing: antialiased;
}

.container {
    max-width: 820px;
    margin: 40px auto;
    background: var(--bg-card);
    box-shadow: 0 1px 2px rgba(26, 23, 38, 0.04), 0 10px 30px rgba(26, 23, 38, 0.06);
    border-radius: 16px;
    overflow: hidden;
}

@media print {
    body { background: #fff; }
    .container { margin: 0; box-shadow: none; border-radius: 0; max-width: none; }
}
```

(Drop any `@media (prefers-color-scheme: dark)` variant — the résumé stays light always.)

- [ ] **Step 2: Replace header CSS + markup**

CSS:

```css
.head {
    display: flex;
    gap: 28px;
    align-items: center;
    padding: 36px 40px 22px;
    border-bottom: 1px solid var(--border);
}
.head .photo {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #fff;
    box-shadow: var(--photo-shadow);
    flex-shrink: 0;
}
.head .name { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.head h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.025em; margin: 0; }
.head h1 .accent {
    background: var(--gradient-text);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: var(--accent-1);
}
.head .role { font-size: 0.95rem; color: var(--text-secondary); margin-top: 4px; }
.head .contact-line {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-top: 8px;
}
.head-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.head-action {
    background: var(--bg-page);
    border: 1px solid var(--border);
    color: var(--text-primary);
    height: 38px;
    padding: 0 14px;
    border-radius: 19px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 500;
}
.head-action.pdf-error { background: #fdebec; border-color: #f5b5b5; color: #b03333; }
@media print { .head-actions { display: none; } }
```

Markup:

```html
<header class="head">
    <img class="photo" src="photo.png" alt="Simon Brunou" width="88" height="88" />
    <div class="name">
        <h1>Simon <span class="accent">Brunou</span></h1>
        <div class="role" id="resume-role"></div>
        <div class="contact-line" id="resume-contact"></div>
    </div>
    <div class="head-actions">
        <a href="/" class="head-action">← Site</a>
        <button id="download-pdf" class="head-action" type="button">PDF</button>
    </div>
</header>
```

- [ ] **Step 3: Replace section CSS**

```css
.section { padding: 22px 40px; }
.section + .section { border-top: 1px solid var(--border); }
.section-h {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--accent-1);
    margin-bottom: 14px;
}
.section p { font-size: 0.92rem; color: var(--text-secondary); line-height: 1.55; }

.entry { padding: 8px 0; }
.entry + .entry { margin-top: 10px; }
.entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.entry-head .pos { font-weight: 600; font-size: 0.98rem; }
.entry-head .period { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.76rem; color: var(--accent-1); white-space: nowrap; }
.entry-company { font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 6px; }
.entry ul { padding-left: 18px; margin: 0; }
.entry li { font-size: 0.86rem; color: var(--text-primary); margin-bottom: 3px; line-height: 1.5; }

.skills-row { display: flex; flex-wrap: wrap; gap: 16px; }
.skills-group { min-width: 200px; flex: 1; }
.skills-group-label {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.74rem;
    color: var(--text-muted);
    margin-bottom: 6px;
}
.skills-list { font-size: 0.86rem; color: var(--text-primary); line-height: 1.5; }

.edu-row, .lang-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 640px) { .edu-row, .lang-row { grid-template-columns: 1fr; } }
.edu-item .name, .lang-item .name { font-weight: 600; font-size: 0.92rem; }
.edu-item .school, .lang-item .level { font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px; }
.edu-item .year { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 0.76rem; color: var(--accent-1); margin-top: 4px; }

.interests-list { display: flex; flex-wrap: wrap; gap: 6px; }
.interests-list .item { font-size: 0.86rem; padding: 4px 10px; background: var(--accent-soft); border: 1px solid var(--accent-border); border-radius: 100px; color: var(--text-primary); }
```

- [ ] **Step 4: Replace section markup**

```html
<section class="section">
    <div class="section-h">// profil</div>
    <p id="resume-about"></p>
</section>

<section class="section">
    <div class="section-h">// compétences</div>
    <div class="skills-row">
        <div class="skills-group"><div class="skills-group-label">// langages</div><div class="skills-list" id="resume-skills-languages"></div></div>
        <div class="skills-group"><div class="skills-group-label">// frameworks</div><div class="skills-list" id="resume-skills-frameworks"></div></div>
        <div class="skills-group"><div class="skills-group-label">// outils</div><div class="skills-list" id="resume-skills-tools"></div></div>
    </div>
</section>

<section class="section">
    <div class="section-h">// expérience</div>
    <div id="resume-experience"></div>
</section>

<section class="section">
    <div class="section-h">// formation</div>
    <div class="edu-row" id="resume-education"></div>
</section>

<section class="section">
    <div class="section-h">// langues</div>
    <div class="lang-row" id="resume-languages"></div>
</section>

<section class="section">
    <div class="section-h">// centres d'intérêt</div>
    <div class="interests-list" id="resume-interests"></div>
</section>
```

- [ ] **Step 5: Wire content — DOM construction only**

In the existing render IIFE (the one that fills the résumé from `D = window.RESUME_DATA`), replace the body of the rendering pass with this. The `// MUST stay:` block at the end is the image-load barrier + `data-render-complete` sentinel that the PDF render path waits for — keep it verbatim from your current resume code if it already exists:

```js
var D = window.RESUME_DATA;
var lang = 'fr';
var pick = window.SBRender.pickLang;

document.getElementById('resume-role').textContent = pick(D.title, lang);
document.getElementById('resume-contact').textContent =
    D.personal.email + ' · ' + pick(D.personal.phoneDisplay, lang) + ' · ' + D.personal.githubDisplay;

document.getElementById('resume-about').textContent = pick(D.about, lang);

document.getElementById('resume-skills-languages').textContent = D.skills.languages.join(', ');
document.getElementById('resume-skills-frameworks').textContent = D.skills.frameworks.join(', ');
document.getElementById('resume-skills-tools').textContent = D.skills.tools.join(', ');

var expBox = document.getElementById('resume-experience');
expBox.textContent = '';
D.experience.forEach(function (e) {
    var entry = document.createElement('div');
    entry.className = 'entry';

    var head = document.createElement('div');
    head.className = 'entry-head';
    var pos = document.createElement('div');
    pos.className = 'pos';
    pos.textContent = pick(e.role, lang);
    head.appendChild(pos);
    var period = document.createElement('div');
    period.className = 'period';
    period.textContent = pick(e.period, lang);
    head.appendChild(period);
    entry.appendChild(head);

    var company = document.createElement('div');
    company.className = 'entry-company';
    company.textContent = pick(e.company, lang);
    entry.appendChild(company);

    var ul = document.createElement('ul');
    pick(e.description, lang).forEach(function (b) {
        var li = document.createElement('li');
        li.textContent = b;
        ul.appendChild(li);
    });
    entry.appendChild(ul);

    expBox.appendChild(entry);
});

var edu = document.getElementById('resume-education');
edu.textContent = '';
D.education.forEach(function (ed) {
    var item = document.createElement('div');
    item.className = 'edu-item';
    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = pick(ed.degree, lang);
    item.appendChild(name);
    var school = document.createElement('div');
    school.className = 'school';
    school.textContent = ed.school;
    item.appendChild(school);
    var year = document.createElement('div');
    year.className = 'year';
    year.textContent = ed.startYear + ' — ' + ed.endYear;
    item.appendChild(year);
    edu.appendChild(item);
});

var langs = document.getElementById('resume-languages');
langs.textContent = '';
D.languages.forEach(function (l) {
    var item = document.createElement('div');
    item.className = 'lang-item';
    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = pick(l.name, lang);
    item.appendChild(name);
    var level = document.createElement('div');
    level.className = 'level';
    level.textContent = pick(l.level, lang);
    item.appendChild(level);
    langs.appendChild(item);
});

var ints = document.getElementById('resume-interests');
ints.textContent = '';
D.interests.forEach(function (i) {
    var s = document.createElement('span');
    s.className = 'item';
    s.textContent = i.emoji + ' ' + pick(i.label, lang);
    ints.appendChild(s);
});

// MUST stay verbatim: image-load barrier + data-render-complete sentinel.
// The PDF render path (Puppeteer) waits on html[data-render-complete] before
// snapshotting. Don't fire it before in-document images finish loading or the
// PDF can race past the profile photo.
var imgs = Array.prototype.slice.call(document.images);
Promise.all(imgs.map(function (img) {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(function (resolve) {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
    });
})).then(function () {
    document.documentElement.setAttribute('data-render-complete', '');
});
```

**Critical preservation:** the existing Turnstile widget `<script>` tag at the top of `<head>`, the `?pdf=1` skip block in the page IIFE (`if (new URLSearchParams(window.location.search).get("pdf")) return;`), and the `#download-pdf` click handler (the one that calls Turnstile then POSTs to `/resume/simon-brunou-cv.pdf`) all stay verbatim. The render block above produces the same `data-render-complete` sentinel the worker waits for.

- [ ] **Step 6: Verify on screen**

Open `/resume/`. Light Iris document — name with gradient last name, mono section headers, mono dates in purple. All 4 experience entries with full bullets, 3 education, 3 languages, all skills, all interests.

- [ ] **Step 7: Verify PDF render path still works**

  ```sh
  npm run dev
  # in another shell:
  curl -X POST http://localhost:3000/resume/simon-brunou-cv.pdf \
       -H "Origin: http://localhost:3000" \
       -H "Content-Type: application/json" \
       -d '{"token":"x"}'
  ```

  Expected: 403 (Turnstile rejects fake token) or 500 (no Turnstile key in dev) — either confirms the render pipeline reached siteverify. Real PDF generation happens via the Coolify preview deploy.

  When testing the real PDF (via the deployed preview): confirm full content, light background, Iris purple accents, all bullets present.

- [ ] **Step 8: Commit**

  ```sh
  git add resume/index.html
  git commit -m "Rebuild résumé page in light-Iris with print-coherent PDF render"
  ```

---

## Task 13: `404.html` — Iris dark error page

**Files:**
- Modify: `404.html` — `<style>` block + body markup; preserve theme toggle and the localStorage FR-language read.

- [ ] **Step 1: Replace `<style>` block**

```css
:root {
    --bg-page: #0c0a14;
    --text-primary: #efe9f5;
    --text-secondary: rgba(239, 233, 245, 0.75);
    --text-muted: rgba(239, 233, 245, 0.50);
    --accent-1: #b964ff;
    --accent-2: #d98cff;
    --accent-3: #ff8cb3;
    --border: rgba(255, 255, 255, 0.10);
    --gradient-text: linear-gradient(90deg, var(--accent-2), var(--accent-3));
    --gradient-button: linear-gradient(180deg, var(--accent-1), #a04ce6);
    --gradient-mesh: radial-gradient(circle at 50% 30%, rgba(217, 140, 255, 0.22), transparent 50%);
    color-scheme: dark light;
}

:root.light {
    --bg-page: #fbfaff;
    --text-primary: #1a1726;
    --text-secondary: #5f5a6e;
    --text-muted: #8c879a;
    --accent-1: #8e3dd1;
    --accent-2: #a14de3;
    --accent-3: #c84686;
    --border: rgba(26, 23, 38, 0.08);
    --gradient-text: linear-gradient(90deg, var(--accent-1), var(--accent-3));
    --gradient-button: linear-gradient(180deg, var(--accent-1), #7530b0);
    --gradient-mesh: radial-gradient(circle at 50% 30%, rgba(142, 61, 209, 0.12), transparent 55%);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg-page);
    color: var(--text-primary);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.topbar { display: flex; justify-content: flex-end; padding: 14px 24px; }
.theme-toggle {
    width: 38px; height: 38px;
    border-radius: 100px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}
.theme-toggle svg { width: 1rem; height: 1rem; stroke: currentColor; fill: none; stroke-width: 1.75; }

main {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 60px 24px;
    overflow: hidden;
}
main::before {
    content: "";
    position: absolute;
    inset: -20%;
    background: var(--gradient-mesh);
    filter: blur(40px);
    pointer-events: none;
}
main > * { position: relative; z-index: 1; }

.eyebrow {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-muted);
    margin-bottom: 16px;
}

.big {
    font-size: 6rem;
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 1;
    margin-bottom: 18px;
}
.big .accent {
    background: var(--gradient-text);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: var(--accent-2);
}

#message { font-size: 1.05rem; color: var(--text-secondary); max-width: 360px; margin: 0 auto 28px; }

.actions { display: flex; gap: 10px; justify-content: center; }
.btn {
    padding: 11px 20px;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.86rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
}
.btn-primary {
    background: var(--gradient-button);
    color: #fff;
    border: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset, 0 8px 24px rgba(185, 100, 255, 0.25);
}
.btn-secondary {
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-primary);
    border: 1px solid var(--border);
}
```

- [ ] **Step 2: Replace `<body>` content**

```html
<body>
    <nav class="topbar">
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle theme" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
    </nav>
    <main>
        <div class="eyebrow">Error</div>
        <div class="big">4<span class="accent">0</span>4</div>
        <p id="message">This page took a wrong turn somewhere in the Breton countryside.</p>
        <div class="actions">
            <a href="/" class="btn btn-primary" id="home-link">Back home →</a>
            <a href="/resume/" class="btn btn-secondary" id="resume-link">Resume</a>
        </div>
    </main>

    <script>
        // Copy the existing theme-toggle handler + the localStorage FR-language
        // restore block VERBATIM from the previous 404.html. After copy, update
        // the FR substitutions to:
        //   document.getElementById('message').textContent =
        //       "Cette page n'existe pas. Retour vers la Bretagne.";
        //   document.getElementById('home-link').textContent = "Accueil";
        //   document.getElementById('resume-link').textContent = "CV";
        //   toggleBtn.setAttribute('aria-label', 'Basculer le thème');
        // No other behavioural change.
    </script>
</body>
```

- [ ] **Step 3: Copy + adapt the existing JS handlers**

Open the current `404.html` on `main` and copy the contents of its last `<script>` block (theme toggle + FR-language restore) into the placeholder above. Update the FR text strings to the new copy as noted in the comment.

- [ ] **Step 4: Verify**

Open `404.html`. Big "404" with gradient on middle 0, gradient mesh background, two buttons. Click theme toggle → swaps. Set `localStorage.setItem('lang', 'fr')` in console, reload → FR copy ("Cette page n'existe pas…") appears.

- [ ] **Step 5: Commit**

  ```sh
  git add 404.html
  git commit -m "Rebuild 404 page in Iris language"
  ```

---

## Task 14: Final QA pass + PR

- [ ] **Step 1: Content audit against `data.js`**

Open `/` with FR active, verify each section:

- About: paragraph matches `D.about.fr` verbatim
- Skills: 9 chips in languages, 9 in frameworks, 6 in tools = 24 total
- Experience: 4 timeline entries; bullet counts per entry from `data.js` (2, 10, 4, 2 for FR)
- Education: 3 cards
- Languages: 3 cards
- Interests: 4 chips

Toggle to EN: same counts, content swaps. Run quick:

```js
document.querySelectorAll('.chip-skill').length     // 24
document.querySelectorAll('.tl-item').length        // 4
document.querySelectorAll('.edu-card').length       // 3
document.querySelectorAll('.lang-card').length      // 3
document.querySelectorAll('.interest').length       // 4
```

- [ ] **Step 2: A11y spot check**

- Tab through homepage from top — focus ring visible at every interactive control.
- Skip link appears on first tab.
- All sections have `aria-labelledby` resolving to a real H2.
- DevTools → Rendering → emulate `prefers-reduced-motion: reduce` → reveals are instant.

- [ ] **Step 3: PDF render end-to-end**

If PR #37 (Coolify migration) is merged: push this branch, wait for Coolify to spin up a preview, click "PDF" on `/resume/`, verify the downloaded PDF.

If PR #37 isn't merged: rebase this branch onto `claude/coolify-migration` first, then test PDF on the Coolify preview.

PDF expectations: full content, light background, purple accents on name + section headers + dates, no missing entries or bullets.

- [ ] **Step 4: Push and open the PR**

  ```sh
  git push -u origin claude/iris-redesign
  gh pr create --title "Iris redesign: homepage, résumé, 404" --body "Implements docs/superpowers/specs/2026-05-16-engineering-elegant-redesign-design.md. Visual redesign only — data.js content preserved verbatim, bilingual EN/FR maintained, PDF render pipeline unchanged."
  ```

---

## Notes for the implementer

- **DRY:** the gradient text helper (`.accent` class with `background-clip: text`) is repeated in three files; that's fine — three separate stylesheets, no shared infrastructure.
- **YAGNI:** don't add features the spec doesn't list (no projects section, no animations beyond what's specified, no new dependencies).
- **Commits:** one per task is the right grain. Don't fragment further.
- **If a step's CSS conflicts with a leftover rule from the original style block:** delete the original rule. The redesign is a full replacement.
- **Order matters:** Task 1 (data.js keys) before any HTML that reads new keys; Task 3 (CSS variables) before any section using them.
- **DOM construction discipline:** every interpolation of `data.js` content uses `createElement` + `textContent`. The only `<span class="accent">` wrappers are hardcoded in static HTML — they never get JS-built from interpolated strings.
- **Spec is design intent. `data.js` is content. Don't invent either.**
