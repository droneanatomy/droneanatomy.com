# Homepage Lusion-style Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the DroneAnatomy homepage as a capability-led, light-to-dark scrolling page on top of the existing thermal-reveal hero.

**Architecture:** Sections are React Server Components; only motion wrappers are client components, so section copy survives into the static export. One thin client controller owns ScrollSmoother and a single `--page-progress` custom property; the light-to-dark theme arc is pure CSS interpolation off that scalar. Reusable motion primitives (`Reveal`, `Pin`, `SplitHeading`) are composed locally by each section — no section knows about another.

**Tech Stack:** Next.js 16.1.1 (App Router, `output: 'export'`), React 19.2.3, TypeScript, Tailwind CSS v4 (theme + utilities layers, no Preflight), GSAP 3 with ScrollTrigger / ScrollSmoother / SplitText, Three.js 0.182 (hero only), `sharp` (build-time image derivation).

## Global Constraints

- **Scope is the homepage (`/`) only.** The twelve other routes — `/about`, `/careers`, `/contact`, `/launches`, `/updates`, `/privacy`, `/products`, and the five `/products/*` detail pages — must render identically after this work.
- **Preflight must never be imported.** Use the three-line layer import. Importing `tailwindcss` wholesale will restyle every legacy route.
- **`ChromeGate` is unchanged.** `BARE_ROUTES` stays `['/']`; the shared `Header` and `Footer` remain suppressed on `/`.
- **Static export must keep working.** `output: 'export'` is set. No server-only APIs, no dynamic route handlers, no `next/image` optimization.
- **Section copy must appear in the built HTML.** Sections are server components. Never mark a section `'use client'`.
- **`position: fixed` elements go outside `#smooth-wrapper`.** ScrollSmoother transforms `#smooth-content`, creating a new containing block; fixed elements inside it anchor to the content, not the viewport.
- **Every animation lives inside `gsap.matchMedia()`** with an explicit `(prefers-reduced-motion: reduce)` branch.
- **Derived thermal imagery is a simulation.** It must never be captioned or described as real sensor capture.
- **Placeholder stats and capability copy must not ship.** They are marked `PLACEHOLDER` in code; real figures come from the client before launch.

## Verification model — read this before Task 1

**This repository has no test runner.** There is no Jest, Vitest, or Playwright in `package.json`, and no test files anywhere. This was a deliberate decision recorded in the spec: standing up a test suite is out of scope for a marketing homepage redesign.

**Do not invent a test framework.** Where this plan's steps say "verify", they mean the commands given in that step — typically some combination of:

- `npm run build` — must exit 0 under `output: 'export'`
- `npm run lint` — must exit 0
- `grep` against `out/index.html` — proves the server/client split works
- A Playwright MCP screenshot against `npm run dev` on `http://localhost:3000`

Each task ends with a real, runnable verification and a commit.

---

### Task 1: Turn on Tailwind without Preflight

**Files:**
- Modify: `src/app/globals.css` (prepend to top of file)

**Interfaces:**
- Consumes: nothing
- Produces: Tailwind utility classes available project-wide; theme tokens `--color-ink`, `--color-lav`, `--color-card`, `--color-flare`, `--font-display`, `--font-body` usable as `text-ink`, `bg-lav`, `font-display`, etc.

- [ ] **Step 1: Capture a baseline of a legacy route**

The whole point of omitting Preflight is that legacy routes do not move. Capture proof before changing anything.

```bash
npm run dev
```

Then via Playwright MCP, screenshot `http://localhost:3000/about` at 1440x900 and save it as `baseline-about.png` somewhere outside the repo (use the scratchpad directory). Leave the dev server running.

- [ ] **Step 2: Add the Tailwind layer imports**

Add to the **very top** of `src/app/globals.css`, above the existing `/* DroneAnatomy - Global Styles */` comment:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
/* preflight.css is deliberately NOT imported — see docs/superpowers/specs/2026-07-27-homepage-lusion-overhaul-design.md */

@theme {
  --color-ink: #14151a;
  --color-lav: #eceaf4;
  --color-card: #0e0e12;
  --color-flare: #fffc00;
  --color-pill: #dcdae6;
  --color-pill-hover: #d0cee0;
  --color-pill-dark: #2b2e3a;

  --font-display: 'D-DIN-Bold', Arial, Verdana, sans-serif;
  --font-body: 'D-DIN', Arial, Verdana, sans-serif;
  --font-mono: var(--font-roboto-mono), monospace;
}

@property --page-progress {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}
```

Do not touch the existing `:root` block further down the file. Legacy CSS Modules read from it.

- [ ] **Step 3: Verify utilities generate**

Temporarily add a Tailwind class to the hero to confirm the pipeline works. In `src/components/HeroCluster/HeroCluster.tsx`, change the `hint` span's className:

```tsx
<span className={`${styles.hint} tracking-[0.4em]`}>Hover to scan &middot; thermal imaging</span>
```

Reload `http://localhost:3000` and confirm the hint text letter-spacing visibly widens. Then **revert this change** — it was only a probe.

- [ ] **Step 4: Verify legacy routes did not move**

Screenshot `http://localhost:3000/about` again at 1440x900 and compare against `baseline-about.png` from Step 1. They must be visually identical. Repeat for `http://localhost:3000/products/p10-pro`.

If anything shifted, Preflight leaked in — check that you imported the three layer files individually and not `"tailwindcss"`.

- [ ] **Step 5: Verify the build**

```bash
npm run build
npm run lint
```

Both must exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "Styling: enable Tailwind v4 theme + utilities layers, no Preflight

Imports the layer files individually so Preflight never lands, keeping the
twelve legacy CSS-Module routes byte-for-byte unchanged. Promotes the hero
palette into @theme and registers --page-progress as a typed custom property
for the light-to-dark scroll arc."
```

---

### Task 2: Move the `ssr: false` boundary down to ThermalTerrain

The homepage currently renders as `<main><!--$!--><template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">` — the wordmark appears zero times in the served HTML. Only the WebGL canvas needs the browser.

**Files:**
- Modify: `src/components/HeroCluster/HeroCluster.tsx`
- Modify: `src/components/HeroCluster/LazyHeroCluster.tsx`
- Create: `src/components/HeroCluster/LazyThermalTerrain.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `ThermalTerrainProps` from `./ThermalTerrain`
- Produces: `HeroCluster` as a **server** component; `LazyThermalTerrain` as the only client boundary in the hero.

- [ ] **Step 1: Prove the current failure**

```bash
npm run dev
curl -s http://localhost:3000 | grep -c "DRONEANATOMY\|DroneAnatomy<"
```

Expected: `0`. Record this — Step 6 asserts it becomes non-zero.

- [ ] **Step 2: Create the narrow client boundary**

Create `src/components/HeroCluster/LazyThermalTerrain.tsx`:

```tsx
'use client';

/* The only client boundary in the hero. WebGL cannot server-render, but the
   surrounding chrome can and must — see the spec's server/client split. */

import dynamic from 'next/dynamic';
import type { ThermalTerrainProps } from './ThermalTerrain';

const ThermalTerrain = dynamic(
  () => import('./ThermalTerrain').then((m) => m.ThermalTerrain),
  { ssr: false }
);

export const LazyThermalTerrain: React.FC<ThermalTerrainProps> = (props) => (
  <ThermalTerrain {...props} />
);

