# Mini Viewer — Hotspots and Elastic Camera

Date: 2026-09-05
Branch: `redesign/homepage-v2`
Status: Draft — pending review

## Goal

Turn the Mini's 3D viewer from a free-orbit turntable into a guided inspection:
four named features anchored to points on the airframe, each with an authored
camera framing, selected from a list overlaid on the render. Modelled on the
interactive view at `anduril.com/altius`, but with a different control model —
the camera is elastic rather than free, and every drag is a peek that springs
back to a composed shot.

The viewer already exists (`src/components/field/MiniViewer.tsx`, 819 lines) and
already solves the hard parts: deferred loading behind a poster gate, corrected
materials for a CAD export, image-based lighting, a contact shadow, and a
crossfade out of `FieldHero`'s scrubbed sequence. None of that changes. What
changes is the control rig and what sits on top of the canvas.

## Reference — what Anduril actually does

Examined live on 2026-09-05 with a real browser, plus a screen recording
supplied by the user.

| Aspect | Anduril Altius | This spec |
|---|---|---|
| Shell | Full-viewport takeover; Lenis scroll stopped (`html.lenis-stopped`); ✕ to exit | **Boxed panel, no takeover** — stays in the 240vh sticky section |
| Entry | `button.cta` "Launch Interactive View" | Existing poster gate ("View in 3D · 2.5 MB") |
| Renderer | In-house WebGL (`GeometryRendererWebGL`, `ShaderRendererWebGL`, `FBORendererWebGL`), Lenis + Theatre.js | three.js, as today |
| Geometry | Raw `.bin` buffers split per material batch (`altius.bin`, `altius_shiny.bin`, `altius_propeller.bin`, `altius_decal.bin`) | Single Draco GLB, as today |
| Textures | `.ktx2` throughout; `.png` only for normals | `RoomEnvironment` PMREM, as today |
| Hotspots | 4 × `button.pointer`, DOM, projected per frame; hidden when occluded | Same idea, **4 hotspots, faded not hidden**, facing test not raycast |
| Labels | Drawn in-canvas via MSDF bitmap font atlas | **DOM** — accessible, and we do not need a font atlas |
| List | `Product3DAccordionItem` ×4, `+`/`−`, one open at a time, expands in place | Same, but **rows without body copy render as plain labels** |
| Camera | Flies to feature, keeps drifting after arrival | Flies via spring; **elastic drag with spring-back** |
| Stepping | ← → bottom right | Same |
| Variants | `button.variantButton` colourway switcher | **Not in scope** |

The one thing worth stealing wholesale is the idea that *the list and the model
are the same control*. The thing worth not stealing is the takeover — this
page's viewer is a figure in a scroll narrative, not a destination.

## Scope

**In scope:** `src/components/field/MiniViewer.tsx`, and the `ProductPage`
contract in `src/components/field/product.ts`.

**Out of scope:** `FieldHero` and act one, the P10 Pro page, the homepage swarm
(`FlightScene`), `loadCraft.ts`, the GLB itself, and any variant switching.

**Carve-outs — existing code changed deliberately:**

1. `OrbitControls` is removed entirely and replaced by a custom spherical rig.
   The clamps it carried (`DIST.min/max`, `minPolarAngle`, `maxPolarAngle`,
   `rotateSpeed`, `zoomSpeed`, `enableDamping`, `dampingFactor`, `enablePan`,
   `autoRotate`, `autoRotateSpeed`) all go with it. Net deletion.
2. `MiniViewer` stops hardcoding `/models/vtol.glb` and `SPAN = 3.2`. Both move
   into `MINI.viewer` in `product.ts`, so the component no longer knows which
   aircraft it renders.
3. The MINI block's comment in `product.ts` — *"The copy makes no numeric
   claims… rather than inventing specifications that would read as real"* —
   becomes false the moment "30 Min Flight Time" ships. It is rewritten in the
   same commit. The rule it was protecting (do not invent figures) still holds;
   what changed is that the user supplied a real one.
