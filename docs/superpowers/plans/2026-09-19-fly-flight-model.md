# /fly Flight Model & Takeoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the hidden `/fly` page a real force-based flight model, a spool-up takeoff, and an airspeed-driven VTOL transition, so the Cyclops flies like a fixed wing and the quads fly like quads.

**Architecture:** One pure module, `src/components/fly/flightModel.ts`, integrates accelerations (gravity, thrust, lift, drag) with per-airframe coefficients solved from the existing fleet table. `FlyGame.tsx` keeps loading, cameras, HUD and React, and calls `step()` once per frame. The VTOL transition is not a state — it is a continuous blend of lift sources driven by airspeed.

**Tech Stack:** TypeScript, React 19, three.js 0.182, vitest 5 (node environment, no DOM), Next.js 16 static export.

**Spec:** `docs/superpowers/specs/2026-09-19-fly-flight-model-design.md`

## Global Constraints

- **Desktop keyboard only.** No touch controls, no on-screen stick, no small-screen layout work. `FlyGame.tsx`'s existing touch message stays exactly as it is.
- **`flightModel.ts` must stay pure:** no `three` import, no `terrain` import, no DOM, no `performance.now()`. Ground height arrives as a number parameter. This is what lets it be tested in the project's node-environment vitest with no new dependency.
- **No new npm dependencies.** There is no jsdom in this project and none is to be added.
- **No React state per frame.** The HUD keeps its existing 120 ms throttle; everything else is written onto refs, matching `FlightPreview.tsx`.
- **`step()` mutates its state argument.** It runs 60+ times a second; a fresh object per frame is garbage the renderer has no use for.
- **The fleet table in `FlyGame.tsx:75-118` is not edited.** `speed`, `boost`, `climb`, `turn`, `span`, `strafe` are inputs to the model, not things the model changes.
- **`FlightScene.tsx` (homepage) must not change behaviour.** It spins only the Cyclops pusher and must continue to.
- **Do not touch** `loadCraft.normalise()`'s offset bug or FlyGame's per-craft re-centring workaround.
- **Every commit message ends with this trailer** (shown in full in Task 1, abbreviated as `[trailer]` after that):

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

- **Run tests with** `npm test` (whole suite) or `npx vitest run <path>` (one file). The suite is at 62 passing tests before this work starts; it must never go below that.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/fly/flightModel.ts` *(new)* | Types, `deriveAirframe`, `liftShare`, `stallSpeed`, `touchdownVerdict`, `step`. Pure. The whole flight model. |
| `src/components/fly/flightModel.test.ts` *(new)* | Every behavioural assertion in the spec. |
| `src/components/flight/loadCraft.ts` *(modify)* | `rotors` option gains optional named groups; produces `userData.rotorGroups`. Additive — existing shape keeps working. |
| `src/components/flight/craft.ts` *(modify)* | `spinRotors` gains an optional hub list so a caller can spin one group at its own rate. |
| `src/components/fly/FlyGame.tsx` *(modify)* | Loses its inline physics (lines 393-445). Reads keys into `Controls`, calls `step`, copies state onto the THREE object, drives two rotor groups, shows the new HUD fields. |

---

### Task 1: Airframe coefficients

**Files:**
- Create: `src/components/fly/flightModel.ts`
- Test: `src/components/fly/flightModel.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `G`, `type AirframeSpec`, `type Airframe`, `deriveAirframe(spec: AirframeSpec): Airframe`, `stallSpeed(a: Airframe): number`.

- [ ] **Step 1: Write the failing test**

Create `src/components/fly/flightModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { G, deriveAirframe, stallSpeed, type AirframeSpec } from './flightModel';

/* The three specs from FlyGame's fleet table, copied rather than imported:
   importing FlyGame.tsx would drag three and React into a node test. */
const CYCLOPS: AirframeSpec = { key: 'cyclops', span: 11, speed: 70, boost: 150, turn: 0.75, climb: 30, strafe: false };
const MINI: AirframeSpec = { key: 'mini', span: 2.2, speed: 26, boost: 60, turn: 1.9, climb: 16, strafe: true };

describe('deriveAirframe — wing', () => {
  const a = deriveAirframe(CYCLOPS);

  it('trims for level flight at the published cruise speed', () => {
    /* CL is solved so that lift equals weight at cruise with no help from
       angle of attack: CL * v_c^2 === G. */
    expect(a.CL * CYCLOPS.speed ** 2).toBeCloseTo(G, 6);
  });

  it('stalls comfortably below cruise', () => {
    expect(stallSpeed(a)).toBeCloseTo(47.2, 1);
    expect(stallSpeed(a)).toBeLessThan(CYCLOPS.speed * 0.75);
  });

  it('runs out of thrust exactly at the published boost speed', () => {
    /* Full thrust equals drag at v_max, which is what makes boost the top
       speed rather than a number we hope is reachable. */
    expect(a.CD * CYCLOPS.boost ** 2).toBeCloseTo(a.thrustMax, 6);
  });

  it('has exactly enough excess thrust at cruise to make the published climb rate', () => {
    const excess = a.thrustMax - a.CD * CYCLOPS.speed ** 2;
    expect((excess / G) * CYCLOPS.speed).toBeCloseTo(CYCLOPS.climb, 1);
  });

  it('closes its transition window above the stall speed', () => {
    expect(a.vTransStart).toBeLessThan(stallSpeed(a));
    expect(a.vTransEnd).toBeGreaterThan(stallSpeed(a));
  });

  it('gives the lift rotors authority over weight, so it can climb in the hover', () => {
    expect(a.liftThrustMax).toBeGreaterThan(G);
  });
});

describe('deriveAirframe — quad', () => {
  const a = deriveAirframe(MINI);

  it('reaches the published boost speed at full lean', () => {
    expect((G * Math.tan(a.tiltMax)) / a.CD).toBeCloseTo(MINI.boost ** 2, 4);
  });

  it('reaches the published cruise speed at the cruise lean', () => {
    expect((G * Math.tan(a.tiltCruise)) / a.CD).toBeCloseTo(MINI.speed ** 2, 4);
  });

  /* tan(theta) scales with v^2, so a quad at its top speed must be at its
     fullest lean. Solving CD from `speed` instead would pin the Mini at 35
     degrees of lean at a gentle 26 u/s and leave `boost` meaning nothing. */
  it('flies nearly level at cruise and leans hard only when pushed', () => {
    expect(a.tiltCruise).toBeLessThan(a.tiltMax * 0.3);
  });

  it('has no wing', () => {
    expect(a.wing).toBe(false);
    expect(stallSpeed(a)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: FAIL — `Cannot find module './flightModel'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/fly/flightModel.ts`:

```ts
/* ============================================================
   flightModel — how the aircraft on /fly actually fly.

   PURE, and deliberately so: no three, no terrain, no DOM, no clock. The
   ground arrives as a sampled height and time arrives as a dt, which is
   what lets every claim in here be a test rather than an opinion.

   EVERYTHING IS AN ACCELERATION. There is no mass anywhere. Mass only
   ever appears divided back out again, so carrying it would mean two
   numbers to tune where one will do.

   THE COEFFICIENTS ARE SOLVED FROM THE FLEET TABLE, never typed in. The
   speeds in FlyGame's FLEET are the aircraft's published character; here
   they become the equations the coefficients must satisfy, so the fleet
   keeps flying at the speeds it already advertises and the tests can
   assert that it does.
   ============================================================ */