export default LazyThermalTerrain;
```

- [ ] **Step 3: Make HeroCluster a server component**

In `src/components/HeroCluster/HeroCluster.tsx`:

1. Delete the `'use client';` line at the top.
2. Change the `ThermalTerrain` import to `import { LazyThermalTerrain } from './LazyThermalTerrain';`
3. Change the usage in the card from `<ThermalTerrain ... />` to `<LazyThermalTerrain ... />`.

Leave everything else — the chrome, ticks, rail — exactly as-is.

- [ ] **Step 4: Delete the old wrapper and update the page**

Delete `src/components/HeroCluster/LazyHeroCluster.tsx`.

Replace `src/app/page.tsx` imports and usage:

```tsx
import { HeroCluster } from '@/components/HeroCluster/HeroCluster';
```

and change `<LazyHeroCluster ... />` to `<HeroCluster ... />`.

Update `src/components/HeroCluster/index.ts` to drop the `LazyHeroCluster` export if it names one.

- [ ] **Step 5: Fix any remaining references**

```bash
grep -rn "LazyHeroCluster" src/
```

Expected: no output. Fix anything that appears.

- [ ] **Step 6: Verify the hero is now server-rendered**

```bash
npm run dev
curl -s http://localhost:3000 | grep -c "DroneAnatomy"
curl -s http://localhost:3000 | grep -o "<main>.\{0,200\}"
```

Expected: a non-zero count, and `<main>` containing real markup rather than `BAILOUT_TO_CLIENT_SIDE_RENDERING`.

Then screenshot `http://localhost:3000` and confirm the hero looks **identical** to before, including the thermal lens on hover over the canvas.

- [ ] **Step 7: Verify build and commit**

```bash
npm run build
npm run lint
grep -c "DroneAnatomy" out/index.html
```

The `grep` must return non-zero — this is the real proof under static export.

```bash
git add src/components/HeroCluster src/app/page.tsx
git commit -m "Hero: server-render chrome, lazy-load only the WebGL canvas

The ssr:false boundary wrapped the whole HeroCluster, so the homepage shipped
an empty <main> under output:'export' and the wordmark appeared zero times in
the served HTML. Only ThermalTerrain needs the browser; the boundary now sits
around it alone."
```

---

### Task 3: Derive the hero plates from the source aerial

**Files:**
- Create: `scripts/derive-hero-plates.mjs`
- Modify: `package.json` (add `sharp` devDependency and a `plates` script)
- Output: `public/images/site-day.webp`, `public/images/site-thermal.webp` (overwrites the strike-aftermath plates)

**Interfaces:**
- Consumes: `assets/hero/site-day-source.jpg` (3864x2304, committed)
- Produces: both plates at identical dimensions and crop, guaranteeing registration across the lens edge.

**Why luminance, not hue:** the source plate measures mean HSL saturation 0.056 — effectively monochrome — so hue segmentation has no signal. Luminance spans p05 0.108 to p95 0.729, and in this scene the bright/dark split largely tracks sun exposure, which is a defensible thermal proxy.

- [ ] **Step 1: Add sharp as an explicit dependency**

`sharp` is currently present only transitively via Next.js. Do not rely on that.

```bash
npm install --save-dev sharp
```

- [ ] **Step 2: Write the derivation script**

Create `scripts/derive-hero-plates.mjs`:

```js
/* Derives both hero plates from one source aerial so they share a frame and
   crop exactly — features must line up across the thermal lens edge.

   Thermal is luminance-driven: the source is effectively monochrome (mean HSL
   saturation 0.056), and in this scene brightness tracks sun exposure, so warm
   sunlit rock reads hot and shadowed rock and vegetation read cool.

   This is a plausible simulation of an EO/IR payload, NOT sensor data. */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'assets/hero/site-day-source.jpg';
const OUT = 'public/images';

const DAY_W = 2400;      // full-bleed card, retina-ish without being wasteful
const HEAT_W = 1200;     // thermal sensors are lower-resolution; half is plenty

/* Ironbow ramp, matched to IRONBOW in ThermalTerrain.tsx. */
const IRONBOW = [
  [0.0, [6, 0, 20]],
  [0.18, [48, 8, 86]],
  [0.38, [132, 20, 96]],
  [0.55, [204, 48, 42]],
  [0.7, [240, 120, 24]],
  [0.85, [252, 214, 74]],
  [1.0, [255, 255, 255]],
];

function ironbow(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < IRONBOW.length - 1; i++) {
    const [a, ca] = IRONBOW[i];
    const [b, cb] = IRONBOW[i + 1];
    if (t >= a && t <= b) {
      const k = (t - a) / (b - a || 1);
      return [
        ca[0] + (cb[0] - ca[0]) * k,
        ca[1] + (cb[1] - ca[1]) * k,
        ca[2] + (cb[2] - ca[2]) * k,
      ];
    }
  }
  return [255, 255, 255];
}

/* Spread mid-tones. The source clusters around p50 0.298, so a straight
   luminance->ramp mapping leaves most of the frame in the cold purple end. */
function contrastCurve(v) {
  const P05 = 0.108;
  const P95 = 0.729;
  let x = (v - P05) / (P95 - P05);
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x); // smoothstep
}

await mkdir(OUT, { recursive: true });

/* ---- day plate ---- */
await sharp(SRC)
  .resize({ width: DAY_W })
  .modulate({ brightness: 1.12 })  // lift slightly; the source is dark
  .webp({ quality: 82 })
  .toFile(`${OUT}/site-day.webp`);

console.log('wrote site-day.webp');

/* ---- thermal plate ---- */
const { data, info } = await sharp(SRC)
  .resize({ width: HEAT_W })
  .blur(1.6)              // thermal sensors resolve less detail than EO
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(info.width * info.height * 3);

for (let i = 0, o = 0; i < data.length; i += info.channels, o += 3) {
  const r = data[i] / 255;
  const g = data[i + 1] / 255;
  const b = data[i + 2] / 255;

  // Rec. 709 luma — perceptual brightness, the best available heat proxy here.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  const [tr, tg, tb] = ironbow(contrastCurve(luma));
  out[o] = tr;
  out[o + 1] = tg;
  out[o + 2] = tb;
}

await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
  .webp({ quality: 82 })
  .toFile(`${OUT}/site-thermal.webp`);

console.log('wrote site-thermal.webp');
```

- [ ] **Step 3: Add the npm script**

In `package.json`, add to `scripts`:

```json
"plates": "node scripts/derive-hero-plates.mjs"
```

- [ ] **Step 4: Run it**

```bash
npm run plates
ls -la public/images/site-day.webp public/images/site-thermal.webp
```

Both must exist and be newly timestamped.

- [ ] **Step 5: Verify visually — this is the real test**

```bash
npm run dev
```

Screenshot `http://localhost:3000`, then hover the canvas and screenshot again.

Check three things:
1. The day plate shows the mountain terrain, not the old strike aftermath.
2. Inside the lens, the ironbow palette is legible — sunlit scree reads hot (orange/yellow), shadowed rock reads cold (purple/black).
3. Features line up **exactly** across the lens edge. A road crossing the boundary must be continuous.

If the thermal reads flat or mostly-purple, adjust `contrastCurve`'s smoothstep or the P05/P95 window and re-run. Iterate here — this is the step that decides whether the hero works.

**Fallback if tuning stalls:** if luminance mapping cannot be made to read convincingly, author a heat mask by hand once against the source plate, commit it to `assets/hero/site-heat-mask.png`, and have the script multiply luminance by the mask instead of tuning the curve. Registration is still guaranteed and there is no per-image tuning code to maintain.

- [ ] **Step 6: Tune the lens itself**

The spec records that the reveal currently reads quietly — the lens is roughly 230px against a 1350px card, and both plates were dark. Now that the day plate is brighter, revisit the lens in `src/components/HeroCluster/ThermalTerrain.tsx`.

Find the uniform controlling lens radius (search the shader source for the radius or `uRadius` uniform) and increase it until the reveal reads as a deliberate scan rather than a small blob. Screenshot at each value rather than guessing.

Judge against one question: on hover, does it read as *the ground being seen a different way*, or as a purple circle? Only the former is finished.

- [ ] **Step 7: Commit**

