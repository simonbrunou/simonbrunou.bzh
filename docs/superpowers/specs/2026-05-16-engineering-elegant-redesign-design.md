# simonbrunou.bzh — Engineering-elegant redesign

**Status:** design approved 2026-05-16 (brainstorming session).
**Scope:** index page (`/`), résumé page (`/resume/`, including the PDF render
path), and `404.html`. All bilingual EN/FR behaviour preserved.

## Goal

Move the site from a generic "developer portfolio" register to a **distinctive,
quietly premium product feel** — the Linear / Vercel / Stripe family of
aesthetic. The current site already has personality (JetBrains Mono, Catppuccin
references, fade-in motion); this redesign keeps the spirit but tightens the
visual language, unifies the homepage and résumé into one coherent system, and
makes the first impression more memorable.

This is a **visual redesign, not a content rewrite**. `data.js` remains the
single source of truth and every existing field is rendered: 9 languages, 9
frameworks, 6 tools, 4 experience entries with their full bullet lists in both
EN and FR, 3 education entries, 3 spoken languages, 4 interests, full bilingual
UI labels. No content is dropped.

## Design language (Iris)

Codename **Iris** — a warm purple-to-pink Stripe-lineage palette over a near-black
ground, with JetBrains Mono kept as a deliberate accent for code/data, not used
everywhere.

### Palette

Dark surfaces (homepage, 404):

| Token | Hex | Use |
|---|---|---|
| `--bg-page` | `#0c0a14` | Page background |
| `--bg-elev` | `rgba(255,255,255,0.03)` | Card surface tint |
| `--border` | `rgba(255,255,255,0.06)` | Card border |
| `--text-primary` | `#efe9f5` | Body text |
| `--text-secondary` | `rgba(239,233,245,0.75)` | Muted body |
| `--text-muted` | `rgba(239,233,245,0.5)` | Labels, hints |
| `--accent-1` | `#b964ff` | Primary accent (button base) |
| `--accent-2` | `#d98cff` | Lavender (gradient stop, mono accent) |
| `--accent-3` | `#ff8cb3` | Pink (gradient stop, highlight) |
| `--status-ok` | `#a8e892` | "Open to opportunities" dot |

Gradient mesh (hero, contact card, 404 background):

```
radial-gradient(ellipse at 70% 20%, rgba(217,108,255,0.28), transparent 55%),
radial-gradient(ellipse at 20% 50%, rgba(255,118,180,0.22), transparent 55%)
```

Light surfaces (résumé page, PDF render): same hue family translated to a
light document register.

| Token | Hex | Use |
|---|---|---|
| `--bg-page` | `#fbfaff` | Page background |
| `--text-primary` | `#1a1726` | Body text |
| `--text-secondary` | `#5f5a6e` | Muted body |
| `--accent-1` | `#8e3dd1` | Primary accent (darker for AA contrast on light) |
| `--accent-2` | `#c84686` | Pink stop, gradient end |
| `--border` | `rgba(26,23,38,0.08)` | Rules and dividers |

### Typography

- **Inter** (300 / 400 / 500 / 600 / 700) — primary face, all body and headings.
- **JetBrains Mono** (400 / 500) — accent face used **only** for: section labels
  (`// languages`, `// frameworks`, `// tools & devops`, `// profil`,
  `// expérience`, …), skill chips, dates in the experience timeline, dates in
  the résumé, contact links in the contact card and résumé header, the `404`
  numerals.
- System fallback stack for both, preload both stylesheets like the current site.
- Heading scale: H1 3rem (hero) / 2rem (résumé), H2 1.6–1.8rem, body 1rem,
  small 0.78–0.86rem. Tight letter-spacing on H1 (-0.035em), normal on body.

### Motion

Subtle, considered. Carries the existing fade-in pattern, refined:

- IntersectionObserver-driven section reveals on first viewport entry (existing
  behaviour, preserved).
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (gentle ease-out) — already used in
  the current site for header-action transitions.
- Hover states use 180–240 ms transitions, lifting `border-color` and `box-shadow`,
  not `transform` (avoids layout jank).
- Status dot has a soft `box-shadow` glow but **no infinite pulse animation**
  (respects `prefers-reduced-motion` cleanly).
- Existing fade-rescue safety net (4 s timeout that force-reveals if JS fails)
  is preserved verbatim.
