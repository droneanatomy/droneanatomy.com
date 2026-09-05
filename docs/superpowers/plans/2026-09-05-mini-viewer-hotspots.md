# Mini Viewer Hotspots and Elastic Camera — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mini viewer's free orbit with an elastic spring rig, and add four hotspots on the airframe selectable from a list overlaid on the render.

**Architecture:** One custom spherical controller replaces `OrbitControls`. Drag deltas are `tanh`-compressed so every gesture is a bounded peek, and releasing springs the camera back to a rest pose. Selecting a hotspot changes the rest pose and the orbit pivot — the same spring that snaps back performs the camera flight, so there is no separate tween system. Hotspot dots are DOM buttons positioned each frame from a projection, and hidden by a surface-normal facing test rather than a raycast.

**Tech Stack:** TypeScript, React 19, Next 16 (static export), three.js 0.182, Tailwind v4, vitest (added by Task 1).

**Spec:** `docs/superpowers/specs/2026-09-05-mini-viewer-hotspots-design.md`

## Global Constraints

- **Never `setState` per frame.** Camera, dot positions and opacities are written directly to refs from the render loop. The existing file states this rule: *"the fade and the camera never round-trip through React."*
- **All radii are FACTORS of the fitted distance, never world units.** `frameFor(size)` solves the framing distance against the panel's live aspect ratio, and `resize()` re-solves it. A pose storing `radius: 0.42` means `0.42 × fit`. This is an amendment to the spec, which said world units — see Task 2.
- **Front is −Z, back is +Z, up is +Y** in fitted model space. Verified from the GLB: the `LENS` meshes sit at z ≈ −1.12.
- **Fitted bounding box is 3.200 × 0.969 × 2.384, centred on the origin.** `vtol.glb` is a quadcopter, not a fixed-wing.
- **Azimuth convention is three's `Spherical`:** measured from +Z toward +X, i.e. `azimuth = atan2(x, z)`. Polar is measured from +Y.
- **Every commit message ends with these two trailer lines**, after a blank line:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012zRnYFwwX7cDmHRQzh2LA6
  ```
- **Do not touch** `FieldHero`, `loadCraft.ts`, `FlightScene`, the P10 Pro page, or `vtol.glb`.
- **Comments must explain WHY, matching the surrounding file's density.** `MiniViewer.tsx` and `product.ts` are heavily commented with reasoning, not description. Match that register; a bare implementation with no rationale will be rejected at review.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/field/orbit.ts` | **Create.** Pure maths — no three.js import. Elastic compression, spring integrator, shortest-path angle, facing test, spherical→cartesian. |
| `src/components/field/orbit.test.ts` | **Create.** vitest unit tests for the above. |
| `src/components/field/ElasticRig.ts` | **Create.** The three.js-facing controller. Owns pointer/wheel listeners, rig state, and the camera. Consumes `orbit.ts`. |
| `src/components/field/ViewerHotspots.tsx` | **Create.** The dots. Imperative `sync()` handle called from the render loop. |
| `src/components/field/ViewerList.tsx` | **Create.** The overlay list, expansion, and prev/next arrows. Pure React, no three.js. |
| `src/components/field/pickAnchor.ts` | **Create.** Dev-only shift-click picker. |
| `src/components/field/product.ts` | **Modify.** `ViewerPose` / `ViewerHotspot` / `ProductViewer` types, `MINI.viewer`, and the stale numeric-claims comment. |
| `src/components/field/MiniViewer.tsx` | **Modify.** Remove `OrbitControls`, wire the rig, the dots, the list and the picker. |
| `package.json` | **Modify.** Add `vitest` devDependency and a `test` script. |

---

### Task 1: Pure maths module

**Files:**
- Modify: `package.json`
- Create: `src/components/field/orbit.ts`
- Test: `src/components/field/orbit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Pose = { azimuth: number; polar: number; radius: number }`, `type Vec3 = [number, number, number]`, `elastic(raw, limit): number`, `shortestAngle(from, to): number`, `springStep(cur, vel, rest, omega, dt, wrap?): [number, number]`, `facing(normal, cameraPos, anchor): boolean`, `clampPolar(p): number`, `poseToPosition(pivot, pose): Vec3`, and the constants `POLAR_MIN`, `POLAR_MAX`.

- [ ] **Step 1: Add vitest**

```bash
npm install --save-dev vitest
```

Then add the script to `package.json`, alongside the existing `dev` / `start` / `lint` / `build`:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

Create `src/components/field/orbit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clampPolar,
  elastic,
  facing,
  poseToPosition,
  shortestAngle,
  springStep,
  POLAR_MAX,
  POLAR_MIN,
} from './orbit';

describe('elastic', () => {
  it('tracks the pointer 1:1 near zero', () => {
    expect(elastic(0.01, 0.9)).toBeCloseTo(0.01, 5);
  });

  it('never exceeds the limit, however hard it is pulled', () => {
    expect(elastic(1e6, 0.9)).toBeLessThanOrEqual(0.9);
    expect(elastic(1e6, 0.9)).toBeCloseTo(0.9, 6);
  });

  it('is odd, so dragging both ways feels the same', () => {
    expect(elastic(-0.4, 0.9)).toBeCloseTo(-elastic(0.4, 0.9), 12);
  });

  it('is already resisting at the limit', () => {
    // tanh(1) = 0.7616, so pulling a full limit yields only 76% of it.
    expect(elastic(0.9, 0.9)).toBeCloseTo(0.6854, 4);
  });

  it('returns zero for a non-positive limit rather than dividing by zero', () => {
    expect(elastic(5, 0)).toBe(0);
  });
});

describe('shortestAngle', () => {
  it('takes the short way round rather than across the whole circle', () => {
    expect(shortestAngle(3.0, -3.0)).toBeCloseTo(0.2832, 4);
  });

  it('signs the short way correctly in the other direction', () => {
    expect(shortestAngle(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 6);
  });
});

describe('springStep', () => {
  const omega = (2 * Math.PI) / 0.55;

  it('settles on the rest value', () => {
    let cur = 0;
    let vel = 0;
    for (let i = 0; i < 400; i++) [cur, vel] = springStep(cur, vel, 1, omega, 1 / 60);
    expect(cur).toBeCloseTo(1, 6);
  });

  it('never overshoots, so a return never reads as a bounce', () => {
    let cur = 0;
    let vel = 0;
    let max = -Infinity;
    for (let i = 0; i < 400; i++) {
      [cur, vel] = springStep(cur, vel, 1, omega, 1 / 60);
      max = Math.max(max, cur);
    }
    expect(max).toBeLessThan(1.001);
  });

  it('stays stable at 30Hz, not just 60Hz', () => {
    let cur = 0;
    let vel = 0;
    for (let i = 0; i < 400; i++) [cur, vel] = springStep(cur, vel, 1, omega, 1 / 30);
    expect(cur).toBeCloseTo(1, 6);
  });

  it('wraps the short way when asked to', () => {
    // Resting just past -PI while sitting just under +PI must move a
    // little further positive, not most of the way round the circle.
    const [next] = springStep(3.1, 0, -3.1, omega, 1 / 60, true);
    expect(next).toBeGreaterThan(3.1);
  });
});

describe('facing', () => {
  it('is true when the camera is on the same side as the normal', () => {
    expect(facing([0, 0, -1], [0, 0, -5], [0, 0, -1.19])).toBe(true);
  });

  it('is false when the anchor has turned away', () => {
    expect(facing([0, 0, -1], [0, 0, 5], [0, 0, -1.19])).toBe(false);
  });

  it('treats a zero-length normal as always visible', () => {
    expect(facing([0, 0, 0], [0, 0, 5], [0, 0, 0])).toBe(true);
  });
});

describe('clampPolar', () => {
  it('stops short of both poles so the camera never flips', () => {
    expect(clampPolar(-1)).toBe(POLAR_MIN);
    expect(clampPolar(99)).toBe(POLAR_MAX);
    expect(clampPolar(1.4)).toBe(1.4);
  });
});

describe('poseToPosition', () => {
  it('puts azimuth 0 on +Z, matching three Spherical', () => {
    const p = poseToPosition([0, 0, 0], { azimuth: 0, polar: Math.PI / 2, radius: 2 });
    expect(p[0]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(2, 6);
  });

  it('puts azimuth PI/2 on +X', () => {
    const p = poseToPosition([0, 0, 0], { azimuth: Math.PI / 2, polar: Math.PI / 2, radius: 2 });
    expect(p[0]).toBeCloseTo(2, 6);
    expect(p[2]).toBeCloseTo(0, 6);
  });

  it('offsets by the pivot', () => {
    const p = poseToPosition([1, 2, 3], { azimuth: 0, polar: Math.PI / 2, radius: 1 });
    expect(p[1]).toBeCloseTo(2, 6);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./orbit"`.