```bash
git add scripts/ package.json package-lock.json public/images/site-day.webp public/images/site-thermal.webp
git commit -m "Hero: derive day and thermal plates from one source aerial

Both plates come from a single pass over assets/hero/site-day-source.jpg, so
registration across the lens edge is guaranteed by construction rather than by
hand-aligning two photographs.

Thermal mapping is luminance-driven with a smoothstep contrast curve: the
source is effectively monochrome (mean saturation 0.056) so hue segmentation
has nothing to work with, while brightness tracks sun exposure closely enough
to serve as a heat proxy. This is a simulation, not sensor data."
```

---

### Task 4: Convert HeroCluster to Tailwind

Isolated deliberately. `HeroCluster.module.css` carries three commits of measured margins and type scale; this task must not change a single pixel.

**Files:**
- Modify: `src/components/HeroCluster/HeroCluster.tsx`
- Delete: `src/components/HeroCluster/HeroCluster.module.css`

**Interfaces:**
- Consumes: theme tokens from Task 1
- Produces: hero markup styled entirely with Tailwind utilities; no CSS Module remains on the homepage.

- [ ] **Step 1: Capture the before**

```bash
npm run dev
```

Screenshot `http://localhost:3000` at **1440x900** and again at **390x844** (mobile). Save both outside the repo. These are the acceptance reference.

- [ ] **Step 2: Rewrite HeroCluster with utilities**

Replace `src/components/HeroCluster/HeroCluster.tsx`'s markup. The arbitrary-value syntax preserves the exact `clamp()` expressions — do not round them to Tailwind's default scale, or the measured spacing is lost.

```tsx
/* Lusion-style hero shell: a light section holding a dark rounded card.
   Server component — only LazyThermalTerrain crosses to the client. */

import React from 'react';
import { LazyThermalTerrain } from './LazyThermalTerrain';

export interface HeroClusterProps {
  className?: string;
  wordmark?: string;
  tagline?: string;
  imageSrc?: string;
  thermalSrc?: string;
  depthSrc?: string;
}

const pillBase =
  'inline-flex items-center gap-2 rounded-full border-0 cursor-pointer font-body ' +
  'text-sm font-medium tracking-[0.02em] uppercase whitespace-nowrap no-underline ' +
  'transition-[transform,background,color] duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.3,1)]';

export const HeroCluster: React.FC<HeroClusterProps> = ({
  className = '',
  wordmark = 'DroneAnatomy',
  tagline = 'We build the autonomous systems that define the next era of flight.',
  imageSrc,
  thermalSrc,
  depthSrc,
}) => {
  return (
    <section
      className={`relative flex min-h-svh w-full flex-col overflow-hidden bg-lav font-body text-ink
        px-[clamp(24px,3.05vw,44px)] py-[clamp(28px,4.6vh,50px)]
        gap-[clamp(16px,2.2vh,26px)] ${className}`}
    >
      {/* Top chrome */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-5 max-[720px]:grid-cols-[1fr_auto]">
        <a
          href="/"
          className="font-display text-[clamp(19px,1.8vw,26px)] font-bold uppercase tracking-[0.01em] text-ink no-underline"
        >
          {wordmark}
        </a>
        <p
          className="m-0 max-w-[540px] justify-self-center text-[clamp(18px,2.5vw,36px)] leading-[1.1]
            tracking-[-0.01em] text-ink
            max-[720px]:col-span-full max-[720px]:row-start-2 max-[720px]:justify-self-start max-[720px]:text-left"
        >
          {tagline}
        </p>
        <nav className="flex items-center gap-2.5 justify-self-end" aria-label="Primary">
          <button
            className={`${pillBase} grid h-[45px] w-[45px] place-items-center bg-pill p-0 hover:bg-pill-hover`}
            aria-label="Collapse"
          >
            <span className="h-0.5 w-3.5 bg-ink" />
          </button>
          <a href="/contact" className={`${pillBase} bg-pill-dark px-[22px] py-3.5 text-white hover:-translate-y-px`}>
            Let&rsquo;s talk <i className="h-1.5 w-1.5 rounded-full bg-flare" />
          </a>
          <button className={`${pillBase} bg-pill px-[22px] py-3.5 text-ink hover:bg-pill-hover`}>
            Menu &middot;&middot;
          </button>
        </nav>
      </div>

      {/* 3D card */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[clamp(14px,1.4vw,20px)] bg-card">
        <LazyThermalTerrain imageSrc={imageSrc} thermalSrc={thermalSrc} depthSrc={depthSrc} />
        <span className="pointer-events-none absolute left-3.5 top-3 select-none text-base leading-none text-white/50">+</span>
        <span className="pointer-events-none absolute right-3.5 top-3 select-none text-base leading-none text-white/50">+</span>
        <span className="pointer-events-none absolute bottom-3 left-3.5 select-none text-base leading-none text-white/50">+</span>
        <span className="pointer-events-none absolute bottom-3 right-3.5 select-none text-base leading-none text-white/50">+</span>
        <span className="pointer-events-none absolute bottom-3.5 left-1/2 -translate-x-1/2 select-none text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
          Hover to scan &middot; thermal imaging
        </span>
      </div>

      {/* Bottom rail */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-[clamp(4px,1vw,14px)] pt-0.5">
        <span className="text-[15px] text-ink/35">+</span>
        <span className="justify-self-center text-[clamp(11px,0.85vw,13px)] font-bold uppercase tracking-[0.18em] text-ink">
          Scroll to explore
        </span>
        <span className="justify-self-end text-[15px] text-ink/35">+</span>
      </div>
    </section>
  );
};

export default HeroCluster;
```

- [ ] **Step 3: Move the canvas fill rule into ThermalTerrain**

`HeroCluster.module.css` styled `.canvas` / `.fallback` with `position:absolute; inset:0`. That rule is being deleted, so `ThermalTerrain` must carry it itself.

In `src/components/HeroCluster/ThermalTerrain.tsx`, find where the `<canvas>` (and any WebGL-unsupported fallback element) is rendered and apply the equivalent classes directly:

```tsx
className="absolute inset-0 block h-full w-full"
```

For the fallback element also add:

```tsx
style={{ background: 'radial-gradient(120% 90% at 50% 40%, #23242c, #0d0e12)' }}
```

- [ ] **Step 4: Delete the CSS Module**

```bash
rm src/components/HeroCluster/HeroCluster.module.css
grep -rn "HeroCluster.module.css" src/
```

The `grep` must return nothing.

- [ ] **Step 5: Compare against the reference**

```bash
npm run dev
```

Screenshot at 1440x900 and 390x844. Compare against Step 1.

Check specifically: wordmark size and position, tagline wrap point and centring, the three pills' sizes and gaps, card corner radius, corner tick insets, rail text tracking, and the mobile layout where the tagline drops to its own row.

Any difference is a regression — fix it before continuing. Hover the canvas and confirm the thermal lens still works.

- [ ] **Step 6: Verify build and commit**

```bash
npm run build
npm run lint
```

```bash
git add src/components/HeroCluster
git commit -m "Hero: convert HeroCluster from CSS Modules to Tailwind

Arbitrary-value syntax preserves the measured clamp() margins and type scale
exactly rather than snapping to Tailwind's default scale. Canvas fill rules
move into ThermalTerrain, which now owns its own positioning."
```

---

### Task 5: Extract shared nav data

**Files:**
- Create: `src/lib/nav.ts`
- Modify: `src/components/Header/Header.tsx`

**Interfaces:**
- Produces: `export interface NavLink { label: string; href: string }`, `export const PRODUCT_LINKS: NavLink[]`, `export const COMPANY_LINKS: NavLink[]`

- [ ] **Step 1: Create the module**

Create `src/lib/nav.ts`:

```ts
/* Single source of truth for site navigation. Imported by both the shared
   Header and the homepage OverlayMenu so the two cannot drift when a product
   is added. */

export interface NavLink {
  label: string;
  href: string;
}

export const PRODUCT_LINKS: NavLink[] = [
  { label: 'P10 Pro', href: '/products/p10-pro' },
  { label: 'NOXR-1', href: '/products/noxr-1' },
  { label: 'Cyclops 3', href: '/products/cyclops-3' },
  { label: 'Cyclops Mini', href: '/products/cyclops-mini' },
  { label: 'LiftX100', href: '/products/liftx100' },
];

export const COMPANY_LINKS: NavLink[] = [
  { label: 'Mission', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Updates', href: '/updates' },
  { label: 'Contact', href: '/contact' },
];
```

These values are copied verbatim from `Header.tsx`'s current inline arrays. Do not change any label or href.

- [ ] **Step 2: Point Header at it**

In `src/components/Header/Header.tsx`, delete the inline `productItems` and `navItems` array literals and add:

```ts
import { PRODUCT_LINKS, COMPANY_LINKS } from '@/lib/nav';
```

Then replace usages: `productItems` becomes `PRODUCT_LINKS`, `navItems` becomes `COMPANY_LINKS`. Leave the commented-out `companyItems` block alone.

- [ ] **Step 3: Verify the Header is unchanged**

```bash
npm run dev
```

Screenshot `http://localhost:3000/about` (a route that shows the Header). Open the products dropdown and confirm all five products appear in the same order with working links.

- [ ] **Step 4: Verify build and commit**

```bash
npm run build
npm run lint
```

```bash
git add src/lib/nav.ts src/components/Header/Header.tsx
git commit -m "Nav: extract link data to src/lib/nav.ts

Header hardcoded its product and company links inline. The homepage overlay
menu needs the same set, and two copies drift the first time a product ships."
```

---

### Task 6: Motion primitives

**Files:**
- Modify: `package.json` (add `gsap`, `@gsap/react`)
- Create: `src/components/motion/gsap-setup.ts`
- Create: `src/components/motion/Reveal.tsx`
- Create: `src/components/motion/SplitHeading.tsx`
- Create: `src/components/motion/Pin.tsx`
- Create: `src/components/motion/index.ts`

**Interfaces:**
- Produces:
  - `<Reveal y?: number, delay?: number, className?: string, as?: 'div'|'section'>` — fades and lifts children on enter
  - `<SplitHeading text: string, className?: string, as?: 'h1'|'h2'>` — per-character reveal
  - `<Pin className?: string, endOffset?: string>` — pins children while scrolling past

**Note on `useGsapScope`:** the spec named a hand-rolled hook. Use `@gsap/react`'s official `useGSAP` instead — it *is* a `gsap.context()` wrapper with correct React 19 cleanup, and reimplementing it would be strictly worse. Same intent, better mechanism.

- [ ] **Step 1: Install**

```bash
npm install gsap @gsap/react
```

- [ ] **Step 2: Central plugin registration**

Create `src/components/motion/gsap-setup.ts`:

```ts
'use client';

/* Registers plugins exactly once. Importing this from every motion component
   is safe — registerPlugin is idempotent — and avoids each primitive having to
   remember the full plugin list. */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, useGSAP);

export { gsap, ScrollTrigger, ScrollSmoother, SplitText, useGSAP };
```

- [ ] **Step 3: Reveal**

Create `src/components/motion/Reveal.tsx`:

```tsx
'use client';

/* Fades and lifts its children as they enter the viewport.

   Children are server-rendered and arrive as props, so this client boundary
   costs nothing in the static export — the copy is still in the HTML. */

import React, { useRef } from 'react';
import { gsap, useGSAP } from './gsap-setup';

export interface RevealProps {
  children: React.ReactNode;
  y?: number;
  delay?: number;
  className?: string;
}

export const Reveal: React.FC<RevealProps> = ({ children, y = 28, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(ref.current, {
          opacity: 0,
          y,
          duration: 0.9,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 85%' },
        });
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.from(ref.current, {
          opacity: 0,
          duration: 0.3,
          delay,
          scrollTrigger: { trigger: ref.current, start: 'top 92%' },
        });
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

export default Reveal;
```

- [ ] **Step 4: SplitHeading**

Create `src/components/motion/SplitHeading.tsx`:

```tsx
'use client';

/* Per-character headline reveal.

   Takes `text` as a string rather than children because SplitText rewrites the
   DOM inside the element; passing arbitrary children would let it shred nested
   markup. The plain text is still server-rendered inside the heading. */

import React, { useRef } from 'react';
import { gsap, SplitText, useGSAP } from './gsap-setup';

export interface SplitHeadingProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}

export const SplitHeading: React.FC<SplitHeadingProps> = ({ text, className = '', as = 'h2' }) => {
  const ref = useRef<HTMLHeadingElement>(null);
  const Tag = as;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const split = new SplitText(ref.current, { type: 'chars,words' });
        gsap.from(split.chars, {
          opacity: 0,
          yPercent: 110,
          duration: 0.8,
          ease: 'power4.out',
          stagger: 0.014,
          scrollTrigger: { trigger: ref.current, start: 'top 80%' },
        });
        return () => split.revert();
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.from(ref.current, {
          opacity: 0,
          duration: 0.3,
          scrollTrigger: { trigger: ref.current, start: 'top 90%' },
        });
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <Tag ref={ref} className={className}>
      {text}
    </Tag>
  );
};

export default SplitHeading;
```

- [ ] **Step 5: Pin**

Create `src/components/motion/Pin.tsx`:

```tsx
'use client';

/* Pins its children in place while the page scrolls past.

   Under reduced motion nothing is pinned — the section simply scrolls
   normally, which is the correct degradation rather than a broken one. */

import React, { useRef } from 'react';
import { gsap, ScrollTrigger, useGSAP } from './gsap-setup';

export interface PinProps {
  children: React.ReactNode;
  className?: string;
  /** How far past the top the pin holds. ScrollTrigger `end` syntax. */
  end?: string;
}

export const Pin: React.FC<PinProps> = ({ children, className = '', end = '+=80%' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const st = ScrollTrigger.create({
          trigger: ref.current,
          start: 'top top',
          end,
          pin: true,
          pinSpacing: true,
        });
        return () => st.kill();
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

export default Pin;
```

- [ ] **Step 6: Barrel export**

Create `src/components/motion/index.ts`:

```ts
export * from './Reveal';
export * from './SplitHeading';
export * from './Pin';
```

- [ ] **Step 7: Verify it compiles and commit**

```bash
npm run build
npm run lint
```

Both must exit 0. Nothing renders yet — Task 8 is the first consumer.

```bash
git add package.json package-lock.json src/components/motion
git commit -m "Motion: add GSAP primitives with reduced-motion branches

Reveal, SplitHeading and Pin, each built inside gsap.matchMedia() so the
reduced-motion path is a first-class branch rather than an afterthought.
Uses @gsap/react's useGSAP for context scoping and React 19 cleanup."
```

---

### Task 7: HomeMotionProvider and the theme arc

**Files:**
- Create: `src/components/home/HomeMotionProvider.tsx`
- Modify: `src/app/globals.css` (append the `.home` block)

**Interfaces:**
- Consumes: `gsap-setup` from Task 6
- Produces: `<HomeMotionProvider>` rendering `#smooth-wrapper > #smooth-content`; writes `--page-progress` 0→1 onto `.home`.

- [ ] **Step 1: Add the theme arc CSS**

Append to the end of `src/app/globals.css`:

```css
/* ========================================
   HOMEPAGE THEME ARC
   The light-to-dark journey derives entirely from --page-progress, which
   HomeMotionProvider drives from 0 to 1 across the stats -> capability grid
   boundary. One tween, no React re-renders.

   Interpolation is in oklab: a straight sRGB blend from lavender to near-black
   passes through a muddy desaturated grey right where the change is most
   visible.
   ======================================== */

.home {
  --page-progress: 0;
  --page-bg: color-mix(in oklab, var(--color-lav), var(--color-card) calc(var(--page-progress) * 100%));
  --page-fg: color-mix(in oklab, var(--color-ink), white calc(var(--page-progress) * 100%));

  background: var(--page-bg);
  color: var(--page-fg);
}

/* Sections opt into the arc rather than hardcoding colours. */
.home-surface {
  background: var(--page-bg);
  color: var(--page-fg);
}

.home-rule {
  border-color: color-mix(in oklab, var(--page-fg) 22%, transparent);
}
```

