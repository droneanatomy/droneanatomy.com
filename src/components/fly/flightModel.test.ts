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

  /* THE SIGN TEST. Stated without reference to any key or to the sign of
     yaw, so it cannot be satisfied by flipping a convention: bank one way
     and the aircraft must end up travelling that way. Starting from yaw 0
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

  /* The mirror image of Task 2's "never below weight": the two lift
     sources must not BOTH carry the weight while the blend has them both
     switched on, or the aircraft balloons on its way through the window
     with the stick centred. */
  it('does not balloon through the transition', () => {
    const s = newState(0, 300, 0);
    s.mode = 'flying';
    let highest = s.y;
    for (let i = 0; i < 60 * 12; i++) {
      step(s, a, { ...NEUTRAL, throttle: 1 }, 0, 1 / 60);
      if (s.y > highest) highest = s.y;
    }
    expect(speedOf(s)).toBeGreaterThan(a.vTransEnd); // it did go through
    expect(highest - 300).toBeLessThan(8);
  });
});
