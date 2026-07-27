# Homepage Overhaul — Lusion-style Design

Date: 2026-07-27
Branch: `redesign/homepage-v2`
Status: Approved

## Goal

Rebuild the DroneAnatomy homepage in a Lusion-inspired visual and motion
language, built on the hero already present on this branch. The page presents a
capability-led narrative and travels from a light opening to a dark close.

## Scope

**In scope:** the homepage (`/`) only — every beat from the hero to the footer,
the homepage's own navigation, the Tailwind setup that supports it, and four
carve-outs on existing code (below).

**Out of scope:** all twelve other routes — `/about`, `/careers`, `/contact`,
`/launches`, `/updates`, `/privacy`, `/products`, and the five `/products/*`
detail pages. These keep their current dark theme, their CSS Modules, and the
shared `Header`/`Footer`. They must render identically after this work.

`ChromeGate` continues to suppress the shared `Header` and `Footer` on `/`. The
homepage supplies its own chrome (`OverlayMenu`, `StickyMiniNav`, `HomeFooter`);
`BARE_ROUTES` is unchanged.

**Carve-outs — existing code changed deliberately:**

1. `LazyHeroCluster` currently wraps all of `HeroCluster` in
   `dynamic(..., { ssr: false })`, so the homepage's static HTML is empty. The
   `ssr: false` boundary moves down to `ThermalTerrain` alone.
2. `HeroCluster.module.css` converts to Tailwind, as its own isolated step, so
   the page does not run two styling systems permanently.
3. `Header.tsx`'s inline `productItems` / `navItems` move to `src/lib/nav.ts`,
   shared with the new overlay menu.
4. `ThermalTerrain` gains a thermal-derivation path so the thermal plate is
   computed from the day plate rather than supplied as a second photo. See
   "Hero imagery" below.

## Decisions

| Area | Decision |
|---|---|
| Scope | Homepage only |
| Styling | Tailwind v4, `theme` + `utilities` layers, Preflight omitted |
| Content | Capability-led: positioning → stats → capabilities → products |
| Motion | GSAP + ScrollTrigger, ScrollSmoother, SplitText |
| Theme | Light → dark transition down the page |
| Navigation | Full-screen overlay menu plus sticky mini-nav after the hero |
| Accessibility | `prefers-reduced-motion` honoured; full experience at all screen sizes |
| Architecture | Reusable motion primitives plus a thin global controller |
| Hero imagery | Keep the thermal-reveal concept; replace strike-aftermath plates with a neutral site |
| Thermal plate | Derived from a single day photo, not supplied as a second asset |

## Page structure

| # | Beat | Theme | Purpose |
|---|---|---|---|
| 1 | Hero (`HeroCluster`) | Light | Wordmark, tagline, thermal-reveal terrain card |
| 2 | Positioning statement | Light | One pinned headline, per-character reveal |
| 3 | Stats band | Light, transition begins | 3–4 counters as capability proof points |
| 4 | Capability grid | Dark | 4–6 capabilities: what the systems do |
| 5 | Products | Dark | The five existing products as an interactive row |
| 6 | CTA + footer | Dark | "Let's talk" plus real site navigation |

Beat 2 is new. The hero's tagline currently serves as both brand mark and
positioning; a capability-led narrative needs one clear claim before it starts
listing capabilities.

The theme transition spans beats 3→4 rather than sitting on a section boundary,
so the page darkens while the stats are still visible.

## Architecture

```
src/app/page.tsx                    server component: metadata, content data, composition
src/app/globals.css                 tailwind layers + @theme tokens
src/lib/nav.ts                      shared nav link data

src/components/motion/              reusable primitives (client)
  Reveal.tsx                        fade/translate on enter
  Pin.tsx                           ScrollTrigger pinning wrapper
  SplitHeading.tsx                  per-character headline reveal
  useGsapScope.ts                   gsap.context() lifecycle + cleanup

src/components/home/
  HomeMotionProvider.tsx            ScrollSmoother + --page-progress, nothing else
  nav/OverlayMenu.tsx
  nav/StickyMiniNav.tsx
  sections/PositioningStatement.tsx
  sections/StatsBand.tsx
  sections/CapabilityGrid.tsx
  sections/ProductRow.tsx
  sections/HomeCTA.tsx
  HomeFooter.tsx
```

### Server/client split

Sections are server components. Only motion wrappers are client components.
`<Reveal>` is `'use client'`, but its children are server-rendered and passed
through as props, so section copy lands in the static HTML. Under
`output: 'export'` this is the difference between a crawlable homepage and an
empty shell.

### Motion

One global controller (`HomeMotionProvider`) owns exactly two things:
ScrollSmoother, and a ScrollTrigger that writes `--page-progress` from 0 to 1
across beats 3→4. It knows nothing about section internals.

Sections compose the primitives locally. No section references another section.

Every animation is created inside `gsap.matchMedia()`, which supplies the
reduced-motion branch and handles teardown:

```ts
const mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: no-preference)", () => { /* full choreography */ });
mm.add("(prefers-reduced-motion: reduce)", () => { /* opacity only, no ScrollSmoother */ });
```

Primitives wrap `gsap.context()` via `useGsapScope`. React 19 StrictMode
double-mounts effects; without scoped cleanup this leaves duplicate
ScrollTriggers firing.

### Styling

`globals.css` imports Tailwind's `theme` and `utilities` layers and omits
`preflight.css`:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css"     layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