4. The section's caption copy ("Turn it over") and hint ("Drag to rotate ·
   scroll to zoom") both promise freedoms the elastic rig removes. Rewritten —
   see **Copy** below.

## Decisions

| Area | Decision |
|---|---|
| Shell | Boxed 1.9-aspect panel, in place, no scroll lock |
| List placement | Overlaid on the panel's right side over a gradient scrim |
| Control model | Elastic always — home and selected both spring to a rest pose |
| Pivot | Model centre when nothing selected; hotspot world position when selected |
| Drag | `tanh`-compressed offset, bounded excursion, springs back on release |
| Zoom | Also elastic — wheel dollies against resistance, springs back |
| Wheel arbitration | Unchanged — `pointerEvents` armed on the panel at `fade > 0.9` |
| Camera flight | The same spring. Selecting a feature changes `rest` and `pivot`; no separate tween system |
| Idle motion | Home rotates continuously; a selected pose sways on a slow sinusoid |
| Occlusion | Surface-normal facing test, not raycasting |
| Dots | DOM `<button>`s, positioned per frame from a projection, no `setState` |
| Row copy | Names now; the expansion is built but a row with no `body` renders plain |
| Feature data | `MINI.viewer` in `product.ts` |
| Authoring | Dev-only shift-click picker logs anchor + normal + current pose |
| Variants | Not in scope |

## The control rig

`OrbitControls` cannot express this. It applies drag deltas straight to its
spherical coordinates with no hook to attenuate them, and has no concept of a
rest pose to return to. It is replaced by one small object.

The load-bearing realisation: **the snap-back spring and the camera flight are
the same mechanism.** Flying to a hotspot is changing the rest pose and letting
the spring carry the camera there. No tween system, no easing curves to author,
no in-flight state to track — and interrupting a flight by grabbing mid-move
works for free, because the drag offset rides on top of a rest pose that is
still travelling.

```
state
  pivot   Vector3          model centre, or the selected hotspot's world position
  rest    {az, pol, rad}   where the camera wants to be
  cur     {az, pol, rad}   where it is
  vel     {az, pol, rad}   spring velocity
  raw     {az, pol, rad}   accumulated pointer delta, only while the pointer is down

per frame
  HOME       rest.az  = home.az + driftPhase          driftPhase += DRIFT · dt
  SELECTED   rest.az  = a0 + SWAY_AZ  · sin(t / 6)
             rest.pol = p0 + SWAY_POL · sin(t / 9)
             rest.rad = r0

  dragging   applied = LIMIT · tanh(raw / LIMIT)
             cur     = rest + applied
             vel     = 0

  released   spring cur → rest, critically damped
             spring pivot → target pivot

  always     cur.pol = clamp(cur.pol, 0.05, PI - 0.05)
  camera.position = pivot + spherical(cur)
  camera.lookAt(pivot)
```

### Why `tanh`

Near zero it is linear, so small drags track the pointer 1:1 and the control
feels direct. It asymptotes at `LIMIT`, so the excursion is bounded *softly* —
you feel the rubber band tighten rather than hitting a wall. Three independent
limits, so azimuth can be looser than polar.

```
LIMIT.az   ≈ 0.9 rad            swing well around the side
LIMIT.pol  ≈ 0.35 rad           much tighter — under the aircraft reads badly
LIMIT.rad  = 0.15 · rest.rad    PROPORTIONAL, not absolute
```

The radius limit must be proportional. Hotspot 02 is a wide side elevation and
01/03/04 are close-ups; a fixed ±0.8 world units would feel rigid on the wide
shot and mushy on the close ones.

### Shortest-path azimuth

The home rest azimuth advances forever via `driftPhase`. Deselecting after a
long read would otherwise spring the camera the long way round. The spring
computes its azimuth error as `atan2(sin(d), cos(d))` — normalised to
`(−π, π]` — so it always takes the short way.

### Spring

Critically damped, semi-implicit, one stiffness shared by all channels:

```
omega = 2π / PERIOD                    PERIOD ≈ 0.55s
vel  += (−2·omega·vel − omega²·(cur − rest)) · dt
cur  += vel · dt
```

Critically damped rather than under-damped: an overshoot on a *return* reads as
a bounce, which is charming once and irritating on the twentieth drag. The
flights get their sense of weight from distance, not from overshoot.

### Reduced motion

`prefers-reduced-motion: reduce` sets `DRIFT = 0`, `SWAY_* = 0`, and shortens
`PERIOD` to ~0.15s so selections arrive near-instantly. The elastic stays: it
responds to the user's own gesture and is not autonomous motion.

## Hotspots

**Dots are DOM buttons**, positioned by the existing render loop: project the
anchor through the camera and write `transform: translate3d(...)` straight to a
ref. No `setState` per frame — the file's existing rule holds (*"the fade and
the camera never round-trip through React"*). DOM rather than in-canvas sprites
buys focus, Enter/Space, and a screen-reader name, which Anduril's in-canvas
labels do not have.

**Occlusion by facing test, not raycast.** Four rays per frame against 294,478
triangles with no BVH is ~1.2M triangle tests per frame; throttling converts a
constant cost into a periodic hitch. Instead the picker records the surface
normal at each anchor at authoring time, and:

```
facing = dot(normal, normalize(camera.position − anchor)) > 0
```

One dot product per hotspot per frame. Exactly correct for a point on a
surface, which all four are.

Dots fade to ~0.15 opacity when facing away rather than disappearing. Anduril
hides theirs; with only four on a small airframe, popping reads as a glitch
where a fade reads as depth. Non-facing dots also get `pointer-events: none` and
`tabindex="-1"` so they cannot be clicked or tabbed to through the airframe.

**Depth ordering.** `z-index` is set from the projected depth so nearer dots
draw over farther ones.

**Selected state** matches the reference: a yellow-green ring plus a small
mono-uppercase label beside the dot. Only the selected hotspot is labelled.

## Overlay

Inside the panel's right side, over a soft dark gradient scrim (the reference
has the same vignette behind its accordion). Rows are real `<button>`s in an
ordered list.

```
┌──────────────────────────────────────────────┐
│        ✦             ┊ 01  EW CAPABLE        │
│     ╱──┬──╲          ┊ 02  CF SINGLE BODY    │
│  ●  │   │  ●    ✦    ┊ 03  30 MIN FLIGHT     │
│     ╲──┴──╱          ┊ 04  DAY & NIGHT VISION│
│        ✦             ┊                       │
│                            ( ← )  ( → )      │
└──────────────────────────────────────────────┘
```

A row with a `body` string gets a `+`/`−` and expands in place, pushing the rows
below it down, one open at a time. A row without one renders as a plain label
with no affordance — so the four ship today on names alone and gain expansion
later as a data edit with no code change.

**Keyboard.** `←`/`→` step features when the panel holds focus. `Esc`
deselects. Each dot and each row point at the same handler, so the two controls
stay in sync by construction.

**Narrow screens.** Below ~640px the overlay would eat the render. The list
moves below the panel as a plain stacked list, the dots stay on the model, and
the layout stops being an overlay. The panel keeps its 1.9 aspect.

## Data

```ts
export type ViewerPose = { azimuth: number; polar: number; radius: number };

export type ViewerHotspot = {
  /** Shown uppercase in the list and beside the dot. */
  label: string;
  /** Optional. Absent => the row renders as a plain label with no '+'. */
  body?: string;
  /** World-space point on the airframe, in the viewer's fitted units. */
  anchor: [number, number, number];
  /** Outward surface normal at `anchor`. Drives the facing test. */
  normal: [number, number, number];
  /** The rest pose this feature flies to. */
  pose: ViewerPose;
};

export type ProductViewer = {
  model: string;   // '/models/vtol.glb'  — was hardcoded in MiniViewer
  span: number;    // 3.2                 — was hardcoded in MiniViewer
  home: ViewerPose;
  hotspots: ViewerHotspot[];
};
```