/* Gravity, in world units per second squared. Reasoned from the world's
   scale rather than picked: the Cyclops spans 11 units and about 2.2 m,
   so a unit is roughly 0.2 m and 9.81 m/s^2 is about 49. This is the
   first number to reach for if the whole fleet feels heavy or floaty. */
export const G = 45;

/* Thrust-to-weight for a multirotor, and how far it may lean. 35 degrees
   is about where a sport quad sits before the vertical component of its
   thrust starts costing it altitude it cannot spare. */
const QUAD_TWR = 2.0;
const TILT_MAX = (35 * Math.PI) / 180;

/* How much more lift the wing can make at its best angle of attack than
   it makes trimmed for cruise. This single ratio sets the stall speed. */
const CLMAX_RATIO = 2.2;

/* The four lift rotors' combined authority. The 0.6 over weight is what
   gives the VTOL a hover climb rate at all. */
const LIFT_TWR = 1.6;

/* The blend window, as fractions of stall speed. It must OPEN below the
   stall and CLOSE above it: closing above is what guarantees the wing can
   carry the aircraft by the time the lift rotors are done. */
const TRANS_START = 0.85;
const TRANS_END = 1.17;

export type AirframeSpec = {
  key: string;
  span: number;
  /** Cruise and top speed, world units per second. */
  speed: number;
  boost: number;
  /** Yaw rate, radians per second. */
  turn: number;
  /** Best climb rate, world units per second. */
  climb: number;
  /** A multirotor. A false here means a fixed wing. */
  strafe: boolean;
};

export type Airframe = {
  key: string;
  wing: boolean;
  span: number;
  turn: number;
  climb: number;
  strafe: boolean;
  cruise: number;
  top: number;
  /** Lift coefficient trimmed for cruise, and the most the wing can make. */
  CL: number;
  CLmax: number;
  CD: number;
  thrustMax: number;
  hoverThrust: number;
  liftThrustMax: number;
  tiltMax: number;
  tiltCruise: number;
  vTransStart: number;
  vTransEnd: number;
};

export function deriveAirframe(s: AirframeSpec): Airframe {
  const wing = !s.strafe;
  const base = {
    key: s.key,
    wing,
    span: s.span,
    turn: s.turn,
    climb: s.climb,
    strafe: s.strafe,
    cruise: s.speed,
    top: s.boost,
    hoverThrust: G,
  };

  if (wing) {
    const CL = G / (s.speed * s.speed);
    const CLmax = CLMAX_RATIO * CL;
    /* Solved from two requirements at once: full thrust equals drag at the
       top speed, AND the excess thrust at cruise produces exactly the
       published climb rate. Both published numbers therefore hold by
       construction, and Task 1's tests assert the algebra rather than
       trusting it. */
    const thrustMax = (G * s.climb) / s.speed / (1 - (s.speed / s.boost) ** 2);
    const CD = thrustMax / (s.boost * s.boost);
    const vStall = Math.sqrt(G / CLmax);
    return {
      ...base,
      CL,
      CLmax,
      CD,
      thrustMax,
      liftThrustMax: G * LIFT_TWR,
      tiltMax: TILT_MAX,
      tiltCruise: TILT_MAX,
      vTransStart: vStall * TRANS_START,
      vTransEnd: vStall * TRANS_END,
    };
  }

  /* CD comes from the BOOST speed at full lean, not from cruise. */
  const CD = (G * Math.tan(TILT_MAX)) / (s.boost * s.boost);
  return {
    ...base,
    CL: 0,
    CLmax: 0,
    CD,
    thrustMax: G * QUAD_TWR,
    liftThrustMax: G * QUAD_TWR,
    tiltMax: TILT_MAX,
    tiltCruise: Math.atan((s.speed * s.speed * CD) / G),
    vTransStart: 0,
    vTransEnd: 0,
  };
}

