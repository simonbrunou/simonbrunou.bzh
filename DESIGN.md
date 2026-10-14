---
name: simonbrunou.bzh
description: Recruiter-first portfolio of Simon Brunou. Each shipped product fills a full-width band in its own app's colours.
colors:
  stone: "#e6e7e3"
  ink: "#16181b"
  ink-hover: "#34383f"
  muted: "#464a50"
  rule: "rgba(22, 24, 27, 0.22)"
  rule-strong: "rgba(22, 24, 27, 0.45)"
  concrete: "#d3d5cf"
  slate: "#2f5168"
  slate-text: "#ecedea"
  slate-soft: "#c5d2dc"
  peach: "#ffdbbd"
  sage: "#6b8e6b"
  sage-deep: "#2f4a33"
  brown: "#4a2108"
  brown-soft: "#692d07"
  cinder-ground: "#0b0c10"
  ember: "#f38042"
  cinder-text: "#ece8e3"
  cinder-soft: "#b9b6b2"
  contact-text: "#cfd1cc"
  contact-soft: "#b3b6b1"
  paper: "#ffffff"
typography:
  display:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(3.5rem, 9vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "0"
  headline:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(2.75rem, 5.5vw, 3.75rem)"
    fontWeight: 900
    lineHeight: 1
  title:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 0.9
  lead:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "1.3125rem"
    fontWeight: 500
    lineHeight: 1.45
  body:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.3
  date:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    fontFeature: "tnum, lnum"
  cv-body:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "9.5pt"
    lineHeight: 1.38
rounded:
  control: "2px"
spacing:
  gutter: "clamp(20px, 4.5vw, 64px)"
  text-column: "clamp(380px, 38vw, 560px)"
  max-width: "1240px"
  section: "112px"
  cv-pad-x: "14mm"
components:
  button-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stone}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
    height: "48px"
  button-solid-hover:
    backgroundColor: "{colors.ink-hover}"
    textColor: "{colors.stone}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
    height: "48px"
  button-line-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stone}"
  contact-link:
    backgroundColor: "transparent"
    textColor: "{colors.stone}"
    rounded: "{rounded.control}"
    padding: "10px 22px"
    height: "48px"
  contact-link-hover:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
  band-diversif:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.brown}"
  band-cinder:
    backgroundColor: "{colors.cinder-ground}"
    textColor: "{colors.cinder-text}"
  job-main:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.slate-text}"
    padding: "88px 0 96px"
  facts:
    backgroundColor: "{colors.concrete}"
    textColor: "{colors.ink}"
    padding: "104px 0 120px"
  contact-block:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stone}"
    padding: "112px 0 96px"
---

# Design System: simonbrunou.bzh

Sources: `styles.css` (homepage and 404), `app.js` (rendering), `data.js` (content and screenshot crops), `pdf-template/styles.css` + `pdf-template/app.js` (CV), `docs/adr/0001-replace-iris.md` (why this replaced Iris).

## Overview

**Creative North Star: "Bands"**

The work is the identity. Every featured product gets a full-width band painted in that app's own colours, with oversized screenshots running off the band edge. Everything else is quiet: a stone-grey ground, ink text, tall condensed signage caps for names and headings, a Clarendon-style serif for prose. The reader is a recruiter or client skimming for about 30 seconds, so the page reads as a sequence of flat colour fields: intro, product bands, experience (with one slate band for the longest job), a concrete facts field, an ink contact block.

Single colour mode (light, `color-scheme: light`), no theme toggle. Brittany appears as text only. Colour comes from flat fields, never gradients or glows.

**Key Characteristics:**
- Full-bleed flat colour bands, one per featured product, alternating mirrored composition.
- Big Shoulders Display 900 uppercase for names and headings; Besley for everything read.
- Near-zero radius (2px on controls), hairline rules, no cards.
- One motion: scroll-driven screenshot slide on wide screens.
- The same system translated to a two-page A4 CV on white.

## Colors