- [ ] **Step 4: Write the implementation**

Create `src/components/field/orbit.ts`:

```ts
/* ============================================================
   orbit — the arithmetic behind the elastic camera, and nothing else.

   Kept free of three.js on purpose. Everything here is a number in and a
   number out, which is what makes it the one part of this feature that can
   be tested: a spring that settles and an elastic that never exceeds its
   limit are assertable, where "the viewer feels right" is not.
   ============================================================ */

export type Pose = {
  azimuth: number;
  polar: number;
  /* A FACTOR of the fitted framing distance, never a world-unit distance.
     frameFor() solves the fit against the panel's live aspect, so a stored
     world distance would crop on a narrow phone and float on a wide
     desktop. See the note in MiniViewer's resize(). */
  radius: number;
};

export type Vec3 = [number, number, number];

/* Stops short of both poles. Straight down reads as a plan drawing and
   straight up puts the camera under the floor — and at exactly the pole the
   azimuth stops meaning anything and the view flips. */
export const POLAR_MIN = 0.05;
export const POLAR_MAX = Math.PI - 0.05;

/* THE RUBBER BAND.

   tanh is linear near zero, so a small drag tracks the pointer 1:1 and the
   control feels direct rather than sticky. It asymptotes at `limit`, so the
   excursion is bounded SOFTLY — the resistance builds and you feel the band
   tighten, where a hard clamp would simply stop dead and read as a bug.

   At a full limit of pull it has already given back only 76% of it, which is
   what makes the boundary legible before you reach it. */
export function elastic(raw: number, limit: number): number {
  if (limit <= 0) return 0;
  return limit * Math.tanh(raw / limit);
}

/* The signed distance from one angle to another, normalised to (-PI, PI].

   The home rest azimuth advances forever while the model drifts, so
   deselecting after a long read leaves `rest` many turns away from `cur` in
   raw radians. Springing on that difference would send the camera the long
   way round — several revolutions, in the worst case. */
export function shortestAngle(from: number, to: number): number {
  const d = to - from;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/* Critically damped, semi-implicit Euler.

   Critically damped rather than under-damped because this spring performs
   BOTH jobs: the flight to a hotspot and the snap back from a drag. An
   overshoot is charming on a flight and irritating on the twentieth return,
   and the flights get their sense of weight from distance instead.

   Verified stable and overshoot-free at both 1/60 and 1/30 — see the tests.
   The caller must still clamp dt; a backgrounded tab hands back multi-second
   frames and no explicit integrator survives those. */
export function springStep(
  cur: number,
  vel: number,
  rest: number,
  omega: number,
  dt: number,
  wrap = false
): [number, number] {
  const err = wrap ? shortestAngle(cur, rest) : rest - cur;
  const accel = omega * omega * err - 2 * omega * vel;
  const nextVel = vel + accel * dt;
  return [cur + nextVel * dt, nextVel];
}

/* Is the anchor on the side of the surface the camera can see?

   The obvious implementation is a raycast, and it is unaffordable: four rays
   a frame against 294,478 triangles with no BVH is ~1.2M triangle tests per
   frame, and throttling only converts a constant cost into a periodic hitch.

   The picker records the surface normal at authoring time, so this reduces to
   a sign test — and a sign is unaffected by magnitude, so neither vector
   needs normalising. One dot product per hotspot per frame.

   A zero-length normal returns true rather than false: a hotspot authored
   without one degrades to always-visible, which is the old behaviour, rather
   than to a dot nobody can ever find. */
export function facing(normal: Vec3, cameraPos: Vec3, anchor: Vec3): boolean {
  const dot =
    normal[0] * (cameraPos[0] - anchor[0]) +
    normal[1] * (cameraPos[1] - anchor[1]) +
    normal[2] * (cameraPos[2] - anchor[2]);
  return dot >= 0;
}

export const clampPolar = (p: number) => Math.min(POLAR_MAX, Math.max(POLAR_MIN, p));

/* Spherical to cartesian, in three's convention: azimuth from +Z toward +X,
   polar from +Y. Matching three rather than inventing our own means the
   authored poses can be read straight off a THREE.Spherical during picking.

   `pose.radius` is a factor, so the caller multiplies by the fit before
   calling — see the note on Pose. */
export function poseToPosition(pivot: Vec3, pose: Pose): Vec3 {
  const sinPolar = Math.sin(pose.polar);
  return [
    pivot[0] + pose.radius * sinPolar * Math.sin(pose.azimuth),
    pivot[1] + pose.radius * Math.cos(pose.polar),
    pivot[2] + pose.radius * sinPolar * Math.cos(pose.azimuth),
  ];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 18 tests across 6 describe blocks.

- [ ] **Step 6: Verify lint and build are unaffected**

Run: `npm run lint && npm run build`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/field/orbit.ts src/components/field/orbit.test.ts
git commit -m "feat(viewer): add the elastic camera's pure maths, with tests"
```

---

### Task 2: The viewer contract and the Mini's data

**Files:**
- Modify: `src/components/field/product.ts`

**Interfaces:**
- Consumes: `Pose` from `orbit.ts` (re-exported as `ViewerPose`).
- Produces: `type ViewerPose`, `type ViewerHotspot`, `type ProductViewer`, the optional `viewer?: ProductViewer` field on `ProductPage`, and `MINI.viewer`.

**Where the seed numbers came from.** Every anchor below was measured off `vtol.glb` by composing the node transforms, taking each mesh's accessor min/max, and mapping into fitted space with `world = (span / widest) * (p − centre)`. They are real positions on real geometry, not guesses — but they are seeds, and Task 4 builds the picker that refines them. The framings in particular are arithmetic, not composition, and are expected to change.

| Hotspot | Derived from | Fitted position |
|---|---|---|
| 01 EW Capable | `Body1.128`, a thin vertical fin, `Opaque(20,20,20)`, extent 0.030 × 0.385 × 0.159 — one of a symmetric pair at x ≈ ±0.233. An antenna. | centre `[0.233, 0.062, 0.491]` |
| 02 CF Single Body | The `CAMO` shell, extent 0.651 × 0.438 × 1.763 — the central pod. Anchored on its +X flank. | `[0.326, −0.133, −0.171]` |
| 03 30 Min Flight Time | Top-rear cluster `Body1.123`–`126`, `Opaque(137,89,86)`, around `[−0.23, 0.34, 0.59]`. Anchored at the rear deck centre, per "back center". | `[0, 0.30, 0.59]` |
| 04 Day & Night Vision | The two `LENS` meshes, centroid `[−0.025, −0.139, −1.122]`, front face at z ≈ −1.19. | `[−0.025, −0.139, −1.19]` |