export const stallSpeed = (a: Airframe) => (a.wing ? Math.sqrt(G / a.CLmax) : 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, 73 tests (62 existing + 11 new).

- [ ] **Step 6: Commit**

```bash
git add src/components/fly/flightModel.ts src/components/fly/flightModel.test.ts
git commit -m "feat(fly): derive airframe coefficients from the fleet table

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The transition blend

**Files:**
- Modify: `src/components/fly/flightModel.ts`
- Test: `src/components/fly/flightModel.test.ts`

**Interfaces:**
- Consumes: `G`, `Airframe`, `deriveAirframe`, `stallSpeed` from Task 1.
- Produces: `liftShare(airspeed: number, a: Airframe): number`, `smoothstep(a: number, b: number, x: number): number`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/fly/flightModel.test.ts`:

```ts
import { liftShare } from './flightModel';

describe('liftShare', () => {
  const a = deriveAirframe(CYCLOPS);

  it('gives the lift rotors everything below the window', () => {
    expect(liftShare(0, a)).toBe(1);
    expect(liftShare(a.vTransStart, a)).toBe(1);
  });

  it('gives them nothing above it', () => {
    expect(liftShare(a.vTransEnd, a)).toBe(0);
    expect(liftShare(999, a)).toBe(0);
  });

  it('falls monotonically through the window', () => {
    let prev = 1;
    for (let v = a.vTransStart; v <= a.vTransEnd; v += 0.5) {
      const s = liftShare(v, a);
      expect(s).toBeLessThanOrEqual(prev + 1e-9);
      prev = s;
    }
  });

  /* THE TEST THIS MODULE EXISTS FOR. If the two lift sources ever sum to
     less than weight, the aircraft sinks in the middle of its transition —
     the failure that makes tiltrotor sims feel broken, and the one bug in
     this design most likely to reach a person's screen.

     Written against CLmax, not CL: CL is the coefficient trimmed for
     cruise, so it only equals weight at 70 u/s and would report a hole
     that is an artefact of the wrong coefficient. A wing carries its
     weight anywhere above stall by flying at a higher angle of attack, so
     what matters is the lift AVAILABLE. */
  it('never lets total available support fall below weight', () => {
    for (let v = 0; v <= a.vTransEnd + 20; v += 0.25) {
      const support = liftShare(v, a) * a.liftThrustMax + a.CLmax * v * v;
      expect(support).toBeGreaterThan(G);
    }
  });

  it('is always 1 for a multirotor, which has nothing to transition to', () => {
    const q = deriveAirframe(MINI);
    expect(liftShare(0, q)).toBe(1);
    expect(liftShare(500, q)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: FAIL — `liftShare is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/components/fly/flightModel.ts`:

```ts
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* THE TRANSITION IS NOT A STATE. It is this one number, and because it is
   a function of airspeed rather than of a timer, it runs backwards for
   free: slow down and the lift rotors come back, which is the whole of
   back-transition and the reason landing needs no code of its own.

   A multirotor returns 1 always — it has nothing to transition to, and
   giving it the same call keeps step() free of airframe branches here. */
export const liftShare = (airspeed: number, a: Airframe) =>
  a.wing ? 1 - smoothstep(a.vTransStart, a.vTransEnd, airspeed) : 1;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/fly/flightModel.ts src/components/fly/flightModel.test.ts
git commit -m "feat(fly): airspeed-driven lift share for the VTOL transition

[trailer]"
```

---

### Task 3: State, and the multirotor's forces

**Files:**
- Modify: `src/components/fly/flightModel.ts`
- Test: `src/components/fly/flightModel.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-2.
- Produces: `type Mode`, `type Controls`, `type FlightState`, `newState(x, y, z): FlightState`, `step(s, a, c, groundY, dt): void`, `NEUTRAL: Controls`.

`step` handles multirotors in this task; the wing branch arrives in Task 4.

- [ ] **Step 1: Write the failing test**

Append to `src/components/fly/flightModel.test.ts`:

```ts
import { NEUTRAL, newState, step, type Controls, type FlightState } from './flightModel';

/* Run the model to a steady state on flat ground. Returns the state so a
   test can read whatever it cares about. */
const settle = (a: ReturnType<typeof deriveAirframe>, c: Partial<Controls>, seconds = 40, s = newState(0, 300, 0)) => {
  s.mode = 'flying';
  const controls = { ...NEUTRAL, ...c };
  for (let i = 0; i < seconds * 60; i++) step(s, a, controls, 0, 1 / 60);
  return s;
};

const speedOf = (s: FlightState) => Math.hypot(s.vx, s.vz);

describe('step — multirotor', () => {
  const a = deriveAirframe(MINI);

  it('holds altitude with no input', () => {
    const s = settle(a, {}, 10);
    expect(Math.abs(s.vy)).toBeLessThan(0.5);
    expect(Math.abs(s.y - 300)).toBeLessThan(2);
  });

  it('settles at the published cruise speed on throttle alone', () => {
    expect(speedOf(settle(a, { throttle: 1 }))).toBeCloseTo(MINI.speed, 0);
  });

  it('settles at the published boost speed with boost held', () => {
    expect(speedOf(settle(a, { throttle: 1, boost: true }))).toBeCloseTo(MINI.boost, 0);
  });

  it('climbs at its published rate and no faster', () => {
    const s = settle(a, { lift: 1 }, 6);
    expect(s.vy).toBeCloseTo(MINI.climb, 0);
  });

  it('cannot be pushed through the ground', () => {
    const s = newState(0, 40, 0);
    s.mode = 'flying';
    for (let i = 0; i < 600; i++) step(s, a, { ...NEUTRAL, lift: -1 }, 12, 1 / 60);
    expect(s.y).toBeGreaterThanOrEqual(12);
  });

  it('is turned back by the wall along x', () => {
    const s = newState(1500, 300, 0);
    s.mode = 'flying';
    s.yaw = Math.PI / 2; // pointing at +x
    for (let i = 0; i < 60 * 30; i++) step(s, a, { ...NEUTRAL, throttle: 1 }, 0, 1 / 60);
    expect(s.x).toBeLessThan(1760);
  });

  it('survives a frame the length of a tab refocus without exploding', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    step(s, a, { ...NEUTRAL, throttle: 1 }, 0, 12);
    expect(Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz)).toBe(true);
    expect(s.y).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: FAIL — `newState is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/components/fly/flightModel.ts`:

```ts
export type Mode = 'grounded' | 'spooling' | 'flying' | 'lost';

export type Controls = {
  /** 1 = W, -1 = S. A SPEED demand, not a thrust lever: the autothrottle
      below turns it into thrust, which is the assist that lets the fleet
      table's speeds be reachable without the pilot trimming anything. */
  throttle: -1 | 0 | 1;
  /** 1 = A, -1 = D. */
  steer: -1 | 0 | 1;
  /** 1 = Space, -1 = Shift. A climb RATE demand. */
  lift: -1 | 0 | 1;
  /** 1 = E, -1 = Q. Multirotors only. */
  slide: -1 | 0 | 1;
  boost: boolean;
  start: boolean;
};

export const NEUTRAL: Controls = {
  throttle: 0, steer: 0, lift: 0, slide: 0, boost: false, start: false,
};

export type FlightState = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number; roll: number;
  /** This frame's accelerations. Scratch, written by whichever airframe
      branch ran and consumed by integrate() — fields rather than a
      returned vector so a frame allocates nothing. */
  ax: number; ay: number; az: number;
  mode: Mode;
  /** Seconds spent in the current mode. */
  since: number;
  /** Rotor spool, 0..1. Thrust follows its square, as thrust does. */
  rotor: number;
  /** Last computed lift share — read by the rotor groups and the HUD. */
  liftShare: number;
};

export const newState = (x: number, y: number, z: number): FlightState => ({
  x, y, z,
  vx: 0, vy: 0, vz: 0,
  yaw: 0, pitch: 0, roll: 0,
  ax: 0, ay: 0, az: 0,
  mode: 'grounded',
  since: 0,
  rotor: 0,
  liftShare: 1,
});

/* The plate does not repeat across x, so the craft is turned back before
   its edge shows. A push that grows with the overshoot, not a wall. */
const WALL_X = 620;

/* A frame longer than this is a tab that was in the background, not a
   slow computer. Integrating it would tunnel the craft through the
   ground; the same clamp FlightScene already applies to its own clock. */
const MAX_DT = 0.1;

const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-dt * rate));