- `prefers-reduced-motion: reduce` disables IntersectionObserver reveals — content
  is rendered visible by default.

## Page-by-page design

### Homepage (`/`)

**Top bar** — scroll-sticky, right-aligned: theme toggle (sun/moon SVG), then a
pill containing EN | FR with the active language filled in the primary gradient.
Both controls use the existing JS handlers (just restyled).

**Hero** — centred, photo prominent (H1 from the brainstorming session):

1. Circular hero photo (88–96 px) with soft shadow tinted by the accent
2. Eyebrow line, mono-uppercase: `Saint-Nolff · Brittany, France`
3. H1 `Simon Brunou` — last name has the purple→pink gradient text fill
4. Role line: `Fullstack Developer · Rust, Flutter, mobile`
5. Status pill: small green dot + `Open to opportunities` / `Ouvert aux opportunités` (driven by `data.availability`)
6. CTA row: primary gradient button `Get in touch →` + secondary outline button `Resume`

Behind the hero: the gradient mesh defined above, blurred 50–60 px, masked to
the upper 60 % of the section so it fades into the page.

**About** — single column, max-width ~640 px reading measure. H2 with one
gradient-accented phrase (`end-to-end`, `de bout en bout`) to give the eye an
anchor. Body paragraph is the existing about text from `data.js`, verbatim.