The home pose is today's `VIEW` vector `(0.6, 0.17, 0.72)` converted to spherical: azimuth `0.695`, polar `1.391`, radius factor `1.0`.

- [ ] **Step 1: Add the types**

In `src/components/field/product.ts`, after the existing `BenchPanel` type and before `ProductPage`:

```ts
/* THE VIEWER'S CONTRACT.

   Optional, and optional for the same reason `gallery` and `bench` are: a
   page that does not declare a viewer should not be forced to invent
   framings for one. The rule this file already follows holds — an act you
   declare must bring its data.

   Every number in here is authored by eye through the dev picker (see
   pickAnchor.ts), not calculated. They are compositions. */
export type ViewerPose = {
  /** Radians, measured from +Z toward +X — three's Spherical convention. */
  azimuth: number;
  /** Radians from +Y. */
  polar: number;
  /** A FACTOR of the framing distance frameFor() solves against the panel's
   *  live aspect. 1.0 is the default framing; 0.42 is a close-up. Never a
   *  world-unit distance — that would crop on a narrow phone. */
  radius: number;
};

export type ViewerHotspot = {
  /** Shown uppercase in the list and beside the dot. */
  label: string;
  /** Optional. Absent => the row renders as a plain label with no '+', which
   *  is what lets these ship on names alone and gain copy later without a
   *  code change. */
  body?: string;
  /** World-space point in the viewer's FITTED, re-centred space — the model
   *  is normalised to `span` and its bounding box centred on the origin
   *  before this means anything. */
  anchor: [number, number, number];
  /** Outward surface normal at `anchor`. Drives the facing test that fades
   *  the dot when the anchor turns away — see orbit.ts. */
  normal: [number, number, number];
  pose: ViewerPose;
};

export type ProductViewer = {
  /** Was hardcoded in MiniViewer. Here so the component stops knowing which
   *  aircraft it renders. */
  model: string;
  /** Fitted span across the longest axis, in world units. */
  span: number;
  home: ViewerPose;
  hotspots: ViewerHotspot[];
};
```

- [ ] **Step 2: Add the field to `ProductPage`**

In the `ProductPage` type, after the `closing?` block and before `nav`:

```ts
  /** The interactive model. Absent => MiniViewer does not mount, exactly as
   *  a missing act behaves. */
  viewer?: ProductViewer;
```

- [ ] **Step 3: Rewrite the stale comment in the MINI block**

The MINI block's header comment currently ends with this paragraph, which stops being true the moment "30 Min Flight Time" ships:

```
   The copy makes no numeric claims. P10 Pro's page states figures that came
   from the product; there are none for this one yet, so it talks about the
   form factor and stops there rather than inventing specifications that
   would read as real.
```

Replace it with:

```
   THE COPY STATES ONE FIGURE, AND THE RULE IT LOOKS LIKE AN EXCEPTION TO IS
   INTACT. The viewer's third hotspot says "30 Min Flight Time". Every other
   line on this page still talks about the form factor and stops there. The
   rule was never "no numbers" — it was that a number has to come from the
   product rather than from whoever was filling in a type, and this one did.
   Anything added here needs the same provenance.
```

- [ ] **Step 4: Add `MINI.viewer`**

In the `MINI` object, after `slide` and before `nav`:

```ts
  /* SEEDED FROM THE GEOMETRY, THEN COMPOSED BY EYE.

     Every anchor below was measured off vtol.glb — node transforms composed,
     accessor bounds mapped into fitted space — so they sit on real parts
     rather than near them. The poses were not: they are arithmetic that
     points a camera roughly at each anchor, and they are meant to be
     replaced by framings picked in the browser. See pickAnchor.ts.

     ORDER IS THE ORDER THEY ARE READ, and the arrows step through it. */
  viewer: {
    model: '/models/vtol.glb',
    span: 3.2,

    /* Today's VIEW vector (0.6, 0.17, 0.72) as spherical. Preserved exactly
       so the crossfade out of the hero lands on the framing readers have
       been looking at for the whole of act one. */
    home: { azimuth: 0.695, polar: 1.391, radius: 1.0 },

    hotspots: [
      {
        label: 'EW Capable',
        /* Body1.128 — a 0.03 x 0.385 x 0.159 fin, one of a symmetric pair.
           The +X one, because that is the side facing the home framing. */
        anchor: [0.248, 0.14, 0.491],
        normal: [1, 0, 0],
        pose: { azimuth: 1.23, polar: 1.35, radius: 0.44 },
      },
      {
        label: 'CF Single Body',
        /* The flank of the CAMO pod. There is no feature under this one —
           it is an argument about the whole airframe, which is why its
           framing is a wide side elevation rather than a close-up, and why
           the anchor is the pod's own side rather than a part. */
        anchor: [0.326, -0.133, -0.171],
        normal: [1, 0, 0],
        pose: { azimuth: 1.571, polar: 1.571, radius: 0.95 },
      },
      {
        label: '30 Min Flight Time',
        /* The rear deck, centred. The battery cluster measures out at
           x = -0.23; this sits between it and its mirror because the brief
           was "back center", and the picker should move it onto the pack
           itself if that reads better. */
        anchor: [0, 0.3, 0.59],
        normal: [0, 0.92, 0.39],
        pose: { azimuth: 0.35, polar: 0.75, radius: 0.5 },
      },
      {
        label: 'Day & Night Vision',
        /* The front face of the LENS meshes. Faces -Z, so this dot is faded
           at the home framing and the row is the only way to reach it —
           which is correct, and is the clearest case for the list existing
           at all. */
        anchor: [-0.025, -0.139, -1.19],
        normal: [0, 0, -1],
        pose: { azimuth: 2.85, polar: 1.45, radius: 0.42 },
      },
    ],
  },
```

- [ ] **Step 5: Verify it typechecks and builds**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean. Nothing renders differently yet — the field is declared and unread.

- [ ] **Step 6: Commit**

```bash
git add src/components/field/product.ts
git commit -m "feat(viewer): declare the viewer contract and the Mini's four hotspots"
```

---

### Task 3: The elastic rig replaces OrbitControls

**Files:**
- Create: `src/components/field/ElasticRig.ts`
- Modify: `src/components/field/MiniViewer.tsx`

**Interfaces:**
- Consumes: `elastic`, `springStep`, `shortestAngle`, `clampPolar`, `poseToPosition`, `Pose` from `orbit.ts`.
- Produces: `class ElasticRig` with constructor `new ElasticRig({ camera, dom, home, reduced, onGrab })`, and methods `setFit(fit: number): void`, `select(pose: Pose | null, pivot: [number, number, number] | null): void`, `update(dt: number): void`, `dispose(): void`.

At the end of this task the viewer is elastic at home: it drifts, drag resists and springs back, the wheel dollies elastically. No hotspots yet.

- [ ] **Step 1: Write the rig**

Create `src/components/field/ElasticRig.ts`:

```ts
/* ============================================================
   ElasticRig — the camera control, and the reason OrbitControls had to go.

   OrbitControls applies drag deltas straight to its own spherical
   coordinates. There is no hook to attenuate them on the way in, and no
   concept of a pose to return to, so neither half of this control model can
   be expressed by configuring it.

   THE SPRING DOES TWO JOBS AND THAT IS THE WHOLE DESIGN. Flying to a hotspot
   is not a tween — it is `rest` and `pivot` changing, and the same spring
   that snaps a drag back carrying the camera there. So there is no easing
   curve to author, no flight duration to pick, no in-flight state to guard,
   and grabbing the model mid-flight simply works: the drag offset rides on
   top of a rest pose that is still travelling.
   ============================================================ */

import {
  clampPolar,
  elastic,
  poseToPosition,
  shortestAngle,
  springStep,
  type Pose,
  type Vec3,
} from './orbit';
import type * as THREE from 'three';

/* How far a drag can carry the camera off its rest pose, before tanh.
   Azimuth is loose because swinging round the side is the useful gesture;
   polar is tight because under the aircraft reads badly from any angle;
   radius is in FACTOR units and so is proportional by construction — 15% of
   a wide side elevation is a bigger move than 15% of a close-up, which is
   what keeps both feeling the same. */
const LIMIT = { azimuth: 0.9, polar: 0.35, radius: 0.15 };

/* The spring's period. Long enough that a flight across the aircraft has
   weight, short enough that a snap-back is not a journey. */
const PERIOD = 0.55;

/* Radians per second at rest, and it is today's number rather than a new
   one: OrbitControls' autoRotateSpeed of 0.55 works out at 2*PI*0.55/60
   rad/s, about 109 seconds a revolution. */
const DRIFT = 0.0576;

/* The selected pose breathes rather than holding still. Small enough that
   the framing is never lost, large enough that the render is never a
   photograph. Two different periods so the two axes never resolve into an
   obvious loop. */
const SWAY = { azimuth: 0.04, polar: 0.02 };

/* Matches the old rotateSpeed / zoomSpeed. */
const ROTATE = 0.85;
const WHEEL = 0.08;

/* A backgrounded tab hands back multi-second frames and no explicit
   integrator survives one. */
const MAX_DT = 1 / 30;

/* The wheel has no pointerup, so the radius channel needs a timeout to know
   the gesture ended. Long enough to bridge the gap between notches on a
   mouse, short enough that a trackpad flick still springs back promptly. */
const WHEEL_RELEASE_MS = 160;

export type RigOptions = {
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  home: Pose;
  reduced: boolean;
  /** Fired once, the first time the reader takes hold. Drives the hint's
   *  fade and nothing else — the rig itself does not change behaviour. */
  onGrab?: () => void;
};

export class ElasticRig {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly dom: HTMLElement;
  private readonly home: Pose;
  private readonly omega: number;
  private readonly drift: number;
  private readonly sway: { azimuth: number; polar: number };
  private readonly onGrab?: () => void;

  private cur: Pose;
  private vel = { azimuth: 0, polar: 0, radius: 0 };
  private raw = { azimuth: 0, polar: 0, radius: 0 };

  private selectedPose: Pose | null = null;
  private pivot: Vec3 = [0, 0, 0];
  private pivotTarget: Vec3 = [0, 0, 0];
  private pivotVel: Vec3 = [0, 0, 0];

  private fit = 1;
  private driftPhase = 0;
  private clock = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastWheel = -Infinity;
  private grabbed = false;

  constructor(opts: RigOptions) {
    this.camera = opts.camera;
    this.dom = opts.dom;
    this.home = opts.home;
    this.onGrab = opts.onGrab;

    /* Reduced motion kills the autonomous movement and shortens the spring
       so selections arrive rather than travel. The elastic itself stays:
       it answers the reader's own gesture and is not motion they did not
       ask for. */
    this.omega = (2 * Math.PI) / (opts.reduced ? 0.15 : PERIOD);
    this.drift = opts.reduced ? 0 : DRIFT;
    this.sway = opts.reduced ? { azimuth: 0, polar: 0 } : SWAY;

    this.cur = { ...opts.home };

    this.dom.addEventListener('pointerdown', this.onPointerDown);
    this.dom.addEventListener('pointermove', this.onPointerMove);
    this.dom.addEventListener('pointerup', this.onPointerUp);
    this.dom.addEventListener('pointercancel', this.onPointerUp);
    /* Not passive: the wheel means zoom inside this element and the page
       must not also scroll. Outside it the listener does not exist and the
       page scrolls normally, which is the whole arbitration. */
    this.dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** The framing distance frameFor() solved for the current panel aspect.
   *  Poses store factors of this, so a resize re-solves every framing at
   *  once and nothing has to be re-authored per breakpoint. */
  setFit(fit: number) {
    this.fit = fit;
  }

  /** Pass null to return home. */
  select(pose: Pose | null, pivot: Vec3 | null) {
    this.selectedPose = pose;
    this.pivotTarget = pivot ?? [0, 0, 0];
  }

  update(dt: number) {
    const step = Math.min(dt, MAX_DT);
    this.clock += step;

    /* WHERE THE CAMERA WANTS TO BE THIS FRAME.

       Home turns continuously, as it does today. A selected pose sways
       instead, so the framing holds but the render is never static. */
    let rest: Pose;
    if (this.selectedPose) {
      rest = {
        azimuth: this.selectedPose.azimuth + this.sway.azimuth * Math.sin(this.clock / 6),
        polar: this.selectedPose.polar + this.sway.polar * Math.sin(this.clock / 9),
        radius: this.selectedPose.radius,
      };
    } else {
      this.driftPhase += this.drift * step;
      rest = {
        azimuth: this.home.azimuth + this.driftPhase,
        polar: this.home.polar,
        radius: this.home.radius,
      };
    }

    /* The radius is held while the wheel is still turning and released a
       moment after it stops — the wheel's substitute for pointerup. */
    const radiusHeld = this.clockMs() - this.lastWheel < WHEEL_RELEASE_MS;

    if (this.dragging) {
      /* cur is DERIVED from rest while the pointer is down, so a drag that
         starts mid-flight keeps travelling with the rest pose underneath
         it. Velocity is zeroed so the spring does not fight the hand. */
      this.cur.azimuth = rest.azimuth + elastic(this.raw.azimuth, LIMIT.azimuth);
      this.cur.polar = rest.polar + elastic(this.raw.polar, LIMIT.polar);
      this.vel.azimuth = 0;
      this.vel.polar = 0;
    } else {
      /* wrap: true on azimuth only. driftPhase grows without bound, so the
         raw difference between cur and rest can be several revolutions. */
      [this.cur.azimuth, this.vel.azimuth] = springStep(
        this.cur.azimuth, this.vel.azimuth, rest.azimuth, this.omega, step, true
      );
      [this.cur.polar, this.vel.polar] = springStep(
        this.cur.polar, this.vel.polar, rest.polar, this.omega, step
      );
    }

    if (radiusHeld) {
      this.cur.radius = rest.radius + elastic(this.raw.radius, LIMIT.radius * rest.radius);
      this.vel.radius = 0;
    } else {
      this.raw.radius = 0;
      [this.cur.radius, this.vel.radius] = springStep(
        this.cur.radius, this.vel.radius, rest.radius, this.omega, step
      );
    }

    this.cur.polar = clampPolar(this.cur.polar);

    /* The pivot springs too, so selecting a hotspot swings the centre of
       rotation onto it rather than cutting to it. */
    for (let i = 0; i < 3; i++) {
      [this.pivot[i], this.pivotVel[i]] = springStep(
        this.pivot[i], this.pivotVel[i], this.pivotTarget[i], this.omega, step
      );
    }

    const p = poseToPosition(this.pivot, {
      azimuth: this.cur.azimuth,
      polar: this.cur.polar,
      radius: this.cur.radius * this.fit,
    });
    this.camera.position.set(p[0], p[1], p[2]);
    this.camera.lookAt(this.pivot[0], this.pivot[1], this.pivot[2]);
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointercancel', this.onPointerUp);
    this.dom.removeEventListener('wheel', this.onWheel);
  }

  private clockMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.raw.azimuth = 0;
    this.raw.polar = 0;
    this.dom.setPointerCapture(e.pointerId);
    if (!this.grabbed) {
      this.grabbed = true;
      this.onGrab?.();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const h = this.dom.clientHeight || 1;
    /* Signs match OrbitControls, so the gesture means what it has always
       meant here: dragging right turns the model right. */
    this.raw.azimuth -= ((2 * Math.PI * (e.clientX - this.lastX)) / h) * ROTATE;
    this.raw.polar -= ((2 * Math.PI * (e.clientY - this.lastY)) / h) * ROTATE;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    /* cur is left exactly where the drag put it and the spring takes over
       from there, so zeroing raw moves nothing. */
    this.raw.azimuth = 0;
    this.raw.polar = 0;
    if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.lastWheel = this.clockMs();
    this.raw.radius += (e.deltaY / 100) * WHEEL;
    if (!this.grabbed) {
      this.grabbed = true;
      this.onGrab?.();
    }
  };
}
```