export function step(s: FlightState, a: Airframe, c: Controls, groundY: number, dt: number): void {
  const h = Math.min(MAX_DT, Math.max(0, dt));
  if (h === 0) return;
  s.since += h;

  if (s.mode !== 'flying') return; // Task 5 fills in the other modes

  const speed = Math.hypot(s.vx, s.vz);
  s.liftShare = liftShare(Math.hypot(speed, s.vy), a);

  /* ---- yaw -------------------------------------------------------- */
  s.yaw += c.steer * a.turn * h;

  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);
  const rx = Math.cos(s.yaw);
  const rz = -Math.sin(s.yaw);

  /* ---- lean, and the thrust that comes with it -------------------- */
  /* A quad's TILT is what accelerates it: lean the thrust vector forward
     and its horizontal component is the only force driving the aircraft.
     The cap is the published cruise lean, raised to the full lean while
     boost is held, which is what makes both published speeds reachable. */
  const cap = c.boost ? a.tiltMax : a.tiltCruise;
  const wantTilt = c.throttle > 0 ? cap : c.throttle < 0 ? -a.tiltCruise : 0;
  s.pitch = approach(s.pitch, wantTilt, 3, h);

  const wantSlide = c.slide * (a.strafe ? cap * 0.6 : 0);
  s.roll = approach(s.roll, -wantSlide, 3, h);

  /* Thrust holds altitude while leaning, plus whatever the climb rate
     controller is asking for. Capped, so a quad cannot out-climb itself. */
  const wantClimb = c.lift * a.climb;
  const climbAccel = (wantClimb - s.vy) * 1.6;
  const lean = Math.max(0.3, Math.cos(s.pitch) * Math.cos(s.roll));
  const thrust = Math.min(a.thrustMax, Math.max(0, (G + climbAccel) / lean));

  let ax = (fx * Math.sin(s.pitch) + rx * Math.sin(s.roll)) * thrust;
  let az = (fz * Math.sin(s.pitch) + rz * Math.sin(s.roll)) * thrust;
  let ay = thrust * lean - G;

  /* ---- drag, always opposing the way it is actually going --------- */
  const v = Math.hypot(s.vx, s.vy, s.vz);
  if (v > 0.001) {
    const d = a.CD * v * v;
    ax -= (s.vx / v) * d;
    ay -= (s.vy / v) * d;
    az -= (s.vz / v) * d;
  }

  /* ---- the wall --------------------------------------------------- */
  const over = Math.abs(s.x) - WALL_X;
  if (over > 0) ax -= Math.sign(s.x) * over * 4;

  /* ---- integrate --------------------------------------------------- */
  s.vx += ax * h;
  s.vy += ay * h;
  s.vz += az * h;
  s.x += s.vx * h;
  s.y += s.vy * h;
  s.z += s.vz * h;

  /* ---- the ground -------------------------------------------------- */
  if (s.y < groundY) {
    s.y = groundY;
    if (s.vy < 0) s.vy = 0;
  }
  if (s.y > 900) {
    s.y = 900;
    if (s.vy > 0) s.vy = 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: PASS, 23 tests.

If the cruise/boost speed assertions are off by more than 1 u/s, the fault is the drag direction, not the coefficients: drag must oppose the full 3D velocity, and `CD` was solved against horizontal speed at full lean. Check `lean` is not clamping at 0.3 during level flight before touching any constant.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, 85 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/fly/flightModel.ts src/components/fly/flightModel.test.ts
git commit -m "feat(fly): force integration and multirotor flight

[trailer]"
```

---

### Task 4: The wing

**Files:**
- Modify: `src/components/fly/flightModel.ts`
- Test: `src/components/fly/flightModel.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: no new exports. `step` gains its wing branch.

- [ ] **Step 1: Write the failing test**

Append to `src/components/fly/flightModel.test.ts`:

```ts
describe('step — wing', () => {
  const a = deriveAirframe(CYCLOPS);

  it('cannot hover: at rest with the rotors down it falls', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    /* Above the transition window, so the lift rotors are out of it — the
       aircraft is being asked to hang on its wing at zero airspeed. */
    s.liftShare = 0;
    const before = s.vy;
    step(s, { ...a, vTransStart: -2, vTransEnd: -1 }, NEUTRAL, 0, 1 / 60);
    expect(s.vy).toBeLessThan(before);
    expect(s.vy / (1 / 60)).toBeCloseTo(-G, 0);
  });

  it('holds altitude at cruise', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    s.vz = -CYCLOPS.speed; // yaw 0 faces -z
    for (let i = 0; i < 60 * 8; i++) step(s, a, { ...NEUTRAL, throttle: 1 }, 0, 1 / 60);
    expect(Math.abs(s.y - 300)).toBeLessThan(6);
  });

  it('settles at the published cruise and boost speeds', () => {
    expect(speedOf(settle(a, { throttle: 1 }))).toBeCloseTo(CYCLOPS.speed, 0);
    expect(speedOf(settle(a, { throttle: 1, boost: true }))).toBeCloseTo(CYCLOPS.boost, 0);
  });

  it('pays for a climb in airspeed', () => {
    const s = settle(a, { throttle: 1 }, 40);
    const cruising = speedOf(s);
    for (let i = 0; i < 60 * 5; i++) step(s, a, { ...NEUTRAL, throttle: 1, lift: 1 }, 0, 1 / 60);
    expect(speedOf(s)).toBeLessThan(cruising - 2);
    expect(s.vy).toBeGreaterThan(3);
  });

  it('sinks below the stall however hard it is asked to climb', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    s.vz = -(stallSpeed(a) * 0.8);
    s.liftShare = 0;
    const slow = { ...a, vTransStart: -2, vTransEnd: -1 };
    for (let i = 0; i < 60 * 2; i++) step(s, slow, { ...NEUTRAL, lift: 1 }, 0, 1 / 60);
    expect(s.vy).toBeLessThan(-1);
  });

  it('turns by banking, without a rudder key', () => {
    const s = settle(a, { throttle: 1 }, 20);
    const yaw0 = s.yaw;
    for (let i = 0; i < 60 * 3; i++) step(s, a, { ...NEUTRAL, throttle: 1, steer: 1 }, 0, 1 / 60);
    expect(Math.abs(s.roll)).toBeGreaterThan(0.2);
    expect(Math.abs(s.yaw - yaw0)).toBeGreaterThan(0.5);
  });

  it('does not strafe', () => {
    const s = settle(a, { throttle: 1, slide: 1 }, 10);
    expect(Math.abs(s.vx)).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: FAIL — the wing currently runs the multirotor branch, so "cannot hover" fails (it holds altitude) and "pays for a climb in airspeed" fails.

- [ ] **Step 3: Write minimal implementation**

In `src/components/fly/flightModel.ts`, replace the body of `step` after the `s.yaw += ...` line with a branch. The multirotor block from Task 3 moves into `stepQuad`, unchanged; add `stepWing` beside it:

```ts
export function step(s: FlightState, a: Airframe, c: Controls, groundY: number, dt: number): void {
  const h = Math.min(MAX_DT, Math.max(0, dt));
  if (h === 0) return;
  s.since += h;
  if (s.mode !== 'flying') return;

  const airspeed = Math.hypot(s.vx, s.vy, s.vz);
  s.liftShare = liftShare(airspeed, a);

  if (a.wing) stepWing(s, a, c, h, airspeed);
  else stepQuad(s, a, c, h);

  integrate(s, h, groundY);
}
```

`integrate(s, a, h, groundY)` is the drag, wall, integration and ground block from Task 3, lifted out verbatim so both airframes share it. It takes the airframe because Task 5 adds the touchdown verdict to its ground clamp. `stepQuad` keeps its own lean/thrust code and writes into `s.ax/ay/az`, the scratch fields already on `FlightState` from Task 3.

```ts
/* A WING IS NOT A QUAD WITH DIFFERENT NUMBERS.

   Three things make it different and all three are here:

   LIFT COMES FROM SPEED, not from a rotor. It acts along the aircraft's
   own up vector, so banking tilts it and the horizontal component turns
   the aircraft. That is a real coordinated turn and it is why the wing
   needs no rudder key — the bank IS the turn.

   THE ANGLE OF ATTACK IS TRIMMED FOR YOU, up to CLmax. That clamp is the
   stall: ask for more lift than the wing can make at this speed and you
   simply do not get it, and the aircraft sinks. Nothing anywhere says
   "if airspeed < stall then". It falls out.

   THE AUTOTHROTTLE IS AN ASSIST and is marked as one. It converts the
   speed demand into thrust, which is what lets the published cruise and
   boost speeds be steady states a pilot reaches by holding one key. */
function stepWing(s: FlightState, a: Airframe, c: Controls, h: number, airspeed: number) {
  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);

  /* ---- autothrottle ------------------------------------------------ */
  const target = c.throttle > 0 ? (c.boost ? a.top : a.cruise) : c.throttle < 0 ? 0 : a.cruise * 0.6;
  const thrust = Math.max(0, Math.min(1, (target - airspeed) * 0.06)) * a.thrustMax;

  /* ---- bank, and the turn it produces ------------------------------ */
  const wantRoll = c.steer * 0.62;
  s.roll = approach(s.roll, wantRoll, 2.2, h);

  /* ---- lift, trimmed to hold the commanded climb, clamped at CLmax -- */
  const wantClimb = c.lift * a.climb;
  const climbAccel = (wantClimb - s.vy) * 0.9;
  const cosRoll = Math.max(0.2, Math.cos(s.roll));
  const needed = (G + climbAccel) / cosRoll;
  const v2 = airspeed * airspeed;
  const CLcmd = v2 > 1 ? Math.min(a.CLmax, Math.max(0, needed / v2)) : 0;
  const wingLift = CLcmd * v2;

  /* The lift rotors, while the blend still gives them a share. */
  const rotorLift = s.liftShare * Math.min(a.liftThrustMax, Math.max(0, G + climbAccel));

  s.ax = fx * thrust + Math.sin(s.roll) * wingLift * -Math.cos(s.yaw);
  s.az = fz * thrust + Math.sin(s.roll) * wingLift * Math.sin(s.yaw);
  s.ay = wingLift * cosRoll + rotorLift - G;

  /* The nose follows the flight path, which is what makes a stall LOOK
     like one: lift runs out, the aircraft sinks, and the nose drops
     because the aircraft is now going downwards. */
  const path = Math.atan2(-s.vy, Math.max(1, Math.hypot(s.vx, s.vz)));
  s.pitch = approach(s.pitch, path, 2.5, h);
}
```

The bank-to-turn coupling is the two `s.ax` / `s.az` terms: the horizontal component of tilted lift acts to the craft's right, and integrating it curves the velocity, which the yaw then follows via:

```ts
  /* Yaw follows the velocity for a wing — it goes where it is pointed
     only because it is turning, never because a key said so. */
  if (Math.hypot(s.vx, s.vz) > 5) s.yaw = Math.atan2(-s.vx, -s.vz);