- [ ] **Step 2: Write the provider**

Create `src/components/home/HomeMotionProvider.tsx`:

```tsx
'use client';

/* Owns exactly two things: ScrollSmoother, and the single --page-progress
   scalar that the light-to-dark theme arc derives from. It knows nothing about
   any section's internals.

   position:fixed elements MUST be rendered outside this component. Smoother
   transforms #smooth-content, which creates a new containing block, so fixed
   children would anchor to the content instead of the viewport. */

import React, { useRef } from 'react';
import { gsap, ScrollSmoother, ScrollTrigger, useGSAP } from '../motion/gsap-setup';

export interface HomeMotionProviderProps {
  children: React.ReactNode;
  /** Selector for the element the arc is measured against. */
  arcTrigger?: string;
}

export const HomeMotionProvider: React.FC<HomeMotionProviderProps> = ({
  children,
  arcTrigger = '#stats-band',
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const smoother = ScrollSmoother.create({
          wrapper: '#smooth-wrapper',
          content: '#smooth-content',
          smooth: 1.2,
          effects: true,
          normalizeScroll: true,
        });

        const home = document.querySelector('.home');
        const trigger = document.querySelector(arcTrigger);

        const arc = trigger
          ? gsap.to(home, {
              '--page-progress': 1,
              ease: 'none',
              scrollTrigger: {
                trigger,
                start: 'top 60%',
                end: 'bottom top',
                scrub: true,
              },
            })
          : null;

        return () => {
          arc?.scrollTrigger?.kill();
          arc?.kill();
          smoother.kill();
        };
      });

      /* Reduced motion: no smoothing, no scrub. The page still darkens, but as
         a discrete step when the grid arrives rather than a scrubbed gradient. */
      mm.add('(prefers-reduced-motion: reduce)', () => {
        const home = document.querySelector('.home');
        const trigger = document.querySelector(arcTrigger);
        if (!trigger) return;

        const st = ScrollTrigger.create({
          trigger,
          start: 'bottom 60%',
          onEnter: () => gsap.set(home, { '--page-progress': 1 }),
          onLeaveBack: () => gsap.set(home, { '--page-progress': 0 }),
        });

        return () => st.kill();
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref}>
      <div id="smooth-wrapper">
        <div id="smooth-content">{children}</div>
      </div>
    </div>
  );
};

export default HomeMotionProvider;
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
npm run lint
```

Not wired into the page yet — Task 12 composes it.

```bash
git add src/components/home/HomeMotionProvider.tsx src/app/globals.css
git commit -m "Home: add motion provider and CSS theme arc

The provider owns only ScrollSmoother and one --page-progress scalar; every
visual consequence of the light-to-dark journey derives from that variable in
plain CSS, interpolated in oklab to avoid a muddy grey midpoint."
```

---

### Task 8: Positioning statement section

**Files:**
- Create: `src/components/home/sections/PositioningStatement.tsx`

**Interfaces:**
- Consumes: `SplitHeading`, `Reveal`, `Pin` from `@/components/motion`
- Produces: `<PositioningStatement headline: string, sub: string>` — a **server** component.

This is the beat the spec describes as "one pinned headline, per-character reveal", and it is the only consumer of `Pin`. If you drop the pin here, delete `Pin` from Task 6 rather than leaving it unused.

- [ ] **Step 1: Write the section**

Create `src/components/home/sections/PositioningStatement.tsx`:

```tsx
/* Server component. The one claim the page makes before it starts listing
   capabilities. Motion lives entirely in the imported client primitives, so
   this copy is present in the static export.

   The headline holds in place while the page scrolls past it, then releases —
   the first real scroll moment after the hero. */

import React from 'react';
import { SplitHeading, Reveal, Pin } from '@/components/motion';

export interface PositioningStatementProps {
  headline: string;
  sub: string;
}

export const PositioningStatement: React.FC<PositioningStatementProps> = ({ headline, sub }) => (
  <section id="positioning" className="home-surface">
    <Pin
      end="+=70%"
      className="flex min-h-svh items-center px-[clamp(24px,3.05vw,44px)] py-[clamp(80px,14vh,180px)]"
    >
      <div className="mx-auto w-full max-w-[1400px]">
        <SplitHeading
          as="h2"
          text={headline}
          className="font-display text-[clamp(34px,6.2vw,92px)] font-bold uppercase leading-[0.98] tracking-[-0.02em]"
        />
        <Reveal delay={0.15} className="mt-[clamp(24px,4vh,56px)] max-w-[640px]">
          <p className="text-[clamp(15px,1.35vw,21px)] leading-[1.5] opacity-70">{sub}</p>
        </Reveal>
      </div>
    </Pin>
  </section>
);

export default PositioningStatement;
```

- [ ] **Step 2: Sanity-check the pin against the arc**

Pinning adds scroll distance, which shifts where `#stats-band` reaches the viewport and therefore where the theme arc fires. After Task 12 composes the page, if the background starts darkening too early or too late, adjust `end` here rather than retuning the trigger in `HomeMotionProvider` — the pin length is the cause.

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
npm run lint
```

```bash
git add src/components/home/sections/PositioningStatement.tsx
git commit -m "Home: add positioning statement section"
```

---

### Task 9: Stats band

**Files:**
- Create: `src/components/home/sections/StatsBand.tsx`
- Create: `src/components/home/HomeCounter.tsx`

**Interfaces:**
- Produces:
  - `export interface HomeStat { value: number; label: string; prefix?: string; suffix?: string }`
  - `<StatsBand stats: HomeStat[]>` — server component, renders `id="stats-band"` (the arc trigger from Task 7)
  - `<HomeCounter value, label, prefix?, suffix?>` — client component

**Why a new counter:** the existing `src/components/Counter` is a dark-theme CSS-Module component. Its IntersectionObserver logic is sound and is reproduced here, but restyling it for the light theme would change a component eleven other routes may rely on.

- [ ] **Step 1: Write the counter**

Create `src/components/home/HomeCounter.tsx`:

```tsx
'use client';

/* Counts up when scrolled into view. Renders the final value as its initial
   text so the real number is in the static HTML and remains correct if JS
   never runs. */

import React, { useEffect, useRef, useState } from 'react';

export interface HomeCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export const HomeCounter: React.FC<HomeCounterProps> = ({
  value,
  label,
  prefix = '',
  suffix = '',
  duration = 1800,
}) => {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    setDisplay(0);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || done.current) return;
          done.current = true;

          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.floor(value * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <span className="font-display text-[clamp(40px,5.4vw,84px)] font-bold leading-none tracking-[-0.02em] tabular-nums">
        {prefix}
        {display}
        {suffix}
      </span>
      <span className="text-[clamp(11px,0.9vw,13px)] font-bold uppercase tracking-[0.16em] opacity-60">
        {label}
      </span>
    </div>
  );
};

export default HomeCounter;
```

- [ ] **Step 2: Write the band**

Create `src/components/home/sections/StatsBand.tsx`:

```tsx
/* Server component. Carries id="stats-band", which HomeMotionProvider uses as
   the trigger for the light-to-dark arc — the page darkens while these are
   still on screen. */

import React from 'react';
import { Reveal } from '@/components/motion';
import { HomeCounter } from '../HomeCounter';

export interface HomeStat {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}

export interface StatsBandProps {
  stats: HomeStat[];
}