- [ ] **Step 2: Strip OrbitControls out of MiniViewer**

In `src/components/field/MiniViewer.tsx`:

Remove the import:
```ts
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
```
and add:
```ts
import { ElasticRig } from './ElasticRig';
```

Delete the `DIST` constant and its comment block entirely (lines beginning `const SPAN = 3.2;` keep `SPAN` for now — Task 3 leaves it; it is removed in Task 7 when the data is read).

Delete the whole `const controls = new OrbitControls(...)` block through `controls.autoRotateSpeed = 0.55;`, and the `onGrab` / `controls.addEventListener('start', onGrab)` block that follows it. Replace with:

```ts
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* HOME IS TODAY'S FRAMING, IN SPHERICAL.

       VIEW is kept as the source of truth because frameFor still reads ELEV
       off it — the projected-height correction depends on the elevation the
       aircraft is seen from, so the two cannot disagree. */
    const rig = new ElasticRig({
      camera,
      dom: renderer.domElement,
      home: { azimuth: 0.695, polar: 1.391, radius: 1 },
      reduced,
      onGrab: () => {
        grabbedRef.current = true;
        setGrabbed(true);
      },
    });
```

- [ ] **Step 3: Rewire the load handler, the resize and the tick**

In the `loadCraft(...).then(...)` body, replace:
```ts
      camera.position.copy(VIEW).multiplyScalar(fit);
      controls.target.set(0, 0, 0);
      controls.minDistance = fit * 0.45;
      controls.maxDistance = fit * 2.2;
      controls.update();
```
with:
```ts
      rig.setFit(fit);
```

In `resize()`, replace the whole tail from `const fit = frameFor(modelSize);` to the end of the function with:

```ts
      /* RE-FRAMED UNCONDITIONALLY NOW, and the old `grabbed` gate is gone
         with the reason for it. That gate existed because the reader's
         chosen distance was theirs to keep and yanking it back on a window
         resize would have thrown away their view. Under the rig there is no
         chosen distance to lose — every framing springs back to a rest pose
         anyway — so re-solving the fit is always the right answer. */
      rig.setFit(frameFor(modelSize));
```

In `tick()`, replace `controls.update();` with a clocked update:

```ts
      const now = performance.now();
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      rig.update(dt);
```

and declare `let lastFrame = performance.now();` immediately above `let raf = 0;`.

> Note: `lastFrame` must be reset when the tick resumes after being skipped. The early return in `tick()` (`if (fadeRef.current <= 0.001 || ...) return;`) leaves `lastFrame` stale, and the first frame after scrolling back would hand the rig a multi-second dt. Move `lastFrame = now` above the early return by restructuring:
>
> ```ts
>     const tick = () => {
>       raf = requestAnimationFrame(tick);
>       const now = performance.now();
>       const dt = (now - lastFrame) / 1000;
>       lastFrame = now;
>
>       const r = section.getBoundingClientRect();
>       const vh = window.innerHeight || 1;
>       if (fadeRef.current <= 0.001 || r.bottom <= 0 || r.top >= vh) return;
>
>       rig.update(dt);
>       renderer.render(scene, camera);
>     };
> ```

In the cleanup, replace:
```ts
      controls.removeEventListener('start', onGrab);
      controls.dispose();
```
with:
```ts
      rig.dispose();
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all clean.

Then run `npm run dev`, open `/products/mini`, scroll to the viewer, click "View in 3D" and check by eye:
- The aircraft drifts slowly at rest, at about the speed it did before.
- Dragging resists and gets harder the further you pull; you cannot spin it round.
- Releasing springs it back with no bounce.
- The wheel over the panel dollies in and springs back; the page does not scroll while the pointer is over the panel.
- The wheel outside the panel scrolls the page normally.
- The crossfade out of the hero is unchanged.
- Resizing the window re-frames the aircraft rather than cropping it.

- [ ] **Step 5: Commit**

```bash
git add src/components/field/ElasticRig.ts src/components/field/MiniViewer.tsx
git commit -m "feat(viewer): replace OrbitControls with the elastic spring rig"
```

---

### Task 4: The dev-only picker

**Files:**
- Create: `src/components/field/pickAnchor.ts`
- Modify: `src/components/field/MiniViewer.tsx`

**Interfaces:**
- Consumes: `ElasticRig` (for the current pose — this task adds a `pose()` getter to it).
- Produces: `attachPicker({ dom, camera, scene, rig }): () => void` — returns a detach function.

This task exists so Task 7's framings can be composed rather than calculated. Task 2's seeds put the anchors on real geometry; this is what turns them into something worth looking at.

- [ ] **Step 1: Expose the rig's current pose**

Add to `ElasticRig`, after `select()`:

```ts
  /** The camera's live spherical pose, for the picker to read off. Factors,
   *  matching what a ViewerPose stores. */
  pose(): Pose {
    return { azimuth: this.cur.azimuth, polar: this.cur.polar, radius: this.cur.radius };
  }
```

- [ ] **Step 2: Write the picker**

Create `src/components/field/pickAnchor.ts`:

```ts
/* ============================================================
   pickAnchor — how the framings in product.ts get authored.

   DEV ONLY, and gated on NODE_ENV rather than on a URL flag so the whole
   module is dead code in the static export and never ships.

   The alternative was tuning 65 numbers by editing a file and reloading,
   and the real cost of that is not the time — it is that anyone doing it
   stops at "acceptable" rather than at "right". Shift-click the part,
   paste the log.
   ============================================================ */

import * as THREE from 'three';
import type { ElasticRig } from './ElasticRig';

const round = (n: number) => Math.round(n * 1000) / 1000;

export function attachPicker(opts: {
  dom: HTMLElement;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  rig: ElasticRig;
}): () => void {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const onClick = (e: MouseEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();

    const r = opts.dom.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, opts.camera);

    const hit = raycaster.intersectObjects(opts.scene.children, true)[0];
    if (!hit) {
      console.log('[pick] nothing under the pointer');
      return;
    }

    /* The face normal is in the hit object's LOCAL space. It has to be
       carried into world space by the normal matrix — not the world matrix
       — or a non-uniform scale anywhere in the chain skews it. loadCraft
       scales uniformly today, but this is the kind of thing that is wrong
       silently and forever once it stops being true. */
    const normal = new THREE.Vector3(0, 0, 1);
    if (hit.face) {
      normal
        .copy(hit.face.normal)
        .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
        .normalize();
    }

    const pose = opts.rig.pose();
    console.log(
      '[pick] %s\n%s',
      hit.object.name || '(unnamed)',
      JSON.stringify(
        {
          anchor: [round(hit.point.x), round(hit.point.y), round(hit.point.z)],
          normal: [round(normal.x), round(normal.y), round(normal.z)],
          pose: {
            azimuth: round(pose.azimuth),
            polar: round(pose.polar),
            radius: round(pose.radius),
          },
        },
        null,
        2
      )
    );
  };

  opts.dom.addEventListener('click', onClick);
  return () => opts.dom.removeEventListener('click', onClick);
}
```

- [ ] **Step 3: Attach it in MiniViewer**

In the viewer effect, immediately after the `rig` is constructed:

```ts
    /* Tree-shaken out of the production bundle: the condition is a literal
       after substitution, so the import never lands in the static export. */
    let detachPicker: (() => void) | undefined;
    if (process.env.NODE_ENV === 'development') {
      void import('./pickAnchor').then((m) => {
        detachPicker = m.attachPicker({
          dom: renderer.domElement,
          camera,
          scene,
          rig,
        });
      });
    }