Omitting Preflight is what keeps the twelve legacy routes byte-for-byte
unchanged. New components therefore set their own base styles for headings,
lists and buttons rather than inheriting a reset.

A `@theme` block promotes the existing `:root` tokens into Tailwind's theme so
`--color-ink` becomes `text-ink` / `bg-ink` without duplication. The legacy
`:root` block stays in place; CSS Modules on other routes still read from it.

### Theme arc

The transition derives entirely from one scalar. `.home` is the root element
rendered by `page.tsx`; the controller writes `--page-progress` onto it.

Registering the property gives it a real type and a guaranteed initial value, so
it resolves correctly before the controller mounts:

```css
@property --page-progress {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

.home {
  --page-progress: 0;
  --page-bg: color-mix(in oklab, var(--color-lav), var(--color-card) calc(var(--page-progress) * 100%));
  --page-fg: color-mix(in oklab, var(--color-ink), white calc(var(--page-progress) * 100%));
  background: var(--page-bg);
  color: var(--page-fg);
}
```

Interpolation is in oklab. A straight sRGB blend from lavender to near-black
passes through a desaturated grey near the midpoint, which is precisely where
the transition is most visible.

This costs one tween and no React re-renders. The reduced-motion branch simply
never creates that tween.

### Navigation

`OverlayMenu` renders full-screen with staggered link reveals. `StickyMiniNav`
fades in past the hero and derives its contrast from `--page-progress`, so it
stays legible across the transition without a second trigger.

Both import link data from `src/lib/nav.ts`, as does `Header`, so the two navs
cannot drift when a product is added.

`HomeFooter` is the homepage's own footer, carrying the same link set. The
shared `Footer` stays suppressed on `/` via `ChromeGate`; it is not restyled.

This also closes a live gap: the hero's `Menu ··` pill is currently a `<button>`
with no handler, and `ChromeGate` suppresses the real `Header` on `/`, leaving
the homepage with no route to products, about, careers or updates.

## Hero imagery

The current plates (`site-day.webp`, `site-thermal.webp`) show aerial strike
aftermath — burning wreckage, destroyed vehicles, blast craters. The
thermal-reveal concept is retained; the subject changes to a neutral site
(infrastructure, terrain, or a survey area).

The thermal plate is **derived from the day plate**, not sourced separately.
The two plates must share the same frame, crop and altitude or features will not
line up across the lens edge, and aligned EO/IR pairs are effectively
unobtainable as published assets. Deriving guarantees registration by
construction and reduces the asset dependency to one image.

Derivation follows the approach the procedural generator already uses — day and
heat built from one shared source — applied to a photograph:

- Segment by luminance and hue: built surfaces (roofs, roads, bare ground) map
  to the hot end of the ironbow ramp; vegetation maps cold; water maps coldest.
- Apply a mild blur to the heat map, matching the lower spatial resolution of a
  real thermal sensor.
- Emit at half resolution, as the procedural path already does.

Derivation runs once as a build-time script writing `site-thermal.webp`, not per
page load. The existing `IRONBOW` ramp and lens shader are unchanged.

This produces a plausible simulation, not real sensor data. It must not be
captioned or described as genuine thermal capture.

Also to tune, independent of the imagery swap: the reveal currently reads
quietly, because both plates are dark and the lens is roughly 230px against a
1350px card. Lens radius, day-plate exposure and ramp temperature are all
adjustable and should be revisited once the new plate is in.

## Content

Stat figures and capability copy do not exist yet. They are defined as typed
data at the top of the page module (`STATS`, `CAPABILITIES`) so real values drop
in as one-line edits rather than component changes. **The figures must be
supplied before launch; placeholders must not ship.**

Products reuse the existing routes (`/products/p10-pro`, `noxr-1`, `cyclops-3`,
`cyclops-mini`, `liftx100`) and the imagery already in `/public/images`. No new
product photography is assumed.

One new asset is required: a single neutral aerial photograph for the hero, at
sufficient resolution for a full-bleed card. Until it is supplied, the hero
falls back to the existing procedural site so the page remains buildable.

## Verification

The repository has no test runner — no Jest, Vitest or Playwright in
`package.json`, and no test files. Standing one up is out of scope for this
work; it is a real gap, tracked separately.

Verification for this change is:

1. `npm run build` passes under `output: 'export'`.
2. `npm run lint` passes.
3. Visual check via Playwright against `npm run dev`, including one pass with
   reduced motion forced on.
4. Built `out/index.html` contains the section copy, confirming the
   server/client split works.
5. Two legacy routes spot-checked against `main` to confirm the omitted
   Preflight left them unchanged.

## Risks

- **Hero regression.** `HeroCluster.module.css` carries three commits of
  measured margins and type scale. The Tailwind conversion is an isolated step
  with before/after comparison, not folded into new section work.
- **No Preflight.** New components inherit browser defaults. Base styles for
  the homepage must be set explicitly.
- **Bundle size.** Three.js plus GSAP, ScrollTrigger, ScrollSmoother and
  SplitText on one route. GSAP plugins are imported individually and the page
  is measured after the first section lands, not at the end.
- **Hero asset is a dependency.** The neutral aerial must be supplied before
  the hero is final. The procedural fallback keeps the page buildable, but
  shipping it was not the intent.
- **Derived thermal is a simulation.** It approximates how an EO/IR payload
  would see the scene. It must not be presented as real sensor capture.