A neutral stone/ink frame carrying borrowed product palettes, each confined to its own band.

### Primary
- **Ink** (#16181b): body text, solid buttons, focus ring default, scrollbar thumb, selection background, and the closing contact block ground.
- **Stone** (#e6e7e3): page ground (`html`, `body`), text on ink.

### Product band pairs (each lives only inside its band / CV strip)
- **Diversif**: Peach ground (#ffdbbd), Brown text (#4a2108), Brown-soft secondary text (#692d07), Sage-deep name and ring (#2f4a33), Sage field behind shots (#6b8e6b).
- **Cinder**: Cinder ground (#0b0c10), Cinder-text (#ece8e3), Cinder-soft secondary (#b9b6b2), Ember name, main link, ring and field (#f38042).

### Secondary fields
- **Slate** (#2f5168) with Slate-text (#ecedea) and Slate-soft (#c5d2dc): the longest-held job only (`.job-main`, chosen by tenure in `app.js`; `.strip-main` on the CV).
- **Concrete** (#d3d5cf): the facts field (skills, education, languages).

### Neutral
- **Muted** (#464a50): locations, periods, school names, secondary lists on stone/concrete.
- **Rule** (ink 22%) between job rows; **Rule-strong** (ink 45%) above skill and fact groups.
- **Contact-text** (#cfd1cc) / **Contact-soft** (#b3b6b1): prose and colophon on ink.
- **Paper** (#ffffff): CV page only.

### Named Rules
**The Own Band Rule.** A product's colours appear only inside its band (and its CV strip). Every band also re-scopes `--ring` and `::selection` to its own pair, so focus and selection stay legible on that ground.

**The Flat Field Rule.** Colour is applied as flat full-width fields. No gradients, washes or tinted overlays anywhere.

## Typography

**Display Font:** Big Shoulders Display (fallback Arial Narrow), variable 100–900, self-hosted `fonts/`, used at 900.
**Body Font:** Besley (fallback Georgia), variable 400–900, self-hosted.

**Character:** Tall condensed signage caps for proper nouns and headings over a sturdy Clarendon revival for reading.

### Hierarchy
- **Display** (900, `clamp(3.5rem, 9vw, 6rem)`, 0.9, uppercase, balanced wrap via `.display`): your name, product names (`.pname`), 404 title. Slate company name runs to `clamp(4.5rem, 12vw, 6rem)`.
- **Headline** (900, `clamp(2.75rem, 5.5vw, 3.75rem)`, line-height 1): section titles.
- **Title** (900, 3rem; 2.5rem ≤900px): company names in job rows; `.more-title` 2rem; degrees 2rem, languages 2.5rem.
- **Skill runs** (900, official casing via `text-transform: none`, 0.98): languages `clamp(2.5rem, 5.2vw, 3.75rem)`, frameworks `clamp(2rem, 3.8vw, 2.75rem)`, tools `clamp(1.625rem, 2.8vw, 2rem)`.
- **Contact address** (900 display, `clamp(2rem, 7.4vw, 6rem)`, line-height 1): the page's last and loudest line.
- **Lead** (Besley 500, 1.3125rem / 1.45, max 36em): product summaries, 404 text. Slate job summary 1.5rem / 1.4, max 40ch.
- **Body** (Besley 400, 17px / 1.6): ledes max 68ch, job summaries 1.125rem max 60ch.
- **Label** (Besley 700, 1.0625rem / 1.3): skill and fact group labels; role names; stack lines 600.
- **Date** (Besley 600, 1.25rem): years beside names; `tabular-nums lining-nums` on `.year`, `.job-period`, `.fact-school`, CV `.date`.

### Named Rules
**The Caps Are Names Rule.** Display caps are for names and headings. Skills are display-weight but keep official casing ("iOS", "Node.js").

**The Tabular Dates Rule.** Every date or period uses tabular lining figures.

## Layout

- `.wrap`: max `1240px + 2 × gutter`, inline padding `--gutter: clamp(20px, 4.5vw, 64px)`. `--edge = max(gutter, (100vw − 1240px)/2)` is the wrap's left edge measured from the viewport.
- **Band grid** (`.band`): `grid-template-columns: var(--edge) var(--textw) 1fr` with `--textw: clamp(380px, 38vw, 560px)`, so band text aligns exactly with the page wrap while shots take the rest. A `::before` field of the product's second colour starts at `--field-left = edge + textw + 28px` and runs to the viewport edge; shots sit over it, overflow the band (`overflow: hidden` clips them), and overlap each other with `margin-top: -88px`.
- **Mirroring**: the next band reverses columns (`.band-cinder`: `1fr textw edge`, field on the left, shots offset leftward). Featured bands alternate sides.
- **Section rhythm**: 112px between major sections (experience top, facts margin, contact padding); 80px ≤900px. Band text 80/88px vertical padding.
- **Experience rows**: 3-column grid (`1fr 15rem 34rem`), 44px rows between `--rule` hairlines; slate row is 2-column (`15rem 46rem`) with full-width head.
- **Breakpoint 900px**: everything stacks to one column. Bands become text first, then shots on a solid field of the band's second colour (`::before` hidden), shots at 100% width with 16px gap, each cropped to a narrow window via `--arm/--cx/--cy/--cw/--r` from `data.js` `crop.narrow`. Buttons go full-width centred in contact.
- **404** (`404.html`): stone page, display-type home link, a name row with "404" in the year slot, lead text, then the ink contact block pinned to the bottom (`min-height: 100dvh` column).

## Elevation & Depth

Flat by default; depth comes from overlapping colour fields. The only shadows are on band screenshots, tinted to each band's ground.

### Shadow Vocabulary
- **Diversif shot** (`box-shadow: 0 28px 48px -22px rgba(38, 24, 10, 0.5)`).
- **Cinder shot** (`box-shadow: 0 28px 48px -22px rgba(30, 10, 0, 0.7)`) plus an inset 1px `rgba(255,255,255,0.12)` outline on the crop so dark UI separates from the dark ground.

### Named Rules
**The Shots-Only Shadow Rule.** Shadows exist only under screenshots in bands. Text, buttons and fields never cast shadows.

## Shapes

Square. Controls use `border-radius: 2px`; every field, band, strip and screenshot crop is square-cornered. Structure comes from 1px hairline rules (`--rule`, `--rule-strong`), the 2px `currentColor` button border, and on the CV 0.75pt rules and a 1.5pt ink head rule. The details chevron is drawn from two 2px borders rotated (−45° closed, 45° open), not a glyph.

## Components

### Buttons
- **Shape:** 2px radius, 2px `currentColor` border, min-height 48px, padding 10px 22px (16px inline and 1rem text ≤900px), Besley 700.
- **Solid:** ink ground, stone text; hover `--ink-hover`.
- **Line:** ink text on transparent; hover fills ink with stone text.
- **Contact link:** same shape on ink; hover fills stone with ink text.
- Transitions: background/border/colour 0.15s ease-out.

### Links, focus, selection, scrollbar
- Links underline 2px at 0.22em offset; hover thickens to 4px. The language toggle (`.lang-toggle`, 44px min target) is styled as a link.
- Focus: `outline: 3px solid var(--ring)`, offset 3px; `--ring` is re-scoped per field (sage-deep, ember, slate-text, stone).
- Selection: ink on stone by default; inverted to each band's pair inside bands, slate and contact.
- Scrollbar: `scrollbar-color: ink stone`.

### Project band (signature)
`.band.band-<id>` rendered by `app.js` from any `data.js` project with `shots`: name row (display name + year), lead summary, details, stack, links, then `.band-shots` of `figure.shot > .crop > img`. `.crop` uses `aspect-ratio: var(--ard)` (from `crop.wide`, cutting the image at the bottom). Projects without shots render as one line each under the bands (`.more`).

### Experience
Hairline-separated rows, one per employer, with its positions listed oldest first; the longest tenure becomes the full-bleed slate `.job-main`. Each employer's full bullet list sits behind `<details class="job-more">` ("Full detail"), grouped by position when there is more than one, with the drawn chevron.

### Facts
Concrete field; skill groups as running display type in three descending sizes; education and spoken languages in two columns.

### Contact block
Ink field, headline, short text, giant display mailto (hover inverts to stone ground), outlined contact links, colophon above a stone 22% rule.

### CV (pdf-template/)
- Two fixed A4 pages (`.page` 211mm × 296.9mm, `overflow: hidden`, `@page { size: A4; margin: 0 }`), white paper, ink text, Besley 9.5pt / 1.38, `print-color-adjust: exact`.
- Header: 44pt display name, 20mm photo, contact row; 1.5pt ink rule under it. Section `h2` 17pt display caps with a trailing 0.75pt rule.
- **Strips**: each featured project and the longest job open with a full-bleed strip (negative margins to the page edge) in their homepage colours: `.strip-diversif` peach/brown with sage-deep name, `.strip-cinder` cinder/cinder-text with ember name, `.strip-main` slate/slate-text. Strip names 25pt display; dates 11pt 600.
- **Overflow guard**: after fonts and images load, `pdf-template/app.js` sets `data-render-error` on `<html>` if any page's `scrollHeight` exceeds its height; the PDF build fails on it. Fix by moving content between pages, never by shrinking type.

### Motion
One scroll-driven animation (`styles.css`, `@supports (animation-timeline: view())`, only with `prefers-reduced-motion: no-preference` and `min-width: 901px`): `.band-shots` translate from 7% (−7% for mirrored bands) to 0 over `entry 10% cover 40%`. Shots are fully visible throughout; unsupported browsers show them in place. Reduced motion disables all animation and transition. Forced colours hide band fields and force button borders to `ButtonText`.

## Adding a banded project

1. In `data.js`, add `shots` to the project: each `{ src, width, height, alt: { en, fr }, crop: { wide: W / visibleH, narrow: { ratio, x, y, w } } }` (`narrow` x/y/w are fractions of the image). WebP in `images/` with its `.json` provenance sidecar. Any project with shots becomes a band automatically.
2. In `styles.css`, add a `.band-<id>` block mirroring `.band-diversif` / `.band-cinder`: ground and text colours, `--ring`, `::selection`, `::before` field side and colour, `.pname` colour, `.year/.details/.stack` soft colour, shot shadow tinted to the ground, shot widths/offsets, and in the 900px query the `.band-shots` field background. Alternate field side from the previous band (mirrored bands use the Cinder grid columns and `shots-in-left`). Add colour tokens to `:root`.
3. In `pdf-template/styles.css`, add `.strip-<id>` with the same pair, then check the overflow guard still passes.

## Do's and Don'ts

### Do:
- **Do** take a product's colours from the product itself and confine them to its band and strip.
- **Do** align band text to `--edge` / `--textw` so it lines up with the page wrap.
- **Do** keep the slate band for the single longest-held job and concrete for facts.
- **Do** re-scope `--ring` and `::selection` on every new coloured field.
- **Do** keep tabular figures on dates and official casing on skills.

### Don't (ADR 0001, Iris patterns banned):
- **Don't** use purple-to-pink or any gradient palette, gradient text or gradient washes.
- **Don't** use glow shadows or shadows on anything but band screenshots.
- **Don't** use Inter or system faces for display; display is Big Shoulders Display.
- **Don't** use uppercase mono section labels, kickers or eyebrows above headings.
- **Don't** use card grids; content sits on flat fields separated by hairlines.
- **Don't** add a theme toggle or dark mode; one colour mode per surface.
- **Don't** use Brittany imagery (flag, triskell, granite, sea); Brittany is text only.
- **Don't** use emoji or glyph icons (the favicon is an outlined SB SVG; the chevron is drawn).