```

and in the cleanup, beside `rig.dispose()`:

```ts
      detachPicker?.();
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: clean. Confirm the picker is absent from the export:

```bash
grep -rl "pick\] nothing under" out/ || echo "picker absent from export — correct"
```
Expected: `picker absent from export — correct`

Then `npm run dev`, open the viewer, shift-click the nose camera, and confirm the console logs an `anchor` near `[-0.025, -0.139, -1.19]` and a `normal` near `[0, 0, -1]` — which is the seed in `product.ts`, and is how you know the picker and the data agree about what space they are in.

- [ ] **Step 5: Commit**

```bash
git add src/components/field/pickAnchor.ts src/components/field/ElasticRig.ts src/components/field/MiniViewer.tsx
git commit -m "feat(viewer): add the dev-only anchor and framing picker"
```

---

### Task 5: The hotspot dots

**Files:**
- Create: `src/components/field/ViewerHotspots.tsx`
- Modify: `src/components/field/MiniViewer.tsx`

**Interfaces:**
- Consumes: `facing` from `orbit.ts`, `ViewerHotspot` from `product.ts`.
- Produces: `type HotspotsHandle = { sync: (camera: THREE.PerspectiveCamera) => void }` and `const ViewerHotspots` — a `forwardRef` component taking `{ hotspots, selected, onSelect }`.

At the end of this task four dots sit on the airframe, fade when they turn away, and clicking one logs the index. The camera does not respond yet.

- [ ] **Step 1: Write the component**

Create `src/components/field/ViewerHotspots.tsx`:

```tsx
'use client';

/* ============================================================
   ViewerHotspots — the dots, and they are DOM rather than sprites.

   The reference draws its labels into the canvas with an MSDF font atlas,
   which is the right call when the label has to survive being composited
   over geometry and the site already ships the atlas. Here it would buy a
   font pipeline and cost the thing that matters more: a real <button> takes
   focus, answers Enter and Space, and announces itself. Four dots is not
   enough geometry to be worth losing that over.

   POSITIONED BY THE RENDER LOOP, NOT BY REACT. sync() is called from the
   same rAF that draws the frame and writes transforms straight to refs.
   Routing four positions per frame through setState would re-render the
   tree sixty times a second to move four absolutely-positioned dots.
   ============================================================ */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { facing, type Vec3 } from './orbit';
import type { ViewerHotspot } from './product';

export type HotspotsHandle = {
  sync: (camera: THREE.PerspectiveCamera) => void;
};

type Props = {
  hotspots: ViewerHotspot[];
  selected: number | null;
  onSelect: (i: number) => void;
};

/* Opacity for a dot whose anchor has turned away. Faded rather than hidden:
   the reference hides its own, but with four dots on a small airframe a dot
   that vanishes reads as a glitch where one that fades reads as depth. */
const AWAY = 0.15;

export const ViewerHotspots = forwardRef<HotspotsHandle, Props>(function ViewerHotspots(
  { hotspots, selected, onSelect },
  ref
) {
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const projected = useRef(new THREE.Vector3());

  useImperativeHandle(ref, () => ({
    sync(camera) {
      const cam: Vec3 = [camera.position.x, camera.position.y, camera.position.z];

      hotspots.forEach((h, i) => {
        const el = dots.current[i];
        if (!el) return;

        const v = projected.current.set(h.anchor[0], h.anchor[1], h.anchor[2]).project(camera);

        /* Behind the near plane: NDC z leaves [-1, 1] and x/y become
           meaningless — a point behind the camera projects to a mirrored
           position in front of it. Parked rather than placed. */
        if (v.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.tabIndex = -1;
          return;
        }

        el.style.transform =
          `translate3d(${(v.x * 0.5 + 0.5) * 100}%, ${(-v.y * 0.5 + 0.5) * 100}%, 0)` +
          ' translate(-50%, -50%)';

        const visible = facing(h.normal as Vec3, cam, h.anchor as Vec3);
        el.style.opacity = visible ? '1' : String(AWAY);
        /* A dot on the far side must not be clickable or tabbable THROUGH
           the airframe — otherwise the keyboard order runs round the back
           of an aircraft the reader cannot see. */
        el.style.pointerEvents = visible ? 'auto' : 'none';
        el.tabIndex = visible ? 0 : -1;
        /* Nearer dots draw over farther ones. NDC z runs 0..1 across the
           frustum, so this is just its inverse, scaled to something CSS
           will take. */
        el.style.zIndex = String(Math.round((1 - v.z) * 1000));
      });
    },
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {hotspots.map((h, i) => (
        <button
          key={h.label}
          type="button"
          ref={(el) => {
            dots.current[i] = el;
          }}
          onClick={() => onSelect(i)}
          aria-pressed={selected === i}
          className={
            'absolute left-0 top-0 flex items-center gap-2 transition-opacity duration-200 ' +
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 ' +
            'focus-visible:outline-[#f2ecd9]'
          }
          style={{ opacity: 0 }}
        >
          <span
            aria-hidden
            className={
              'block rounded-full transition-all duration-300 ' +
              (selected === i
                ? 'size-[9px] bg-[#c9e265] ring-4 ring-[rgba(201,226,101,0.28)]'
                : 'size-[7px] bg-[#f2ecd9] ring-0')
            }
          />
          <span
            className={
              'whitespace-nowrap font-display text-[10px] font-bold uppercase tracking-[0.14em] ' +
              'text-[#c9e265] transition-opacity duration-300 ' +
              (selected === i ? 'opacity-100' : 'pointer-events-none opacity-0')
            }
          >
            {h.label}
          </span>
        </button>
      ))}
    </div>
  );
});

export default ViewerHotspots;
```

- [ ] **Step 2: Mount it in MiniViewer**

Add the imports:
```ts
import { ViewerHotspots, type HotspotsHandle } from './ViewerHotspots';
import type { ProductViewer } from './product';
```

Change the component signature so it takes the data rather than reading a constant:
```ts
export function MiniViewer({ name, viewer }: { name: string; viewer: ProductViewer }) {
```

Add the refs and state, beside the existing `useState` calls:
```ts
  const hotspotsRef = useRef<HotspotsHandle>(null);
  const [selected, setSelected] = useState<number | null>(null);
```

In `tick()`, after `rig.update(dt)` and before `renderer.render(...)`:
```ts
      hotspotsRef.current?.sync(camera);
```

Inside the panel `<div ref={panelRef} ...>`, immediately after `<div ref={mountRef} className="absolute inset-0" />`:
```tsx
            {status === 'ready' && (
              <ViewerHotspots
                ref={hotspotsRef}
                hotspots={viewer.hotspots}
                selected={selected}
                onSelect={setSelected}
              />
            )}
```

Update the one call site in the Mini page to pass the data. Find where `MiniViewer` is rendered and add `viewer={MINI.viewer}` — guarding on its presence, since the field is optional:
```tsx
{MINI.viewer && <MiniViewer name={MINI.name} viewer={MINI.viewer} />}
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all clean.

`npm run dev`, open the viewer, and check:
- Four dots sit on the aircraft and stay stuck to their parts as it drifts.
- The nose-camera dot is faded at the home framing (its normal points away from you) and the antenna and body dots are bright.
- Clicking a dot lights it and shows its label; clicking another moves the selection.
- Tab reaches only the dots currently facing you.

- [ ] **Step 4: Commit**

```bash
git add src/components/field/ViewerHotspots.tsx src/components/field/MiniViewer.tsx src/app/products/mini/page.tsx
git commit -m "feat(viewer): project four hotspot dots onto the airframe"
```

---

### Task 6: The overlay list

**Files:**
- Create: `src/components/field/ViewerList.tsx`
- Modify: `src/components/field/MiniViewer.tsx`

**Interfaces:**
- Consumes: `ViewerHotspot` from `product.ts`.
- Produces: `const ViewerList` taking `{ hotspots, selected, onSelect }`, where `onSelect(i: number | null)`.

- [ ] **Step 1: Write the component**

Create `src/components/field/ViewerList.tsx`:

```tsx
'use client';

