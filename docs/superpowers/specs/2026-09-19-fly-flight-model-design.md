# /fly — flight model and takeoff

**Date:** 2026-09-19
**Status:** design approved in chat; not yet planned or implemented
**Scope:** the hidden `/fly` free-flight page only

---

## Why

`/fly` currently has no flight model. `FlyGame.tsx:393-445` eases a velocity
vector toward a desired one:

- **There is no gravity.** `want.y = lift * spec.climb` sets vertical
  *velocity* directly, so releasing the lift key decays it to zero and the
  aircraft hangs in the air.
- **Attitude is decoration.** `bank` and `pitch` are commented "for show" —
  they follow the motion rather than causing it.
- **There is no takeoff.** `startAt()` places the aircraft and the pause card
  says "Press W to take off", which simply moves it forward.
- **The Cyclops is a quad with different numbers.** The only differences
  between the VTOL and the Mini are `speed`, `boost`, `turn`, `bank` and
  `strafe: false`. It hovers indefinitely, which a fixed wing cannot do.

The last point is the one that matters commercially: the site sells the
Cyclops as a VTOL, and in the sim it flies like a quadcopter.

## What was decided

| Question | Decision |
|---|---|
| Realism | Convincing, not demanding. Gravity, airspeed and stall are real; the aircraft auto-levels, transitions by itself, and mushes rather than departing. |
| Controls | The same five keys, with new meanings. No new axis to learn. |
| Ground contact | A slow level touchdown is a landing; anything else is a crash, 1.5s, respawn on the ground. |
| Structure | One force model with per-airframe coefficients — not two models plus a handover, and not a state machine over the existing kinematics. |

## Non-goals

- **Mobile and touch.** Desktop keyboard only. `FlyGame.tsx` already tells
  touch visitors the sim needs a keyboard and that message stays; the hero's
  hold-to-fly gesture is `(pointer: fine)` only. No touch controls, no
  on-screen stick, no layout work for small screens.
- **An assists-off mode.** The assist layer is kept separable so this stays
  possible later, but it is not built now.
- **Terrain.** The 2400-unit repeat is a known, accepted property. Out of
  scope here.
- **Objectives or missions.** Later, if at all.
- **The `loadCraft.normalise()` offset bug** and FlyGame's per-craft
  re-centring workaround. Still outstanding, deliberately untouched.

---

## Architecture

### New module: `src/components/fly/flightModel.ts`

Pure. No `three`, no `terrain` import, no DOM. Plain numeric state, so it runs
in the existing node-environment vitest with no new dependency.

```ts
type Mode = 'grounded' | 'spooling' | 'flying' | 'lost';

type Airframe = {          // derived once per spec, never hand-written
  wing: boolean;
  G: number;               // gravity, world units / s²
  CL: number; CLmax: number; CD: number; thrustMax: number;
  hoverThrust: number; liftThrustMax: number;
  tiltMax: number; tiltCruise: number;
  vTransStart: number; vTransEnd: number;
  turn: number; climb: number; span: number; strafe: boolean;
};

type Controls = {
  throttle: -1 | 0 | 1;
  steer: -1 | 0 | 1;
  lift: -1 | 0 | 1;
  slide: -1 | 0 | 1;
  boost: boolean;
  start: boolean;
};

type FlightState = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number; roll: number;
  mode: Mode;
  since: number;      // seconds in the current mode
  rotor: number;      // 0..1 spool
  liftShare: number;  // exposed for the rotor groups and the HUD
};

deriveAirframe(spec: Spec): Airframe
step(s: FlightState, a: Airframe, c: Controls, groundY: number, dt: number): void  // mutates
liftShare(airspeed: number, a: Airframe): number
stallSpeed(a: Airframe): number
touchdownVerdict(s: FlightState, a: Airframe): 'landed' | 'lost'
```

`step` mutates rather than returning a new object: it runs every frame, and a
fresh state object per frame is garbage the renderer has no use for.

**Ground arrives as a sampled height**, not a `groundAt` import. This is the
boundary that makes the model testable — a test hands it flat ground or a
ramp — and it keeps `terrain.ts` and `three` out of the unit tests entirely.

### Everything is an acceleration

No mass parameter. Mass only ever appears divided back out, so carrying it
means two numbers to tune where one will do.

`G = 45 u/s²`, reasoned from the world's scale rather than picked: the Cyclops
spans 11 units and about 2.2 m, so one unit is roughly 0.2 m and 9.81 m/s² is
about 49 u/s². Tunable, and the first number to reach for if everything feels
heavy or floaty.