export const StatsBand: React.FC<StatsBandProps> = ({ stats }) => (
  <section
    id="stats-band"
    className="home-surface px-[clamp(24px,3.05vw,44px)] py-[clamp(80px,14vh,160px)]"
  >
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-x-8 gap-y-[clamp(40px,6vh,72px)] lg:grid-cols-4">
      {stats.map((stat, i) => (
        <Reveal key={stat.label} delay={i * 0.08}>
          <HomeCounter {...stat} />
        </Reveal>
      ))}
    </div>
  </section>
);

export default StatsBand;
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
npm run lint
```

```bash
git add src/components/home/sections/StatsBand.tsx src/components/home/HomeCounter.tsx
git commit -m "Home: add stats band with light-theme counter

Reimplements the counter rather than restyling src/components/Counter, which
eleven other routes may rely on. Renders the final value as initial text so the
real figure is in the static HTML."
```

---

### Task 10: Capability grid

**Files:**
- Create: `src/components/home/sections/CapabilityGrid.tsx`

**Interfaces:**
- Produces:
  - `export interface Capability { title: string; body: string; index: string }`
  - `<CapabilityGrid capabilities: Capability[]>` — server component

- [ ] **Step 1: Write the section**

Create `src/components/home/sections/CapabilityGrid.tsx`:

```tsx
/* Server component. First fully-dark beat — by the time this is centred,
   --page-progress has reached 1. */

import React from 'react';
import { Reveal, SplitHeading } from '@/components/motion';

export interface Capability {
  /** Two-digit ordinal, e.g. "01". */
  index: string;
  title: string;
  body: string;
}

export interface CapabilityGridProps {
  heading: string;
  capabilities: Capability[];
}