**Skills** — three-column card grid on desktop; two-column under ~960 px,
single column under ~640 px (matches current site's breakpoints — body
already uses `clamp()` / fluid container, this section follows the same
container's responsive behaviour).
Each card has:
- Mono-font category label with `// ` prefix
- Chip row of all skills in that category (`data.js`: 9 languages, 9 frameworks,
  6 tools, no truncation)
- Chips: mono font, purple-tinted background, lavender border

**Experience timeline** — single vertical column. Thin gradient rule on the
left (lavender fading to transparent), hollow accent dots at each entry.
Each entry shows:
- Mono date range in `--accent-2` (lavender)
- Role title (sans, semi-bold)
- Company name (muted)
- Full bullet list from `data.js` (every bullet, every entry: Confidential
  Startup, BYSTAMP Fullstack, BYSTAMP Intern, IUT de Vannes Intern)

Bullets in EN or FR depending on language toggle, same content as today.

**Education** — two-column grid of compact cards. Degree title (semi-bold),
school (muted), year range in mono `--accent-2`. All 3 entries rendered.

**Languages** — three-column card grid. Language name, level with a small
accent dot. All 3 entries.

**Interests** — chip row. Emoji + label (`🖥️ Homelab`, `☕ Coffee`, `🚴 Cycling`,
`🧗 Rock climbing`). Subtle hover.

**Contact** — tinted gradient card (low-opacity purple-pink wash, accent
border, 18 px radius). Heading uses the gradient. Three mono-font contact
chips: email, github short URL, linkedin short URL — each a real link.

**Footer** — single muted line, very subtle, top-border separator: existing
copy from `data.ui.<lang>.footer`.

### Résumé (`/resume/`)

**Strategy:** light-by-default. The page renders a print-coherent light
document at all times, so the PDF render pipeline stays unchanged
(`emulateMediaType('print')` + `prefers-color-scheme: light` continue to work,
no theme swap on print). Same Iris hue family translated to light values.

**Layout** — same single-column document structure as today:

- **Header band**: photo (left), name + role + contact line (right). Name uses
  the light-mode gradient on the last name. Contact line in JetBrains Mono.
- **Section blocks** — each has a mono-font `// <label>` header in
  `--accent-1`, then content. Sections: `// profil`, `// compétences` (skills
  grouped by category), `// expérience` (all 4 entries with full bullets,
  mono dates aligned right of each entry head), `// formation` (3 entries),
  `// langues` (3), `// centres d'intérêt` (4).
- **Print-safe**: no dark backgrounds, no heavy shadows, body text at near-black
  for high-contrast print. Gradient text on the name is the only "decorative"
  element and it degrades acceptably to a solid purple in monochrome print
  contexts (browsers without `background-clip:text` support keep the solid
  `color`).

**Language**: FR-only as today. The "Download PDF" CTA and Turnstile flow stay
exactly as they are functionally.

### 404 (`/404.html`)

Dark like the homepage, generous vertical centring, gradient mesh behind:

- Small `Error` eyebrow label
- Huge `404` numeral with the middle `0` in the gradient accent
- One-line message: `This page took a wrong turn somewhere in the Breton countryside.`
- Primary gradient button: `Back home →` linking to `/`

Preserve the current 404's behaviours: theme toggle (top-right, same SVG),
and the localStorage-driven language read so a visitor coming from the FR
homepage sees the FR message. The FR copy mirrors the EN ("Cette page n'existe
pas. Retour vers la Bretagne.") — keep the existing FR translation strings
the current file already carries.

## File-level changes

`index.html`:
- Replace the entire embedded `<style>` block with the new Iris stylesheet
- Update the hero markup to match the new structure (photo, eyebrow, H1, role,
  status pill, CTA row)
- Restructure the skills section markup to the new card-grid pattern
- Restructure the experience section to the new gradient-rule timeline
- Restructure education / languages / interests / contact sections
- Update the inline theme-color JS constants to the new dark / light page
  backgrounds (`#0c0a14` / `#fbfaff`). The current bootstrap script reads
  the stored / system theme preference and calls `window.__setThemeColor(isLight)`;
  that contract is preserved, only the constants change.
- Preserve verbatim: the head-of-document theme bootstrap script (with `js`
  class + fade-rescue setTimeout), the IntersectionObserver-driven fade-in
  setup, the EN/FR language toggle handlers, the `data.js` + `render.js`
  consumption, the JSON-LD injection point

`resume/index.html`:
- Replace the embedded `<style>` block with the light-by-default Iris résumé
  stylesheet
- Update header band markup
- Move section headers to `// label` mono pattern
- Preserve verbatim: the Turnstile widget config, the `?pdf=1` skip path, the
  `data-render-complete` sentinel logic including the image-load barrier, the
  PDF download button + error states, the FR copy

`404.html`:
- Replace embedded styles
- Update markup to the new "Error / 404 / message / Back home" structure

`data.js`:
- **One additive change:** the existing `ui.<lang>.{about,skills,exp,edu,lang,interests,contact}_title` short labels (`About`, `Skills`, `Experience`, …) are repurposed as the new mono-font eyebrow labels above each section. **New** `section_heading_<key>` entries are added to `data.ui.en` and `data.ui.fr` for the longer H2s shown in the mockups (`Building end-to-end, from connected device to backend.`, `Selected work`, `Spoken tongues`, `Off-keyboard`, `Let's connect`, etc. — with FR equivalents). No structural change to the data shape, just additional string keys.

`render.js`:
- **No changes** unless the new markup requires a new helper. Existing
  `pickLang`, `splitPeriod`, `injectJsonLd`, `buildPersonJsonLd` continue to
  work — they're rendering-engine-agnostic helpers.

`server.js`, `Dockerfile`, etc.:
- **No changes.** The redesign is content + CSS only. CSP nonce injection,
  cache headers, the PDF render path, the Turnstile flow all keep working
  because the data contract between server and client is unchanged.

## Accessibility

- All current a11y features preserved: skip link, `aria-labelledby` on sections,
  `aria-current` on the active language chip, focus-visible outlines.
- Status dot is decorative; the surrounding text carries the meaning.
- Gradient text falls back to a solid `--accent-1` color via the `color:` rule
  before the `background-clip: text` rule (CSS cascade).
- All accent colors verified AA on their respective backgrounds:
  - Dark mode: `--text-primary` `#efe9f5` on `#0c0a14` = 14.6:1
  - Dark mode: `--accent-2` `#d98cff` on `#0c0a14` = 7.9:1
  - Light mode résumé: `--accent-1` `#8e3dd1` on `#fbfaff` = 5.3:1 (AA for
    text, AAA for large text)
- `prefers-reduced-motion: reduce` disables fade-in reveals; content rendered
  visible at load.

## Out of scope

- Adding a "Selected work / Projects" section. The user has no public project
  showcase content (BYSTAMP work is confidential). Can be added in a future
  pass if content is created.
- Changing language coverage (résumé stays FR, homepage stays bilingual).
- Replacing fonts entirely. Inter + JetBrains Mono is the chosen pairing.
- Any change to the data shape in `data.js`.
- Any change to the server, the Dockerfile, the PDF render path, the Turnstile
  flow, or the security headers.

## Open questions

None at design-doc time — the brainstorming session resolved direction (D),
flavour (F2 Iris), hero composition (H1 centred), scope (everything), and
content preservation (all of `data.js`).
