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
