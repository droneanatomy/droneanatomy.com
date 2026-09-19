import { describe, expect, it } from 'vitest';
import { G, deriveAirframe, stallSpeed, liftShare, type AirframeSpec } from './flightModel';

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

  /* bankMax is solved from the fleet table and has no ceiling of its own,
     so the table can ask for a bank the wing cannot hold. A level banked
     turn needs lift G / cos(phi), and the most the wing can make at cruise
     is CLmax * cruise^2, which is exactly CLmax/CL times weight — so the
     steepest SUSTAINABLE bank is acos(CL / CLmax), 62.96 degrees here.
     Past it the CLmax clamp bites and the aircraft descends through the
     very turn its fleet entry advertises.

     Equivalently the table must keep turn * cruise under G * tan(that) =
     88.2. The Cyclops sits at 52.5. Asserted rather than clamped, so a
     new airframe fails loudly here instead of quietly under-turning; any
     wing added to the fleet belongs in this assertion. */
  it('cannot ask for a bank its own wing cannot hold', () => {
    const sustainable = Math.acos(a.CL / a.CLmax);
    expect(a.bankMax).toBeLessThan(sustainable);
    expect(CYCLOPS.turn * CYCLOPS.speed).toBeLessThan(G * Math.tan(sustainable));
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

  /* Starts inside the wall (WALL_X is 650) so the craft experiences the
     soft restoring push as it approaches, not the hard clamp that a start
     far outside the wall would immediately exercise. */
  it('is turned back by the wall along x', () => {
    const s = newState(600, 300, 0);
    s.mode = 'flying';
    s.yaw = Math.PI / 2; // pointing at +x
    for (let i = 0; i < 60 * 30; i++) step(s, a, { ...NEUTRAL, throttle: 1 }, 0, 1 / 60);
    expect(s.x).toBeLessThan(700);
  });

  it('survives a frame the length of a tab refocus without exploding', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    step(s, a, { ...NEUTRAL, throttle: 1 }, 0, 12);
    expect(Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz)).toBe(true);
    expect(s.y).toBeGreaterThanOrEqual(0);
  });
});

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

  /* The multirotor has this test; the wing needs its own, because Task 1
     only asserts the ALGEBRA that thrustMax should deliver the published
     rate, which is a different claim from the loop actually settling
     there. Starts low so 15 seconds of climb stays under the ceiling. */
  it('climbs at its published rate and no faster', () => {
    const s = settle(a, { throttle: 1 }, 40, newState(0, 60, 0));
    for (let i = 0; i < 60 * 15; i++) step(s, a, { ...NEUTRAL, throttle: 1, lift: 1 }, 0, 1 / 60);
    expect(s.vy).toBeCloseTo(CYCLOPS.climb, 0);
    expect(s.y).toBeLessThan(900); // never touched the ceiling clamp
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

  /* THE SIGN TEST. It names a key, but it asserts nothing about the sign
     of steer or of yaw — only that the bank and the resulting motion
     agree — so it cannot be satisfied by flipping a convention: bank one
     way and the aircraft must end up travelling that way. Starting from yaw 0
     the craft faces -z, so its own right is +x.

     Roll is positive-right throughout this module — the same convention
     the multirotor's `rx * sin(roll)` already uses — so a positive roll
     must produce motion towards +x, and a negative roll towards -x. If
     this ever fails, the fix is the sign in stepWing, never here. */
  it('goes the way it banks', () => {
    const right = settle(a, { throttle: 1 }, 20);
    for (let i = 0; i < 60 * 3; i++) step(right, a, { ...NEUTRAL, throttle: 1, steer: -1 }, 0, 1 / 60);
    expect(right.roll).toBeGreaterThan(0.2); // banked right
    expect(right.vx).toBeGreaterThan(5); // and is now going right

    const left = settle(a, { throttle: 1 }, 20);
    for (let i = 0; i < 60 * 3; i++) step(left, a, { ...NEUTRAL, throttle: 1, steer: 1 }, 0, 1 / 60);
    expect(left.roll).toBeLessThan(-0.2);
    expect(left.vx).toBeLessThan(-5);
  });

  /* Both airframes must answer the same key with the same turn, or the
     fleet flies with two different sets of controls. */
  it('turns the same way a multirotor does for the same key', () => {
    const q = deriveAirframe(MINI);
    const sq = settle(q, { throttle: 1, steer: 1 }, 3);
    const sw = settle(a, { throttle: 1 }, 20);
    const yaw0 = sw.yaw;
    for (let i = 0; i < 60 * 3; i++) step(sw, a, { ...NEUTRAL, throttle: 1, steer: 1 }, 0, 1 / 60);
    expect(Math.sign(sw.yaw - yaw0)).toBe(Math.sign(sq.yaw));
  });

  it('survives a frame the length of a tab refocus without exploding', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    s.vz = -CYCLOPS.speed;
    step(s, a, { ...NEUTRAL, throttle: 1, steer: 1, lift: 1 }, 0, 12);
    expect(Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz + s.yaw + s.pitch + s.roll)).toBe(true);
    expect(s.y).toBeGreaterThanOrEqual(0);
  });

  /* `turn` was a dead field for the wing until bankMax was solved from
     it. This is the claim that makes it live: holding the key at cruise
     gives the rate the fleet table advertises, reached by banking and
     nothing else. Measured off the state's own yaw over a single frame,
     with the wrap normalised, because yaw is an atan2 and wraps at pi.

     Only at CRUISE. omega = G * tan(phi) / v, so the same bank turns more
     slowly the faster it goes — real, and deliberately not asserted
     against the table. */
  it('turns at the published rate at cruise, by banking', () => {
    const s = settle(a, { throttle: 1 }, 40);
    const c = { ...NEUTRAL, throttle: 1, steer: 1 } as Controls;
    for (let i = 0; i < 60 * 8; i++) step(s, a, c, 0, 1 / 60); // let the bank settle

    const yaw0 = s.yaw;
    step(s, a, c, 0, 1 / 60);
    let d = s.yaw - yaw0;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;

    /* Still at cruise. Straight and level the wing holds 70.000 at every
       refresh rate; a sustained full-stick turn leaves a small residual
       that scales with dt, because a turn is a curve and the integrator
       walks it in straight segments. Measured 70.494 at 60Hz against
       70.980 at 30Hz (70.207 at 144Hz, 71.461 at 20Hz).

       The bound is 0.75 — about 1.5x the residual this test actually
       sees, and comfortably under the 1.46 that the same 60Hz run
       produced while yaw was computed after the forces instead of before
       them. So it is also the regression test for that line's placement:
       move it back and this fails. */
    expect(Math.abs(Math.hypot(s.vx, s.vz) - CYCLOPS.speed)).toBeLessThan(0.75);
    expect(d * 60).toBeCloseTo(CYCLOPS.turn, 1);
  });

  /* THE TEST THE SPLIT EXISTS FOR, and it has to watch BOTH directions.
     Summing the two lift sources balloons the aircraft through the
     window; handing over too little sags it, which is the hole
     liftShare() was written to prevent. Tracking only the peak would let
     a hole through silently, so this tracks the floor too.

     The tolerance is 1e-6 either way, which is not a comfort margin: with
     the stick centred the two sources sum to exactly the weight, so the
     only deviation is the rounding in CLcmd's divide-then-multiply by
     v^2 — under a ulp of G per frame, and measured at 1.9e-16 of vy
     across the whole sweep, with y never leaving 300.0 to ten decimals.
     A real imbalance would be a percentage of weight, which is metres.

     Task 2's invariant test measures the lift AVAILABLE from both
     sources. That is no longer what the model commands, so this is the
     test that describes what actually runs. */
  it('neither balloons nor sags through the transition', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    let highest = s.y;
    let lowest = s.y;
    for (let i = 0; i < 60 * 12; i++) {
      step(s, a, { ...NEUTRAL, throttle: 1 }, 0, 1 / 60);
      if (s.y > highest) highest = s.y;
      if (s.y < lowest) lowest = s.y;
    }
    expect(speedOf(s)).toBeGreaterThan(a.vTransEnd); // it did go through
    expect(s.liftShare).toBe(0); // and came out the far side of the blend
    expect(highest - 300).toBeLessThan(1e-6);
    expect(300 - lowest).toBeLessThan(1e-6);
  });
});

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

  /* NOT vy = -2: measured by probe, a MINI recovers from that on its own
     — the rate-hold hover controller plus ground effect's own cushioning
     (both real, both already covered by other tests) arrest a -2 sink
     around y=4.8 and it never reaches the ground at all, so the mode
     machinery below would never even be exercised. -20 clears the
     recovery envelope (empirically the cutoff sits between -14 and -16
     for this airframe from this height) with comfortable margin, so
     ground contact — and therefore a verdict — is guaranteed regardless
     of small future tuning changes to the hover gains. -20 is well past
     it, and NEUTRAL commands no descent at all, so the landing flare
     below (which only softens a COMMANDED sink) never engages here —
     this is a straightforward too-fast-to-arrest crash.

     Stops at the first frame mode leaves 'flying', rather than running
     the full loop: LOST_SEC is only 1.5s, so an 8s loop that kept going
     would run the 'lost' beat all the way back around to 'grounded' and
     the assertion below would see the wrong mode for the wrong reason
     (timer expiry, not touchdown) — the exact ambiguity this whole test
     exists to rule out. */
  it('crashes on a fast, uncommanded arrival', () => {
    const s = newState(0, 6, 0);
    s.mode = 'flying';
    s.vy = -20;
    for (let i = 0; i < 60 * 8 && s.mode === 'flying'; i++) step(s, a, NEUTRAL, 0, 1 / 60);
    expect(s.mode).toBe('lost');
  });

  /* THE END-TO-END LANDING PROOF. Nothing above drives step() all the way
     to 'grounded' through ordinary flight — the crash test above proves
     'lost', and touchdownVerdict's own unit tests prove 'landed' only in
     isolation, by hand-setting vy and calling it directly. A test that
     merely asserted `['grounded','lost']).toContain(mode)` would still
     pass if touchdownVerdict were inverted, or hard-coded to always
     return 'lost' — it says nothing about which verdict fires. This one
     does: it flies a real descent through step() and insists on the
     'grounded' outcome specifically.

     Pulsed rather than held: a HELD descend key commands the airframe's
     full climb rate, which is well past LAND_SINK and crashes every
     time — that gap is exactly what the near-ground landing flare in
     stepQuad/stepWing now closes for a HELD key. This 1-in-6 pulse
     (16.7% duty, inside the 15-30% range that already worked before the
     flare existed) is the proof the flare left that untouched: it is
     gated on the CURRENT sink rate (see FLARE_SINK's comment), so a
     descent this gentle never gets clamped at all and lands exactly as
     it did before the flare was added — measured at 5.02s; 6s gives
     margin without turning this into a slow test. */
  it('lands through step() on a pulsed descent', () => {
    const s = newState(0, 10, 0);
    s.mode = 'flying';
    for (let i = 0; i < 60 * 6 && s.mode === 'flying'; i++) step(s, a, { ...NEUTRAL, lift: i % 6 === 0 ? -1 : 0 }, 0, 1 / 60);
    expect(s.mode).toBe('grounded');
  });

  /* THE FLARE ITSELF: a visitor who does the obvious thing on final
     approach — hold Shift and wait — must land, not crash. Without the
     flare this hits the ground at -9.2 u/s (measured); with it, -2.5 to
     -2.6. Also proves the flare doesn't overcorrect into a permanent
     hover the way an earlier, wider-radius attempt did (verified by
     probe, not kept: at 4+ spans with no velocity gate this never
     reached the ground in 15s). */
  it('a held descend key lands instead of crashing near the ground', () => {
    const s = newState(0, 10, 0);
    s.mode = 'flying';
    for (let i = 0; i < 60 * 15 && s.mode === 'flying'; i++) step(s, a, { ...NEUTRAL, lift: -1 }, 0, 1 / 60);
    expect(s.mode).toBe('grounded');
  });

  /* GROUND EFFECT. Every test above this point starts at y >= 40, far
     outside any airframe's span, so ge is exactly 1.0 throughout and both
     ge lines in stepQuad/stepWing could be deleted without failing a
     single one of them — this is the only test in the file that actually
     exercises it. Below one span, ge adds up to 12% extra lift for the
     same demand, so a hover started well inside that band climbs rather
     than merely holding: with no climb commanded and no ground effect the
     craft would sit within 0.5 of its start (as the y >= 40 hover-hold
     test already proves), so any sustained climb here is ge and nothing
     else. */
  it('gets extra lift from being close to the ground', () => {
    const s = newState(0, 1, 0);
    s.mode = 'flying';
    for (let i = 0; i < 60 * 2; i++) step(s, a, NEUTRAL, 0, 1 / 60);
    expect(s.y).toBeGreaterThan(1.5);
  });
});