### Coefficients are solved from the fleet table

`speed`, `boost`, `climb` and `turn` in `FlyGame.tsx:75-118` are unchanged and
become the targets the coefficients are solved for, so the fleet keeps the
character it already has.

**Wing (Cyclops)** — `v_c = speed = 70`, `v_max = boost = 150`, `climb = 30`:

```
CL        = G / v_c²                       level cruise at 70       → 0.00918
CLmax     = 2.2 · CL                       margin to stall
v_stall   = √(G / CLmax)                                            → 47.2 u/s
thrustMax = (G · climb / v_c) / (1 − (v_c/v_max)²)                  → 24.7 u/s²
CD        = thrustMax / v_max²             top speed is boost       → 0.0011
```

The `thrustMax` form falls out of requiring both that full thrust equals drag
at `v_max`, and that the excess thrust at cruise produces exactly `climb`. So
the aircraft hits both published numbers by construction — and a test asserts
it rather than trusting the algebra.

**Quad (Mini, Noxr)** — `hoverThrust = G`, `TWR = 2.0`, `tiltMax = 35°`:

```
thrustMax = G · TWR
CD        = G · tan(tiltMax) / boost²      FULL lean is the BOOST speed  → 0.00875 (Mini)
tiltCruise = atan(speed² · CD / G)         the cap without boost         → 7.5° (Mini)
```

Motion comes from tilt: the quad leans, and the tilt *is* what accelerates it,
with thrust raised to hold altitude while leaning. Climb stays rate-commanded
and capped at `spec.climb` — an assist, and marked as one.

**`CD` is solved from `boost`, not from `speed`, and the tilt cap does the
rest.** Since horizontal acceleration is `G · tan θ` and drag is `CD · v²`,
top speed goes as `tan θ`, so a quad at its highest speed must be at its
fullest lean. Solving from `spec.speed` instead would put the Mini at 35° of
lean at a gentle 26 u/s and leave `spec.boost` meaning nothing. This way the
boost key raises the tilt cap from `tiltCruise` to `tiltMax`, both published
speeds are reproduced, and the aircraft flies nearly level when loitering and
leans hard when pushed — which is what a quadcopter visibly does.

### The transition is not a state

`liftShare` is a continuous function of airspeed:

```
liftShare         = 1 − smoothstep(vTransStart, vTransEnd, airspeed)   40 → 55 u/s
lift rotors       = min(liftShare · (G + climb demand), liftShare · liftThrustMax)
support AVAILABLE = liftShare · liftThrustMax  +  CLmax · v²
```

**The invariant is written against `CLmax`, not `CL`.** `CL` is the
coefficient at cruise trim — by construction `CL · v² = G` only at 70 u/s —
so measuring the transition against it says the aircraft sinks at 55 u/s
(28 against a weight of 45), which is an artefact of the wrong coefficient
rather than a real hole. A wing carries its weight anywhere above stall by
flying at a higher angle of attack, and the honest question is how much lift
is *available*: `CLmax · v²` is 61.5 at 55 u/s against the same 45. The
window closing above `v_stall` is precisely what guarantees this, which is
why `vTransEnd` is derived from stall speed rather than typed in.

`liftThrustMax = G · 1.6` for the VTOL — the four lift rotors' combined
authority, which is a separate quantity from the pusher's `thrustMax` and has
to exist, or "climb demand" in the hover is unbounded. The 0.6 of margin over
weight is what gives it a hover climb rate at all; that rate is still capped
at `spec.climb` by the assist layer, as it is for the quads.

Both directions are automatic, and back-transition needs no code of its own:
it is the same line run backwards, because the pilot slowed down. `vTransEnd`
sits above `v_stall` (55 > 47.2), so the wing is genuinely flying before the
lift rotors are done.

**The one dangerous property:** if total support dips below weight anywhere in
that window, the aircraft sinks mid-transition — the failure that makes
tiltrotor sims feel broken. It is asserted against directly (see Tests).

### Discrete states

```
grounded   on the terrain, rotors idle, stick ignored except `start`
spooling   1.2s. Rotor speed ramps 0 → 1 and thrust follows rotor², as thrust
           actually does. The aircraft stays put, then unsticks. This beat is
           what stops takeoff reading as a toy.
flying     the force model runs
lost       1.5s, then back to grounded
```

**Ground effect:** below one span of altitude, thrust is multiplied by
`1 + 0.12 · (1 − h/span)`, with a small lateral wobble. Real, and two lines.

**Touchdown**, evaluated on ground contact while flying:

```
sink < 4 u/s  AND  |pitch| < 12°  AND  |roll| < 12°  → landed (spool down, back to grounded)
otherwise                                            → lost
```

### Assists, kept separable

A distinct layer applied to the controls before the physics, never inside it:
auto-level on key release, turn coordination so a bank turns without a rudder
key, and a stall that pitches the nose toward recovery. Separable so an
assists-off mode stays possible later without unpicking the model.

---

## Changes to existing code

### `FlyGame.tsx` loses its physics

Lines 393-445 — the velocity lerp, the wall push, the floor clamp, the
cosmetic bank and pitch — collapse to roughly ten lines: read keys into
`Controls`, call `step`, copy the state onto the THREE object. The file keeps
loading, camera modes, HUD and the React shell, and stops growing at ~700
lines.

The endless-z loop snap stays exactly as it is. The x wall moves into the
model, so it acts on acceleration rather than on velocity directly.

### Rotor groups — the only change reaching outside `/fly`

The Cyclops GLB is a true quadplane and its rotors are separable, verified by
reading the node transforms in `public/models/vtol.glb`:

```
nodes 27, 29, 30, 31   four lift rotors: x = +0.92 (forward pair) and −0.62
                       (aft pair), z = ±0.5; meshes 14 and 15 are mirrored,
                       i.e. counter-rotating pairs
nodes  6,  7           pusher, two blades at x = +0.527, z = 0 (the tail;
                       the nose is −X)
```

All six are children of the root with their own transforms. Today
`rotors: { pick: c => Math.abs(c.z) < 0.25 && c.x > 0.4, single: true }`
selects only the pusher, so those four sit dead on screen through every hover.

`loadCraft`'s `rotors` option gains **named groups**, added alongside the
current shape rather than replacing it. `/fly` drives `lift` from
`liftShare · rotor` and `pusher` from throttle, so the four spin in the hover,
spool down through the transition, and stop once the wing is flying.

**`FlightScene` (homepage) is not changed** and keeps spinning only the
pusher. This is the one place regression risk lives.

### HUD

Gains what the model now knows: mode (VERTICAL / TRANSITION / WING), airspeed
against a stall marker, sink rate on approach, and the LANDED / SIGNAL LOST
card. The existing 120 ms throttle stays — no per-frame React.

---

## Tests

Unit, against `flightModel.ts`:

**The fleet table is honoured** — a real risk, since the coefficients are
solved from it:

- Cyclops settles at 70 u/s in steady level flight, and 150 at full thrust
- Cyclops best climb rate is ≈ 30 u/s
- Mini settles at 26 u/s at the cruise tilt cap, and at 60 with boost held
- a quad at hover thrust holds altitude: vertical acceleration ≈ 0
- the Cyclops's hover climb rate is capped at `spec.climb`, and its lift
  rotors cannot exceed `liftThrustMax`

**The chosen behaviours**

- Cyclops at rest with lift rotors down: vertical acceleration ≈ −G
- below stall with full up demand, it still sinks
- commanding a climb from cruise reduces airspeed over the following seconds

**The transition**

- `liftShare` is 1 below `vTransStart`, 0 above `vTransEnd`, monotone between
- **support never dips below weight** at any airspeed across the window at
  constant throttle — the mid-transition sink

**States**

- `grounded` ignores stick input until `start`
- `spooling` runs its full duration, and the aircraft does not move before it ends
- touchdown at 3 u/s level → `landed`; at 9 u/s, or banked past 12° → `lost`
- `lost` returns to `grounded` after 1.5s

**Robustness**

- the ground is never penetrated, for any dt
- a large dt neither tunnels nor explodes
- the x wall turns the craft back

Browser, in WebKit against the dev server, as with the hero's hold gesture:
take off → VERTICAL → hold W → WING → slow → land. Plus a homepage run
confirming the flight section still spins only the pusher, and the existing 62
tests staying green.

---

## Risks

1. **Coefficients that satisfy the table but feel wrong.** The algebra
   guarantees the numbers, not the feel. Tune `G` first, then `tiltMax` and
   the transition window; the tests pin the published numbers so tuning
   cannot silently break them.
2. **Mid-transition sink.** Directly asserted, above.
3. **Rotor groups touching `loadCraft`.** Additive change, homepage usage
   unchanged, verified in the browser.
4. **The Cyclops becoming unpleasant to fly.** It now has a stall speed and
   cannot stop in mid-air. If that reads as annoying rather than
   characterful, the lever is `CLmax` — a lower stall speed — before anything
   structural.