`ProductPage` gains `viewer?: ProductViewer`. Optional, following the file's own
contract rule — *an act you declare must bring its data*. A page without it does
not mount the viewer, exactly as a missing act behaves today.

`MINI.viewer.hotspots`, in order:

| # | `label` | Anchor | Framing |
|---|---|---|---|
| 01 | EW Capable | at the antenna | close |
| 02 | CF Single Body | fuselage spine at the wing root | **wide, square-on side elevation** |
| 03 | 30 Min Flight Time | back centre, at the battery | close |
| 04 | Day & Night Vision | camera at the nose | close |

02 is deliberately a different kind of shot. The other three are close-ups on a
part; "CF single body" is an argument about the whole airframe and wants a wide
side elevation. Under the spring rig that is free — a rest pose with a large
`radius` and a polar near the equator. It also means 02's dot sits on a large
flat surface with no feature under it, which is why its anchor is specified as
the spine at the wing root rather than "the body".

04 has a free anchor available: the GLB carries a `LENS` material, so its
world-space centroid can be computed rather than picked. 01, 02 and 03 have no
such tell — every node in `vtol.glb` is named `Body1.NNN` — and must be picked.

## The picker

That is 65 hand-authored numbers: four anchors, four normals, four poses, one
home pose. Tuning them by editing a file and reloading is miserable, and the
result would be mediocre because one stops at "acceptable".

Dev-only, gated on `process.env.NODE_ENV === 'development'` so it is dropped
from the static export. Shift-click raycasts the model and `console.log`s a
paste-ready object: the hit point as `anchor`, the face normal in world space as
`normal`, and the camera's current spherical as `pose`. About 25 lines.

The authoring loop becomes: drag until the shot looks right, shift-click the
part, paste into `product.ts`.

This is the only place a raycast happens, and it happens on a click, so its cost
is irrelevant.

## Copy

Both existing strings become false and are rewritten:

- Caption, currently `Turn it over` — the model can no longer be turned over.
- Hint, currently `Drag to rotate · scroll to zoom` — both gestures now spring
  back.

Replacements to be proposed at implementation time and reviewed; the hint should
say what the elastic actually offers (leaning around a part) rather than
promising free orbit. The hint also now has a second job: before anything is
selected it should point at the list, not at the drag.

## Failure modes

| Condition | Behaviour |
|---|---|
| No WebGL | Unchanged — poster label reads "WebGL unavailable" |
| WebGL context builds then fails | Unchanged — label reads "Model unavailable" |
| `viewer` absent from a `ProductPage` | Section does not mount, as a missing act behaves today |
| `hotspots` empty | Viewer renders, no dots, no overlay, home pose drifts. A valid state |
| Stale anchor after a GLB re-export | Dot lands in the wrong place. Never a crash. Dev-only warning if an anchor sits further than `span` from the origin |
| Anchor normal absent or zero-length | Facing test returns true — dot always visible. Degrades toward the old behaviour rather than vanishing |
| `prefers-reduced-motion` | Drift and sway off, spring period shortened, elastic retained |

## Verification

This project has no test runner and no test files. Adding one for this feature
is not in scope and is not pretended at.

- `npm run build` — clean.
- `npm run lint` — clean.
- Look at it: all four hotspots selectable from both the dot and the row;
  spring-back settles without jitter at 60Hz and at 30Hz; dots fade correctly
  when they turn away; wheel over the panel dollies elastically while wheel
  outside it scrolls the page; the crossfade out of `FieldHero` is unchanged;
  keyboard reaches every control; reduced-motion honoured.

The maths worth being careful about — the `tanh` compression, the spring
integrator, the shortest-path azimuth, the facing test — is a dozen lines of
pure function and is kept in its own module, separate from the three.js code, so
it *could* be tested later without restructuring.

## Open questions

1. Replacement caption and hint copy — proposed at implementation, reviewed
   before merge.
2. Whether the four rows eventually gain `body` copy. The expansion is built
   either way.