export const CapabilityGrid: React.FC<CapabilityGridProps> = ({ heading, capabilities }) => (
  <section
    id="capabilities"
    className="home-surface px-[clamp(24px,3.05vw,44px)] py-[clamp(80px,14vh,180px)]"
  >
    <div className="mx-auto w-full max-w-[1400px]">
      <SplitHeading
        as="h2"
        text={heading}
        className="mb-[clamp(48px,8vh,110px)] max-w-[900px] font-display text-[clamp(28px,4.4vw,64px)] font-bold uppercase leading-[1.02] tracking-[-0.02em]"
      />

      <div className="grid gap-px md:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((cap, i) => (
          <Reveal key={cap.index} delay={(i % 3) * 0.08}>
            <article className="home-rule flex h-full flex-col gap-4 border-t pt-7">
              <span className="font-mono text-xs tracking-[0.2em] opacity-45">{cap.index}</span>
              <h3 className="font-display text-[clamp(18px,1.7vw,25px)] font-bold uppercase tracking-[-0.01em]">
                {cap.title}
              </h3>
              <p className="text-[clamp(14px,1.05vw,16px)] leading-[1.55] opacity-65">{cap.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default CapabilityGrid;
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
npm run lint
```

```bash
git add src/components/home/sections/CapabilityGrid.tsx
git commit -m "Home: add capability grid"
```

---

### Task 11: Product row

**Files:**
- Create: `src/components/home/sections/ProductRow.tsx`

**Interfaces:**
- Consumes: `PRODUCT_LINKS` from `@/lib/nav` (Task 5)
- Produces:
  - `export interface ProductCard { label: string; href: string; image: string; blurb: string }`
  - `<ProductRow products: ProductCard[]>` — server component

**Image note:** use plain `<img>`, not `next/image`. The project sets `images.unoptimized: true` under static export, so `next/image` adds no value and complicates the markup.

- [ ] **Step 1: Write the section**

Create `src/components/home/sections/ProductRow.tsx`:

```tsx
/* Server component. Products link to their existing detail routes and reuse
   the imagery already in /public/images — no new photography. */

import React from 'react';
import { Reveal, SplitHeading } from '@/components/motion';

export interface ProductCard {
  label: string;
  href: string;
  image: string;
  blurb: string;
}

export interface ProductRowProps {
  heading: string;
  products: ProductCard[];
}

export const ProductRow: React.FC<ProductRowProps> = ({ heading, products }) => (
  <section
    id="products"
    className="home-surface px-[clamp(24px,3.05vw,44px)] py-[clamp(80px,14vh,180px)]"
  >
    <div className="mx-auto w-full max-w-[1400px]">
      <SplitHeading
        as="h2"
        text={heading}
        className="mb-[clamp(40px,7vh,90px)] font-display text-[clamp(28px,4.4vw,64px)] font-bold uppercase leading-[1.02] tracking-[-0.02em]"
      />

      <div className="grid gap-[clamp(16px,2vw,28px)] sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => (
          <Reveal key={p.href} delay={(i % 3) * 0.08}>
            <a href={p.href} className="group block no-underline">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[clamp(10px,1vw,16px)] bg-card">
                <img
                  src={p.image}
                  alt={p.label}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.3,1)] group-hover:scale-105"
                />
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-4">
                <h3 className="font-display text-[clamp(16px,1.5vw,22px)] font-bold uppercase tracking-[-0.01em]">
                  {p.label}
                </h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-45 transition-opacity group-hover:opacity-90">
                  View
                </span>
              </div>
              <p className="mt-2 text-[clamp(13px,1vw,15px)] leading-[1.5] opacity-60">{p.blurb}</p>
            </a>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default ProductRow;
```

- [ ] **Step 2: Confirm the product images exist**

```bash
ls public/images/ | grep -i "liftx\|cyclops\|noxr\|p10"
```

Note the exact filenames and casing — a previous commit fixed a LIFTX100 casing bug, and static hosting is case-sensitive. Use exactly what this lists when you populate `PRODUCTS` in Task 12.

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
npm run lint
```

```bash
git add src/components/home/sections/ProductRow.tsx
git commit -m "Home: add product row"
```

---

### Task 12: CTA, footer, and page composition

This is where the page first renders end to end.

**Files:**
- Create: `src/components/home/sections/HomeCTA.tsx`
- Create: `src/components/home/HomeFooter.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: every section from Tasks 8-11, `HomeMotionProvider` from Task 7, `PRODUCT_LINKS`/`COMPANY_LINKS` from Task 5
- Produces: the composed homepage.

- [ ] **Step 1: Write the CTA**

Create `src/components/home/sections/HomeCTA.tsx`:

```tsx
import React from 'react';
import { SplitHeading } from '@/components/motion';

export interface HomeCTAProps {
  headline: string;
  href?: string;
  label?: string;
}

export const HomeCTA: React.FC<HomeCTAProps> = ({
  headline,
  href = '/contact',
  label = "Let's talk",
}) => (
  <section className="home-surface px-[clamp(24px,3.05vw,44px)] py-[clamp(90px,18vh,220px)]">
    <div className="mx-auto w-full max-w-[1400px]">
      <SplitHeading
        as="h2"
        text={headline}
        className="max-w-[1100px] font-display text-[clamp(32px,5.6vw,86px)] font-bold uppercase leading-[0.98] tracking-[-0.02em]"
      />
      <a
        href={href}
        className="mt-[clamp(32px,5vh,64px)] inline-flex items-center gap-2.5 rounded-full bg-pill-dark px-8 py-4 text-sm font-medium uppercase tracking-[0.02em] text-white no-underline transition-transform duration-300 hover:-translate-y-0.5"
      >
        {label}
        <i className="h-1.5 w-1.5 rounded-full bg-flare" />
      </a>
    </div>
  </section>
);

export default HomeCTA;
```

- [ ] **Step 2: Write the footer**

Create `src/components/home/HomeFooter.tsx`:

```tsx
/* The homepage's own footer. The shared Footer stays suppressed on / via
   ChromeGate and is not restyled. */

import React from 'react';
import { PRODUCT_LINKS, COMPANY_LINKS } from '@/lib/nav';

export const HomeFooter: React.FC = () => (
  <footer className="home-surface px-[clamp(24px,3.05vw,44px)] pb-[clamp(32px,5vh,56px)] pt-[clamp(48px,8vh,90px)]">
    <div className="home-rule mx-auto w-full max-w-[1400px] border-t pt-[clamp(32px,5vh,60px)]">
      <div className="grid gap-[clamp(32px,5vh,56px)] md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <span className="font-display text-[clamp(19px,1.8vw,26px)] font-bold uppercase tracking-[0.01em]">
            DroneAnatomy
          </span>
          <p className="mt-4 max-w-[320px] text-sm leading-[1.55] opacity-55">
            Autonomous aerial systems, designed and manufactured in India.
          </p>
        </div>

        <nav aria-label="Products">
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">Products</h2>
          <ul className="flex flex-col gap-2.5">
            {PRODUCT_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-sm no-underline opacity-75 transition-opacity hover:opacity-100">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">Company</h2>
          <ul className="flex flex-col gap-2.5">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-sm no-underline opacity-75 transition-opacity hover:opacity-100">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="/privacy" className="text-sm no-underline opacity-75 transition-opacity hover:opacity-100">
                Privacy
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </footer>
);

export default HomeFooter;
```

- [ ] **Step 3: Compose the page**

Replace `src/app/page.tsx` entirely:

```tsx
import { HeroCluster } from '@/components/HeroCluster/HeroCluster';
import { HomeMotionProvider } from '@/components/home/HomeMotionProvider';
import { PositioningStatement } from '@/components/home/sections/PositioningStatement';
import { StatsBand, type HomeStat } from '@/components/home/sections/StatsBand';
import { CapabilityGrid, type Capability } from '@/components/home/sections/CapabilityGrid';
import { ProductRow, type ProductCard } from '@/components/home/sections/ProductRow';
import { HomeCTA } from '@/components/home/sections/HomeCTA';
import { HomeFooter } from '@/components/home/HomeFooter';

export const metadata = {
  title: 'DroneAnatomy - Advanced Aerial Solutions',
  description:
    'DroneAnatomy provides cutting-edge drone technology for enterprise, commercial, and consumer applications.',
};

/* PLACEHOLDER — real figures required before launch. See the spec. */
const STATS: HomeStat[] = [
  { value: 12, label: 'Systems in field', suffix: '+' },
  { value: 4200, label: 'Flight hours logged', suffix: '+' },
  { value: 98, label: 'Mission success rate', suffix: '%' },
  { value: 5, label: 'Platforms in production' },
];

/* PLACEHOLDER — real copy required before launch. See the spec. */
const CAPABILITIES: Capability[] = [
  { index: '01', title: 'Autonomous navigation', body: 'GNSS-denied flight with onboard state estimation, so missions continue when the signal does not.' },
  { index: '02', title: 'EO/IR sensing', body: 'Day and thermal imaging on a single gimbal, with operator-selectable palettes and on-board capture.' },
  { index: '03', title: 'Extended endurance', body: 'Airframes and power systems designed around loiter time rather than peak speed.' },
  { index: '04', title: 'Ruggedised airframes', body: 'Field-serviceable structures rated for high-altitude and high-wind operation.' },
  { index: '05', title: 'Secure datalink', body: 'Encrypted command and telemetry with graceful degradation and autonomous return-to-home.' },
  { index: '06', title: 'Indigenous manufacture', body: 'Designed and built in India, reducing supply-chain dependency and export exposure.' },
];

/* Image filenames must match /public/images exactly — static hosting is
   case-sensitive. Verify with: ls public/images */
const PRODUCTS: ProductCard[] = [
  { label: 'P10 Pro', href: '/products/p10-pro', image: '/images/liftx100.jpg', blurb: 'Long-endurance survey and inspection platform.' },
  { label: 'NOXR-1', href: '/products/noxr-1', image: '/images/NOXR-COMING-SOON.jpg', blurb: 'Autonomous system for contested and GNSS-denied airspace.' },
  { label: 'Cyclops 3', href: '/products/cyclops-3', image: '/images/CYCLOPS3.jpg', blurb: 'EO/IR observation platform for persistent surveillance.' },
  { label: 'Cyclops Mini', href: '/products/cyclops-mini', image: '/images/CYCLOPS.jpg', blurb: 'Compact short-range reconnaissance airframe.' },
  { label: 'LiftX100', href: '/products/liftx100', image: '/images/liftx100.jpg', blurb: 'Heavy-lift platform for payload and logistics missions.' },
];

export default function Home() {
  return (
    <HomeMotionProvider>
      <div className="home">
        <HeroCluster
          wordmark="DroneAnatomy"
          tagline="We build the autonomous systems that define the next era of flight."
          imageSrc="/images/site-day.webp"
          thermalSrc="/images/site-thermal.webp"
        />

        <PositioningStatement
          headline="Outcomes, not specifications."
          sub="We design from failure to prevention to reliability, building the systems that make autonomous aviation dependable at scale."
        />

        <StatsBand stats={STATS} />

        <CapabilityGrid heading="What our systems do" capabilities={CAPABILITIES} />

        <ProductRow heading="Platforms" products={PRODUCTS} />

        <HomeCTA headline="Tell us what you need to fly." />

        <HomeFooter />
      </div>
    </HomeMotionProvider>
  );
}
```

- [ ] **Step 4: Fix the P10 Pro image**

`PRODUCTS` above uses `liftx100.jpg` twice as a deliberate stand-in. Run `ls public/images` and substitute the correct P10 Pro image. If none exists, leave the stand-in and note it — do not invent a filename that will 404.

- [ ] **Step 5: Verify the full page renders**

```bash
npm run dev
```

Screenshot `http://localhost:3000` at 1440x900, then scroll through the whole page taking screenshots at roughly 25% intervals.

Confirm:
1. All six beats render in order.
2. The background genuinely transitions from lavender to near-black across the stats → capability grid boundary.
3. Text stays legible throughout the transition — nothing goes dark-on-dark or light-on-light.
4. Scrolling feels smooth (ScrollSmoother is active).
5. No console errors.

- [ ] **Step 6: Verify the static export contains the copy**

```bash
npm run build
grep -c "Outcomes, not specifications" out/index.html
grep -c "GNSS-denied" out/index.html
grep -c "Indigenous manufacture" out/index.html
```

All three must return non-zero. If any returns 0, a section was accidentally marked `'use client'`.

- [ ] **Step 7: Commit**

```bash
npm run lint
git add src/app/page.tsx src/components/home
git commit -m "Home: compose the full page

Six beats from hero to footer, with placeholder stats and capability copy
marked for replacement before launch. Sections stay server components so all
copy lands in the static export."
```

---

### Task 13: Overlay menu and sticky mini-nav

**Files:**
- Create: `src/components/home/nav/OverlayMenu.tsx`
- Create: `src/components/home/nav/StickyMiniNav.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/HeroCluster/HeroCluster.tsx`

**Interfaces:**
- Consumes: `PRODUCT_LINKS`, `COMPANY_LINKS` from `@/lib/nav`
- Produces: `<OverlayMenu>` and `<StickyMiniNav>`, both **rendered outside `HomeMotionProvider`**.

**Critical:** both are `position: fixed`. They must be siblings of `HomeMotionProvider`, never children — ScrollSmoother transforms `#smooth-content`, creating a new containing block that would anchor them to the content instead of the viewport.

- [ ] **Step 1: Write the overlay menu**

Create `src/components/home/nav/OverlayMenu.tsx`:

```tsx
'use client';

/* Full-screen navigation. Rendered OUTSIDE HomeMotionProvider because it is
   position:fixed — see the ScrollSmoother containing-block caveat. */

import React, { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/components/motion/gsap-setup';
import { PRODUCT_LINKS, COMPANY_LINKS } from '@/lib/nav';

export const OverlayMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* The trigger lives in the hero, which is a server component, so they talk
     via a custom event rather than shared React state. */
  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener('da:toggle-menu', onToggle);
    return () => window.removeEventListener('da:toggle-menu', onToggle);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  useGSAP(
    () => {
      if (!open) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-menu-link]', {
          opacity: 0,
          yPercent: 60,
          duration: 0.65,
          ease: 'power3.out',
          stagger: 0.045,
        });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [open] }
  );

  return (
    <div
      ref={ref}
      aria-hidden={!open}
      className={`fixed inset-0 z-50 bg-card text-white transition-opacity duration-500 ${
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="flex h-full flex-col px-[clamp(24px,3.05vw,44px)] py-[clamp(28px,4.6vh,50px)]">
        <div className="flex items-center justify-between">
          <span className="font-display text-[clamp(19px,1.8vw,26px)] font-bold uppercase">DroneAnatomy</span>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full bg-white/10 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.02em] transition-colors hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <div className="mt-auto grid gap-[clamp(32px,6vh,64px)] md:grid-cols-2">
          <nav aria-label="Products">
            <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">Products</h2>
            <ul className="flex flex-col gap-3">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href} className="overflow-hidden">
                  <a
                    data-menu-link
                    href={l.href}
                    className="block font-display text-[clamp(26px,3.6vw,52px)] font-bold uppercase leading-[1.05] no-underline opacity-85 transition-opacity hover:opacity-100"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">Company</h2>
            <ul className="flex flex-col gap-3">
              {COMPANY_LINKS.map((l) => (
                <li key={l.href} className="overflow-hidden">
                  <a
                    data-menu-link
                    href={l.href}
                    className="block font-display text-[clamp(26px,3.6vw,52px)] font-bold uppercase leading-[1.05] no-underline opacity-85 transition-opacity hover:opacity-100"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default OverlayMenu;
```

- [ ] **Step 2: Write the sticky mini-nav**

Create `src/components/home/nav/StickyMiniNav.tsx`:

```tsx
'use client';

/* Fades in once the hero is scrolled past. Colours derive from --page-progress
   so the bar stays legible across the light-to-dark transition without needing
   its own ScrollTrigger.

   Rendered OUTSIDE HomeMotionProvider — position:fixed. */

import React, { useEffect, useState } from 'react';

export const StickyMiniNav: React.FC = () => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-40 flex items-center justify-between
        px-[clamp(24px,3.05vw,44px)] py-4 transition-all duration-500
        ${shown ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'}`}
      style={{
        background: 'color-mix(in oklab, var(--page-bg) 82%, transparent)',
        color: 'var(--page-fg)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <a href="/" className="font-display text-base font-bold uppercase tracking-[0.01em] no-underline">
        DroneAnatomy
      </a>
      <div className="flex items-center gap-2.5">
        <a
          href="/contact"
          className="rounded-full bg-pill-dark px-5 py-2.5 text-xs font-medium uppercase tracking-[0.02em] text-white no-underline"
        >
          Let&rsquo;s talk
        </a>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('da:toggle-menu'))}
          className="rounded-full px-5 py-2.5 text-xs font-medium uppercase tracking-[0.02em]"
          style={{ background: 'color-mix(in oklab, var(--page-fg) 12%, transparent)' }}
        >
          Menu &middot;&middot;
        </button>
      </div>
    </div>
  );
};

export default StickyMiniNav;
```

- [ ] **Step 3: Wire the hero's Menu pill**

`HeroCluster` is a server component and cannot hold an `onClick`. Create the smallest possible client button.

Create `src/components/home/nav/MenuTrigger.tsx`:

```tsx
'use client';

import React from 'react';

export const MenuTrigger: React.FC<{ className?: string }> = ({ className = '' }) => (
  <button className={className} onClick={() => window.dispatchEvent(new CustomEvent('da:toggle-menu'))}>
    Menu &middot;&middot;
  </button>
);

export default MenuTrigger;
```

In `src/components/HeroCluster/HeroCluster.tsx`, import it and replace the inert Menu button:

```tsx
import { MenuTrigger } from '@/components/home/nav/MenuTrigger';
```

```tsx
<MenuTrigger className={`${pillBase} bg-pill px-[22px] py-3.5 text-ink hover:bg-pill-hover`} />
```

Also delete the inert "Collapse" `pillIcon` button — it has no behaviour and no purpose now that the Menu works.

- [ ] **Step 4: Mount both outside the provider**

In `src/app/page.tsx`, wrap the return:

```tsx
return (
  <>
    <StickyMiniNav />
    <OverlayMenu />
    <HomeMotionProvider>
      <div className="home">
        {/* ...unchanged... */}
      </div>
    </HomeMotionProvider>
  </>
);
```

with the imports added at the top. **Do not** move them inside `HomeMotionProvider`.

- [ ] **Step 5: Verify navigation works**

```bash
npm run dev
```

Via Playwright:
1. Click the hero's `Menu ··` pill → overlay opens with staggered links.
2. Press `Escape` → overlay closes.
3. Scroll past the hero → sticky bar fades in, and its background tracks the page's darkening.
4. Click the sticky bar's `Menu ··` → overlay opens.
5. Click a product link → navigates to that product page.
6. Confirm the sticky bar stays pinned to the **viewport** while scrolling. If it drifts with the content, it was mounted inside the smoother.

- [ ] **Step 6: Verify build and commit**

```bash
npm run build
npm run lint
```

```bash
git add src/components/home/nav src/app/page.tsx src/components/HeroCluster/HeroCluster.tsx
git commit -m "Home: add overlay menu and sticky mini-nav

Closes the dead end where the homepage had no route to products, about,
careers or updates: the Menu pill was inert and ChromeGate suppresses the
shared Header on /.

Both are position:fixed and mounted outside HomeMotionProvider — ScrollSmoother
transforms #smooth-content, which would otherwise anchor them to the content
rather than the viewport."
```

---

### Task 14: Final verification pass

No new code. This task proves the constraints held.

- [ ] **Step 1: Legacy routes are unchanged**

```bash
npm run dev
```

Screenshot all of these at 1440x900 and compare against `main`:

- `/about`
- `/careers`
- `/contact`
- `/products`
- `/products/p10-pro`

To get a reference, `git stash` your work, screenshot, then `git stash pop`. Any visual difference means Preflight leaked or a shared component changed.

- [ ] **Step 2: Reduced motion**

Via Playwright, emulate `prefers-reduced-motion: reduce` and reload the homepage.

Confirm:
1. The page still scrolls normally (ScrollSmoother is not created).
2. Nothing is pinned.
3. Content is visible — no element is stuck at `opacity: 0`.
4. The theme still reaches dark by the capability grid.
5. Counters show their final values.

- [ ] **Step 3: Static export integrity**

```bash
npm run build
grep -c "DroneAnatomy" out/index.html
grep -c "Outcomes, not specifications" out/index.html
grep -c "GNSS-denied" out/index.html
grep -c "Cyclops Mini" out/index.html
ls out/products/p10-pro/index.html
```

Every `grep` must be non-zero and the product page must exist.

- [ ] **Step 4: No broken images**

```bash
npm run dev
```

Load the homepage and check the browser console and network panel for any 404s on `/images/`. Static hosting is case-sensitive; a previous commit already fixed one casing bug.

- [ ] **Step 5: Lint clean**

```bash
npm run lint
```

Must exit 0 with no warnings introduced by this work.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "Home: final verification pass

Confirms legacy routes unchanged, reduced-motion path degrades correctly,
static export contains all section copy, and no image 404s."
```

---

## Outstanding before launch

These are **not** implementation tasks — they need input from the client and must be resolved before this ships:

1. **Real stat figures.** `STATS` in `src/app/page.tsx` is marked `PLACEHOLDER`.
2. **Real capability copy.** `CAPABILITIES` likewise — the current entries are plausible but invented, and several make specific technical claims (GNSS-denied flight, encrypted datalink, mission success rate) that must be verified as true before publication.
3. **P10 Pro product image.** Currently reuses the LiftX100 image as a stand-in.
4. **Stock licence.** The hero aerial is a Pexels image by Cédric Estienne; commercial use should be confirmed.