/* ============================================================
   ViewerList — the four features, over the render rather than beside it.

   OVER, because the panel's width is already solved against three limits at
   once (see the note on the shared width expression in MiniViewer) and
   putting a column beside it would have made the render narrower on every
   screen to buy space that is only needed on wide ones. The scrim is what
   makes it legible; the reference does the same thing.

   A ROW WITHOUT COPY IS NOT AN EMPTY ROW. It renders as a plain label with
   no '+' and no expansion, because a disclosure control that discloses
   nothing is a lie. That is what lets these four ship on names alone and
   gain a sentence later as a data edit.
   ============================================================ */

import type { ViewerHotspot } from './product';

type Props = {
  hotspots: ViewerHotspot[];
  selected: number | null;
  onSelect: (i: number | null) => void;
};

export function ViewerList({ hotspots, selected, onSelect }: Props) {
  const step = (dir: 1 | -1) => {
    const n = hotspots.length;
    if (!n) return;
    /* From nothing, forward starts at the first and back at the last. */
    const from = selected ?? (dir === 1 ? -1 : 0);
    onSelect((from + dir + n) % n);
  };

  return (
    <div
      className={
        'pointer-events-none absolute inset-y-0 right-0 flex w-[min(46%,320px)] flex-col ' +
        'justify-center gap-3 px-[clamp(12px,2.2vw,28px)] ' +
        'max-sm:static max-sm:w-full max-sm:px-0 max-sm:pt-5'
      }
    >
      {/* THE SCRIM, and it is on its own element rather than as a background
          on the column. The column is a flex container whose height is the
          list's; the scrim has to span the panel's full height to fade out
          against its edges, and a background would have been clipped to the
          rows. Hidden on narrow screens, where the list is not over
          anything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-16 right-0 max-sm:hidden"
        style={{
          background:
            'linear-gradient(to right, rgba(9,11,7,0) 0%, rgba(9,11,7,0.55) 42%, rgba(9,11,7,0.78) 100%)',
        }}
      />

      <ol className="pointer-events-auto relative m-0 list-none p-0">
        {hotspots.map((h, i) => {
          const open = selected === i;
          return (
            <li key={h.label} className="border-b border-[rgba(242,236,217,0.14)]">
              <button
                type="button"
                onClick={() => onSelect(open ? null : i)}
                aria-expanded={h.body ? open : undefined}
                className={
                  'flex w-full items-baseline gap-3 py-2.5 text-left transition-colors duration-200 ' +
                  (open ? 'text-[#f2ecd9]' : 'text-[rgba(242,236,217,0.62)] hover:text-[#f2ecd9]')
                }
              >
                <span className="font-display text-[10px] tabular-nums opacity-60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 font-display text-[clamp(10px,0.82vw,13px)] font-bold uppercase tracking-[0.12em]">
                  {h.label}
                </span>
                {h.body && (
                  <span aria-hidden className="font-display text-[13px] leading-none opacity-60">
                    {open ? '−' : '+'}
                  </span>
                )}
              </button>

              {h.body && (
                /* Animated on a grid row rather than on height, so the copy
                   never needs a measured pixel value and the row can be
                   edited without retuning the transition. */
                <div
                  className="grid transition-[grid-template-rows] duration-300"
                  style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-3 text-[clamp(11px,0.78vw,13px)] leading-relaxed text-[rgba(242,236,217,0.72)]">
                      {h.body}
                    </p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="pointer-events-auto relative flex justify-end gap-2 pt-1">
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => step(dir)}
            aria-label={dir === 1 ? 'Next feature' : 'Previous feature'}
            className={
              'flex size-8 items-center justify-center rounded-full border ' +
              'border-[rgba(242,236,217,0.28)] text-[#f2ecd9] transition-colors duration-200 ' +
              'hover:border-[rgba(242,236,217,0.7)]'
            }
          >
            <span aria-hidden className="text-[13px] leading-none">
              {dir === 1 ? '→' : '←'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ViewerList;
```

- [ ] **Step 2: Mount it and wire the keyboard**

Import it in `MiniViewer.tsx`:
```ts
import { ViewerList } from './ViewerList';
```

Render it inside the shared-width wrapper, immediately after the closing `</div>` of the panel and before the hint paragraph:
```tsx
          {status === 'ready' && (
            <ViewerList
              hotspots={viewer.hotspots}
              selected={selected}
              onSelect={setSelected}
            />
          )}
```

> The panel is `relative`, so `ViewerList`'s `absolute inset-y-0 right-0` must resolve against the panel, not the wrapper. Move the `<ViewerList>` INSIDE `<div ref={panelRef} className="relative aspect-[1.9] w-full">`, after `<ViewerHotspots>`. On narrow screens its `max-sm:static` drops it back into normal flow, which then lands it below the render inside the panel — so also add `max-sm:overflow-visible` to the panel and let the list sit under it.

Add the keyboard effect, after the existing effects:

```ts
  /* ARROWS STEP, ESCAPE RELEASES, and it is bound to the section rather
     than the window: the page has other arrow-key meanings above and below
     this, and a viewer that ate them for the whole document would break
     scrolling with the keyboard. */
  useEffect(() => {
    if (status !== 'ready') return;
    const el = sectionRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      const n = viewer.hotspots.length;
      if (!n) return;
      if (e.key === 'Escape') {
        setSelected(null);
        return;
      }
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      setSelected((s) => {
        const from = s ?? (dir === 1 ? -1 : 0);
        return (from + dir + n) % n;
      });
    };

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [status, viewer.hotspots.length]);
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all clean.

`npm run dev` and check:
- The list sits over the render's right side, legible against the scrim.
- Clicking a row lights the matching dot; clicking a dot highlights the matching row.
- Clicking an open row closes it and clears the selection.
- The arrows step through all four and wrap at both ends.
- `←` / `→` step and `Esc` clears, once something in the section has focus.
- No row shows a `+`, because none has `body` copy yet.
- At a phone width the list drops below the render and the aircraft keeps the full frame.

- [ ] **Step 4: Commit**

```bash
git add src/components/field/ViewerList.tsx src/components/field/MiniViewer.tsx
git commit -m "feat(viewer): overlay the feature list and wire selection"
```

---

### Task 7: Selection drives the camera

**Files:**
- Modify: `src/components/field/MiniViewer.tsx`

**Interfaces:**
- Consumes: `ElasticRig.select()` from Task 3, `selected` state from Task 6, `viewer.hotspots` from Task 2.
- Produces: nothing new. This is the join.

The rig, the dots and the list all exist and none of them are connected to each other. This task is the wire, and it is deliberately last because everything it connects is independently reviewable.

- [ ] **Step 1: Bridge React state into the rig**

The rig lives in a `useEffect` closure and `selected` is React state; the effect must not be torn down and rebuilt on every selection, because that would dispose the WebGL context. So the rig is published to a ref when it is built, and a separate effect pushes selections at it.

Add beside the other refs:
```ts
  /* The rig is built inside the viewer effect and read by the selection
     effect. A ref rather than state because publishing it with setState
     would re-render the tree at the moment the model lands, for a value
     nothing renders. */
  const rigRef = useRef<ElasticRig | null>(null);
```

In the viewer effect, immediately after `const rig = new ElasticRig({...})`:
```ts
    rigRef.current = rig;
```

and in that effect's cleanup, beside `rig.dispose()`:
```ts
      rigRef.current = null;
```

Add the selection effect after it:

```ts
  /* SELECTION -> CAMERA, and this is the whole of the "flight".

     There is no tween here because there is no tween anywhere: changing the
     rest pose and the pivot is the flight, and the same spring that snaps a
     drag back carries the camera over. A far-side hotspot therefore takes
     longer to reach than a neighbouring one for free, and grabbing the
     model halfway through simply works. */
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    if (selected === null) {
      rig.select(null, null);
      return;
    }
    const h = viewer.hotspots[selected];
    if (!h) return;
    rig.select(h.pose, h.anchor);
  }, [selected, viewer.hotspots, status]);
```

> `status` is in the dependency list on purpose: the rig does not exist until the model has been asked for, so a selection made before then would be dropped. Re-running when `status` changes replays it against the rig that now exists.

- [ ] **Step 2: Remove the now-dead constants**

`SPAN`, `VIEW` and `ELEV` are still module constants in `MiniViewer.tsx`, and `SPAN` is now also in the data. `VIEW`/`ELEV` must STAY — `frameFor` reads `ELEV` for its projected-height correction, and `contactShadow` reads `SPAN` for its plane size.

Change only the two places that should now read the data:
- `loadCraft('/models/vtol.glb', { span: SPAN })` becomes `loadCraft(viewer.model, { span: viewer.span })`.
- The rig's `home` literal becomes `home: viewer.home`.

Leave `SPAN` in place as the contact shadow's own constant, and add a comment saying why it is no longer the model's span:

```ts
/* The shadow disc's own geometry size, and it is no longer the model's span
   — that moved into the data. It stays a constant because the disc is
   rescaled from the model's real footprint at load anyway (see the shadow
   block in the loader), so this is only the size the plane is built at. */
const SPAN = 3.2;
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all clean.

`npm run dev` and check the whole thing:
- Selecting 01 flies the camera to the antenna and the aircraft turns around THAT point, not its centre.
- Selecting 02 pulls back to a side elevation.
- Selecting 04 flies round to the nose, and its dot brightens as it comes into view while the others fade.
- Each selected framing sways gently rather than freezing.
- Dragging while a feature is selected leans around the hotspot and springs back to the authored shot.
- The wheel still dollies elastically, and springs back to the selected radius rather than to home.
- Selecting while a flight is still in progress redirects it smoothly.
- `Esc` returns home and the drift resumes.

- [ ] **Step 4: Author the real framings with the picker**

The seeds in `product.ts` are arithmetic. Now that selection works, compose them:

For each of the four, select it, drag until the shot is right, shift-click the part, and paste the logged `anchor`, `normal` and `pose` over the seed in `MINI.viewer.hotspots`.

Watch for: 03's anchor is a guess at "back center" — the battery cluster actually measures out at x ≈ −0.23, so check whether anchoring it on the pack itself reads better than the deck centre. And 02 should end up square-on; if the logged azimuth is not near `1.571` the elevation is off-axis.

- [ ] **Step 5: Commit**

```bash
git add src/components/field/MiniViewer.tsx src/components/field/product.ts
git commit -m "feat(viewer): fly the camera to the selected hotspot"
```

---

### Task 8: Copy, and the last of the old promises

**Files:**
- Modify: `src/components/field/MiniViewer.tsx`

**Interfaces:** none.

Two strings in the JSX describe a viewer that no longer exists. They are the last thing standing between this feature and being honest.

- [ ] **Step 1: Replace the caption**

The caption row's right-hand label currently reads `Turn it over`. The model can no longer be turned over — every drag springs back. It also has a new job: pointing at the list, which is now the primary control.

Replace:
```tsx
            <p className="font-display text-[clamp(9px,0.75vw,13px)] uppercase tracking-[0.18em] opacity-40">
              Turn it over
            </p>
```
with:
```tsx
            {/* Was "Turn it over", which the elastic rig made false — the
                aircraft cannot be turned over any more, only leaned around.
                This points at the list instead, which is now the control
                that actually gets you somewhere. */}
            <p className="font-display text-[clamp(9px,0.75vw,13px)] uppercase tracking-[0.18em] opacity-40">
              Four points
            </p>
```

- [ ] **Step 2: Replace the hint**

The hint below the panel reads `Drag to rotate · scroll to zoom`. Both gestures now spring back, so both halves overpromise.

Replace the string `Drag to rotate &middot; scroll to zoom` with:
```
Drag to look &middot; release to settle
```

and add above the `<p>`:
```tsx
          {/* One string for both states rather than two.
              "Drag to rotate · scroll to zoom" named two gestures that no
              longer do what they said; this names what actually happens and
              stays true whether or not a feature is selected, which is what
              lets it keep its single fade. */}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: clean.

`npm run dev` and confirm both strings render, the hint still fades on first grab, and neither wraps at a phone width.

- [ ] **Step 4: Commit**

```bash
git add src/components/field/MiniViewer.tsx
git commit -m "fix(viewer): retire the copy that promised free orbit"
```

---

### Task 9: Full verification

**Files:** none — this task changes nothing.

- [ ] **Step 1: Run everything**

```bash
npm test && npm run lint && npm run build
```
Expected: 18 tests pass, lint clean, build clean.

- [ ] **Step 2: Confirm the picker did not ship**

```bash
grep -rl "pick\] nothing under" out/ || echo "picker absent from export — correct"
```
Expected: `picker absent from export — correct`

- [ ] **Step 3: Confirm the P10 Pro page is untouched**

`npm run dev`, open `/products/p10-pro`, and scroll the whole page. It has no `viewer` in its data, so it must render exactly as it did before — hero, gallery, bench and closing card, with no viewer section and no console errors.

- [ ] **Step 4: Reduced motion**

In devtools, Rendering → Emulate CSS `prefers-reduced-motion: reduce`, reload, and open the viewer. The aircraft must sit still at home, selections must arrive almost instantly rather than travelling, and dragging must still resist and spring back.

- [ ] **Step 5: Frame rate**

In devtools Performance, throttle CPU 4×, and drag the model. The spring must not jitter or explode — `MAX_DT` is what protects this, and a visible instability here means it is not being applied.

- [ ] **Step 6: Commit any fixes, then stop**

If steps 1–5 surfaced nothing, there is nothing to commit and the branch is ready for review. If they did, fix and commit with a message naming what the check caught.

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the control rig → Tasks 1 and 3; hotspots and the facing test → Tasks 1 and 5; the overlay → Task 6; data shape → Task 2; the picker → Task 4; copy → Task 8; failure modes → distributed (WebGL paths untouched in Task 3, `viewer` absent verified in Task 9 step 3, zero-length normal in Task 1's `facing` test, reduced motion in Tasks 3 and 9); verification → Task 9. The spec's "narrow screens" requirement is in Task 6's `max-sm:` classes and its step 3 check.

**One spec amendment**, recorded in Global Constraints: poses store a FACTOR of the fitted distance rather than a world-unit radius. The spec said world units, which would crop the framings on a narrow panel because `frameFor` re-solves the fit against the live aspect. `docs/superpowers/specs/2026-09-05-mini-viewer-hotspots-design.md` should be updated to match.

**Two things the spec left open and this plan closes** with concrete values, both of which are review bait rather than settled: the caption becomes "Four points" and the hint becomes "Drag to look · release to settle" (Task 8). The spec listed these as open question 1.

**Known soft spot.** The elastic limits (`0.9` / `0.35` / `0.15`), the spring period (`0.55s`) and the sway amplitudes are judgement, not measurement. They are all constants at the top of `ElasticRig.ts` for exactly that reason. Expect to retune them at Task 7 step 4, when there is something to feel.
