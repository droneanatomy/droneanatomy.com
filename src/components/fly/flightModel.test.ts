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