```

Put that line at the end of `stepWing`, and make the shared `s.yaw += c.steer * a.turn * h` in `step` apply to multirotors only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: PASS, 30 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, 92 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/fly/flightModel.ts src/components/fly/flightModel.test.ts
git commit -m "feat(fly): fixed-wing flight, stall and banked turns

[trailer]"
```

---

### Task 5: Takeoff, landing and the modes

**Files:**
- Modify: `src/components/fly/flightModel.ts`
- Test: `src/components/fly/flightModel.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: `touchdownVerdict(s: FlightState, a: Airframe): 'landed' | 'lost'`, `SPOOL_SEC`, `LOST_SEC`. `step` gains the `grounded`, `spooling` and `lost` branches.

- [ ] **Step 1: Write the failing test**

Append to `src/components/fly/flightModel.test.ts`:

```ts
import { LOST_SEC, SPOOL_SEC, touchdownVerdict } from './flightModel';

describe('modes', () => {
  const a = deriveAirframe(MINI);

  it('ignores the stick on the ground until start is pressed', () => {
    const s = newState(0, 0, 0);
    for (let i = 0; i < 120; i++) step(s, a, { ...NEUTRAL, throttle: 1, lift: 1 }, 0, 1 / 60);
    expect(s.mode).toBe('grounded');
    expect(s.y).toBe(0);
    expect(s.rotor).toBe(0);
  });

  it('spools before it moves', () => {
    const s = newState(0, 0, 0);
    step(s, a, { ...NEUTRAL, start: true }, 0, 1 / 60);
    expect(s.mode).toBe('spooling');
    for (let i = 0; i < Math.floor(SPOOL_SEC * 60) - 2; i++) step(s, a, { ...NEUTRAL, lift: 1 }, 0, 1 / 60);
    expect(s.mode).toBe('spooling');
    expect(s.y).toBe(0);
    expect(s.rotor).toBeGreaterThan(0.5);
    expect(s.rotor).toBeLessThan(1);
  });

  it('is flying, with the rotors up, once the spool finishes', () => {
    const s = newState(0, 0, 0);
    step(s, a, { ...NEUTRAL, start: true }, 0, 1 / 60);
    for (let i = 0; i < Math.ceil(SPOOL_SEC * 60) + 2; i++) step(s, a, { ...NEUTRAL, lift: 1 }, 0, 1 / 60);
    expect(s.mode).toBe('flying');
    expect(s.rotor).toBe(1);
  });

  it('counts a slow level arrival as a landing', () => {
    const s = newState(0, 0, 0);
    s.vy = -3;
    expect(touchdownVerdict(s, a)).toBe('landed');
  });

  it('counts a fast arrival as a crash', () => {
    const s = newState(0, 0, 0);
    s.vy = -9;
    expect(touchdownVerdict(s, a)).toBe('lost');
  });

  it('counts a banked arrival as a crash however gently it lands', () => {
    const s = newState(0, 0, 0);
    s.vy = -1;
    s.roll = 0.4; // ~23 degrees
    expect(touchdownVerdict(s, a)).toBe('lost');
  });

  it('returns to grounded after the lost beat', () => {
    const s = newState(0, 0, 0);
    s.mode = 'lost';
    s.since = 0;
    for (let i = 0; i < Math.ceil(LOST_SEC * 60) + 2; i++) step(s, a, NEUTRAL, 0, 1 / 60);
    expect(s.mode).toBe('grounded');
    expect(s.rotor).toBe(0);
  });

  it('lands itself when it meets the ground gently while flying', () => {
    const s = newState(0, 6, 0);
    s.mode = 'flying';
    s.vy = -2;
    for (let i = 0; i < 60 * 8; i++) step(s, a, NEUTRAL, 0, 1 / 60);
    expect(['grounded', 'lost']).toContain(s.mode);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: FAIL — `touchdownVerdict is not a function`, and the mode tests fail because `step` returns early for every non-flying mode.

- [ ] **Step 3: Write minimal implementation**

Append to `src/components/fly/flightModel.ts` and wire the branches into `step`:

```ts
/* Long enough that the aircraft is visibly getting ready rather than
   leaping. This beat IS the takeoff: a craft that unsticks the instant a
   key goes down reads as a toy, however good the model under it is. */
export const SPOOL_SEC = 1.2;
export const LOST_SEC = 1.5;

/* How gently, and how level, an arrival has to be. */
const LAND_SINK = 4;
const LAND_TILT = (12 * Math.PI) / 180;

export const touchdownVerdict = (s: FlightState, a: Airframe): 'landed' | 'lost' =>
  -s.vy < LAND_SINK && Math.abs(s.pitch) < LAND_TILT && Math.abs(s.roll) < LAND_TILT ? 'landed' : 'lost';

const setMode = (s: FlightState, m: Mode) => {
  s.mode = m;
  s.since = 0;
};
```

In `step`, after the `dt` clamp and before the flying branch:

```ts
  if (s.mode === 'grounded') {
    s.rotor = 0;
    s.vx = s.vy = s.vz = 0;
    s.pitch = s.roll = 0;
    s.y = groundY;
    if (c.start) setMode(s, 'spooling');
    return;
  }

  if (s.mode === 'spooling') {
    /* Thrust follows rotor SQUARED, as thrust actually does, so the
       aircraft stays put through most of the spool and then unsticks
       rather than rising linearly out of the ground. */
    s.rotor = clamp01(s.since / SPOOL_SEC);
    s.y = groundY;
    if (s.rotor >= 1) setMode(s, 'flying');
    return;
  }

  if (s.mode === 'lost') {
    s.rotor = 0;
    s.vx = s.vy = s.vz = 0;
    s.y = groundY;
    if (s.since >= LOST_SEC) setMode(s, 'grounded');
    return;
  }
```

And replace the bare ground clamp inside `integrate` with a touchdown test — this is why `integrate` was given the airframe in Task 4:

```ts
  if (s.y < groundY) {
    s.y = groundY;
    if (s.mode === 'flying' && s.vy < -0.2) {
      setMode(s, touchdownVerdict(s, a) === 'landed' ? 'grounded' : 'lost');
      return;
    }
    if (s.vy < 0) s.vy = 0;
  }
```

Finally, ground effect — in the flying branch, before thrust is applied:

```ts
  /* GROUND EFFECT. A rotor close to the ground works against its own
     reflected downwash and gets more thrust for nothing, which is why a
     real quad feels like it unsticks rather than climbs. Two lines. */
  const agl = s.y - groundY;
  const ge = agl < a.span ? 1 + 0.12 * (1 - agl / a.span) : 1;
```

Multiply the multirotor's `thrust` and the wing's `rotorLift` by `ge`. Multiply both by `s.rotor * s.rotor` as well, so the spool ramp is what the aircraft actually feels.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/fly/flightModel.test.ts`
Expected: PASS, 38 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, 100 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/fly/flightModel.ts src/components/fly/flightModel.test.ts
git commit -m "feat(fly): spool-up takeoff, landing verdict and crash state

[trailer]"
```

---

### Task 6: Named rotor groups

**Files:**
- Modify: `src/components/flight/loadCraft.ts:55-67` (the `rotors` option) and its `findRotors` call at line 265
- Modify: `src/components/flight/craft.ts` (`spinRotors`, last function in the file)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `LoadOptions.rotors.groups?: Record<string, { pick?; single?; axis? }>`, `craft.userData.rotorGroups: Record<string, THREE.Object3D[]>`, and `spinRotors(craft, t, rate, hubs?)`.

**This is the only task that touches code outside `/fly`.** `FlightScene.tsx` must keep spinning only the Cyclops pusher, so the existing option shape has to keep working untouched.

- [ ] **Step 1: Write the failing test**

The picks have to become real exported code, not predicates duplicated into a test — a test that asserts against its own copy of the logic passes the moment it is written and proves nothing. Create `src/components/flight/rotorPicks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CYCLOPS_LIFT, CYCLOPS_PUSHER } from './rotorPicks';

/* The Cyclops's rotor hubs, as measured from the node transforms in
   public/models/vtol.glb — four lift rotors on the booms and a two-blade
   pusher at the tail. The nose is -X. These are the coordinates the real
   picks run against at load time, so a pick that fails here fails there. */
const HUBS = [
  { name: 'lift FL', x: 0.92, y: -0.055, z: 0.5 },
  { name: 'lift FR', x: 0.92, y: -0.055, z: -0.5 },
  { name: 'lift AL', x: -0.62, y: -0.055, z: 0.5 },
  { name: 'lift AR', x: -0.62, y: -0.055, z: -0.5 },
  { name: 'pusher', x: 0.527, y: 0.1, z: 0 },
];

describe('Cyclops rotor picks', () => {
  it('selects exactly the pusher', () => {
    expect(HUBS.filter(CYCLOPS_PUSHER).map((h) => h.name)).toEqual(['pusher']);
  });

  it('selects exactly the four lift rotors', () => {
    expect(HUBS.filter(CYCLOPS_LIFT).map((h) => h.name)).toEqual(['lift FL', 'lift FR', 'lift AL', 'lift AR']);
  });

  /* A hub in both groups would be spun at two rates in the same frame,
     and the last writer would win silently. */
  it('never puts one hub in both groups', () => {
    expect(HUBS.filter((h) => CYCLOPS_PUSHER(h) && CYCLOPS_LIFT(h))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/flight/rotorPicks.test.ts`
Expected: FAIL — `Cannot find module './rotorPicks'`.

- [ ] **Step 2b: Create the picks module**

Create `src/components/flight/rotorPicks.ts`:

```ts
/* Where the Cyclops's propellers are, as measured off the model rather
   than guessed. Exported so FlightScene, FlyGame and the test all use the
   same predicate — three copies of a rule about geometry is three chances
   to disagree with the aircraft.

   Model coordinates, which is what loadCraft hands a pick: the nose is -X,
   the pusher sits on the centreline at the tail (+X, z about 0) and the
   four lift rotors sit off the booms at z = +/-0.5. */
export const CYCLOPS_PUSHER = (c: { x: number; z: number }) => Math.abs(c.z) < 0.25 && c.x > 0.4;
export const CYCLOPS_LIFT = (c: { x: number; z: number }) => Math.abs(c.z) > 0.25;
```

Then update `FlightScene.tsx`'s `loadCraft('/models/vtol.glb', …)` call to import `CYCLOPS_PUSHER` and use it in place of its inline predicate. Behaviour is identical — this is the deduplication that makes the test meaningful.

- [ ] **Step 3: Write the implementation**

In `src/components/flight/loadCraft.ts`, extend the option (keeping every existing field):

```ts
  rotors?: {
    pick?: (centre: THREE.Vector3) => boolean;
    single?: boolean;
    axis?: 'x' | 'y';
    /* NAMED GROUPS, for an aircraft whose propellers do different jobs.
       The Cyclops has four lift rotors and a pusher, and /fly drives them
       at different rates through a transition — the lift rotors spooling
       down as the pusher spools up. Each entry is picked and binned
       exactly as the flat form above is.

       ADDITIVE. With no `groups`, this behaves precisely as it did, which
       is what FlightScene depends on: the homepage spins the pusher only
       and must go on doing that. */
    groups?: Record<string, { pick?: (centre: THREE.Vector3) => boolean; single?: boolean; axis?: 'x' | 'y' }>;
  };
```

At line 265, build the groups as well as the flat list:

```ts
    holder.userData.rotors = findRotors(root, opts.rotors);
    holder.userData.rotorGroups = {};
    for (const [name, g] of Object.entries(opts.rotors?.groups ?? {})) {
      holder.userData.rotorGroups[name] = findRotors(root, g);
    }
```

`findRotors` must run the flat pick first and the groups afterwards, because it reparents blades into hubs — a blade already attached to a hub is no longer a child of the root. Guard it by making `findRotors` collect candidates from `root.children` before any reparenting, which it already does; if it does not, gather the candidate list once at the top of the function and reuse it for each call.

In `src/components/flight/craft.ts`, let `spinRotors` accept a hub list:

```ts
export function spinRotors(craft: Craft, t: number, rate = 26, hubs?: THREE.Object3D[]) {
  const r = hubs ?? craft.userData.rotors;
  for (let i = 0; i < r.length; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    r[i].rotation.z = t * rate * dir * (1 + i * 0.013);
  }
}
```

Widen the `Craft` type's `userData` to `{ rotors: THREE.Object3D[]; rotorGroups?: Record<string, THREE.Object3D[]>; label: string }`.

- [ ] **Step 4: Verify the homepage is unchanged**

Run: `npx tsc --noEmit` — expected: no output.
Run: `npm test` — expected: PASS, 103 tests.

Then, with `npm run dev` running, open `http://localhost:3000`, scroll to the flight section and confirm by eye that the Cyclops's four lift rotors are still stationary there and only the pusher turns. This is a visual property, so look at it — do not write a script that asserts a number nobody checked.

(Note for this machine: heredocs through the shell tool have failed repeatedly in this project. Put any script in a file and run the file.)

- [ ] **Step 5: Commit**

```bash
git add src/components/flight/loadCraft.ts src/components/flight/craft.ts src/components/flight/rotorGroups.test.ts
git commit -m "feat(flight): named rotor groups on loadCraft

[trailer]"
```

---

### Task 7: Wire the model into FlyGame

**Files:**
- Modify: `src/components/fly/FlyGame.tsx` — the `FLEET` entry for Cyclops (rotor groups), the rAF loop at lines 380-470, `startAt`, and the HUD state

**Interfaces:**
- Consumes: `deriveAirframe`, `newState`, `step`, `stallSpeed`, `liftShare`, `SPOOL_SEC`, `type Controls`, `type FlightState` from Tasks 1-5; `userData.rotorGroups` and the four-argument `spinRotors` from Task 6.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Give the Cyclops its rotor groups**

In the `FLEET` entry for `cyclops`, keep `rotors.pick` exactly as it is and add:

```ts
    rotors: {
      pick: (c) => Math.abs(c.z) < 0.25 && c.x > 0.4,
      single: true,
      axis: 'x',
      groups: {
        /* The pusher, on the fuselage centreline at the tail. Same pick as
           the flat one above, so the homepage and this agree. */
        pusher: { pick: (c) => Math.abs(c.z) < 0.25 && c.x > 0.4, single: true, axis: 'x' },
        /* The four lift rotors, off the centreline on the booms. Binned
           rather than single: they are four separate hubs. */
        lift: { pick: (c) => Math.abs(c.z) > 0.25, axis: 'y' },
      },
    },
```

- [ ] **Step 2: Replace the physics**

Delete lines 393-445 — the `k()` helper, the velocity lerp, the wall push, the floor clamp and the cosmetic `bank`/`pitch` — and the module-level `yaw`, `yawRate`, `pos`, `vel`, `want`, `fwd`, `right`, `bank`, `pitch` they used. Replace with:

```ts
      /* THE PHYSICS LIVES IN flightModel.ts, which knows nothing about
         three, this component or the terrain. It gets keys and a ground
         height; it gives back a position and an attitude. Everything this
         file does with the result is presentation. */
      const air = airframes[Math.max(0, activeIdx)];
      const controls: Controls = {
        throttle: (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) as -1 | 0 | 1,
        steer: (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0) - (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) as -1 | 0 | 1,
        lift: (held.has('Space') ? 1 : 0) - (held.has('ShiftLeft') || held.has('ShiftRight') ? 1 : 0) as -1 | 0 | 1,
        slide: (held.has('KeyE') ? 1 : 0) - (held.has('KeyQ') ? 1 : 0) as -1 | 0 | 1,
        boost: held.has('KeyB'),
        start: held.has('Space') || held.has('KeyW'),
      };

      if (!pausedRef.current) {
        step(fly, air, controls, groundAt(fly.x, fly.z), dt);
      }
```

where `airframes` is built once beside the fleet load:

```ts
      const airframes = FLEET.map((f) =>
        deriveAirframe({ key: f.key, span: f.span, speed: f.speed, boost: f.boost, turn: f.turn, climb: f.climb, strafe: f.strafe })
      );
```

and `fly` is the single mutable state, declared in the same `useEffect` scope that currently holds `pos`, `vel` and `yaw` — beside the scene and renderer, outside the rAF callback, so it survives between frames:

```ts
    const fly = newState(0, 0, 0);
```

It is `const` because `step` mutates it in place; nothing ever reassigns it.

`startAt(spec)` now places the aircraft **on the ground**: set `fly.x`, `fly.z`, `fly.y = groundAt(x, z)`, `fly.mode = 'grounded'`, and leave the rest at `newState`'s defaults.

- [ ] **Step 3: Drive the aircraft and its rotors from the state**

Replace the transform block (lines ~458-470) with:

```ts
      if (active) {
        active.position.set(fly.x, fly.y, fly.z);
        active.rotation.set(0, 0, 0);
        active.rotateY(fly.yaw);
        active.rotateY(Math.PI); // the craft's +Z is its nose
        active.rotateX(fly.pitch);
        active.rotateZ(-fly.roll);

        /* TWO GROUPS, TWO RATES. The lift rotors follow the transition
           blend, so they wind down as the wing takes over and stop dead in
           wing-borne flight; the pusher follows the spool. On a quad there
           are no groups and the flat list spins as before. */
        const groups = active.userData.rotorGroups;
        if (groups?.lift && groups?.pusher) {
          spinRotors(active, t, 34 * fly.rotor * fly.liftShare, groups.lift);
          spinRotors(active, t, 40 * fly.rotor, groups.pusher);
        } else {
          spinRotors(active, t, (spec.strafe ? 40 : 28) * fly.rotor);
        }

        lightTarget.position.set(fly.x, fly.y, fly.z);
      }
```

- [ ] **Step 4: Extend the HUD**

Extend the `setHud` call inside the existing 120 ms throttle:

```ts
          const stall = stallSpeed(air);
          setHud({
            speed: Math.round(Math.hypot(fly.vx, fly.vz)),
            alt: Math.round(fly.y - groundAt(fly.x, fly.z)),
            heading: Math.round(((-fly.yaw * 180) / Math.PI % 360 + 360) % 360),
            edge: Math.abs(fly.x) > 560,
            mode: !air.wing ? '' : fly.liftShare > 0.98 ? 'VERTICAL' : fly.liftShare > 0.02 ? 'TRANSITION' : 'WING',
            stall: stall > 0 && Math.hypot(fly.vx, fly.vy, fly.vz) < stall * 1.05,
            sink: Math.round(-fly.vy),
            state: fly.mode,
          });
```

Render `mode` next to the speed read-out in the existing HUD block, `stall` as a warning on the speed figure, and add a centred card for `state === 'lost'` reading `SIGNAL LOST` and for the moment of a successful landing reading `LANDED`. Reuse the existing pause card's classes so it matches.

Update the pause card's copy from `Press W to take off.` to `Hold Space to spool up.`

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit` — expected: no output.
Run: `npx eslint src/components/fly/ src/components/flight/` — expected: no errors.
Run: `npm test` — expected: PASS, 103 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/fly/FlyGame.tsx
git commit -m "feat(fly): fly the model, and drive both rotor groups from it

[trailer]"
```

---

### Task 8: Fly it, then tune it

**Files:**
- Create: `scripts/flycheck.mjs` (throwaway; delete before the final commit or keep under `scripts/` if it earns its place)
- Modify: `src/components/fly/flightModel.ts` (constants only)

**Interfaces:**
- Consumes: everything.
- Produces: nothing.

- [ ] **Step 1: Write the browser check**

Playwright's WebKit build is the one installed on this machine; Chromium's headless shell is not. Create `scripts/flycheck.mjs`:

```js
import { webkit } from 'playwright';

const B = 'http://localhost:3000/fly';
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => m.type() === 'error' && errs.push('console ' + m.text().slice(0, 160)));

await page.goto(B, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);

const hud = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));

await page.keyboard.press('Enter');                  // dismiss the pause card if focused
await page.mouse.click(720, 450);
await page.keyboard.down('Space');
await page.waitForTimeout(2500);
console.log('after spool + climb:', await hud());

await page.keyboard.up('Space');
await page.keyboard.down('KeyW');
await page.waitForTimeout(9000);
console.log('after 9s of throttle:', await hud());

await page.keyboard.up('KeyW');
await page.waitForTimeout(8000);
console.log('after slowing down:', await hud());

console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
await browser.close();
```

- [ ] **Step 2: Run it**

Run: `node scripts/flycheck.mjs` (with `npm run dev` running).

Expected, for the Cyclops:
- after the spool, the HUD reads `VERTICAL` and altitude is climbing
- after 9 s of throttle, the HUD reads `WING` and speed is near 70
- after slowing, it returns through `TRANSITION` to `VERTICAL`
- `errors: none`

- [ ] **Step 3: Fly it by hand and tune**

Open `http://localhost:3000/fly` and fly each of the three aircraft. Tune **in this order**, and only these constants in `flightModel.ts`:

1. `G` — if the whole fleet feels heavy or floaty. Everything else is solved around it, so this moves all three aircraft together.
2. `TILT_MAX` — if the quads look wrong leaning, rather than feel wrong moving.
3. `TRANS_START` / `TRANS_END` — if the transition is over too fast to see, or drags.
4. `CLMAX_RATIO` — **last**, and only if the Cyclops is annoying rather than characterful. Raising it lowers the stall speed and makes the wing more forgiving.

After each change run `npm test`. The tests pin every published speed and the transition invariant, so tuning cannot silently break the fleet table — if a test goes red, the constant moved something it was not supposed to.

- [ ] **Step 4: Confirm nothing else moved**

Run: `npm test` — expected: PASS, 103 tests.
Run: `npx tsc --noEmit` — expected: no output.
Run: `npx eslint src/` — expected: no new errors (the pre-existing count is 17 warnings).
Load `http://localhost:3000` and confirm the homepage flight section is unchanged and the Cyclops's lift rotors there are still still.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(fly): tune the flight model against the real thing

[trailer]"
```

---

## Notes for whoever executes this

**The one bug most likely to reach a screen** is the mid-transition sink, and Task 2 asserts against it directly. If you change `TRANS_START`, `TRANS_END`, `CLMAX_RATIO` or `LIFT_TWR`, that test is the one to watch.

**If a published speed comes out wrong**, suspect the drag direction before the coefficients. Drag opposes the full 3D velocity; `CD` was solved against horizontal speed at full lean. The algebra in Task 1 is asserted separately from the integration in Tasks 3-4 precisely so you can tell which half is lying.

**The wing's yaw is not steered.** `s.yaw` follows the velocity vector; the only thing the steer key touches is roll. If the Cyclops refuses to turn, the fault is in the horizontal component of tilted lift, not in `a.turn` — which the wing branch never reads.

**The assists are inlined, and the spec said they would be a separate layer.** This is a deliberate deviation: an assists-off mode is an explicit non-goal, and a layer built for one caller is a layer built on a guess about what the second caller will need. They are all in `step`, and all findable:

| Assist | Where |
|---|---|
| auto-level | `wantRoll`/`wantTilt` return to 0 when the steer key is released |
| turn coordination | the horizontal component of tilted lift in `stepWing` |
| climb-rate command | `climbAccel`, in both branches — the pilot asks for a rate, not an attitude |
| autothrottle | `thrust` in `stepWing` — a speed demand, not a thrust lever |
| stall recovery | `s.pitch` following the flight path in `stepWing` |

If assists-off is ever wanted, extract those five into a function that transforms `Controls` plus state into the same intermediate quantities, and have `step` call it. Not before.

**Don't fix `loadCraft.normalise()` while you are in there.** It is a known offset bug with a live workaround in FlyGame, and fixing it moves the viewer hotspot anchors on three product pages. Separate job.
