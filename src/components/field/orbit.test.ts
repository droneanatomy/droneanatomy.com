import { describe, expect, it } from 'vitest';
import {
  clampPolar,
  elastic,
  facing,
  ndcToPanel,
  poseToPosition,
  shortestAngle,
  springStep,
  POLAR_MAX,
  POLAR_MIN,
} from './orbit';

describe('ndcToPanel', () => {
  /* These come out as PIXELS, not percentages, and that is the whole point
     of the function existing. A CSS percentage inside `transform` resolves
     against the element's own border box, so translating a 20px dot by
     "45%" moves it 9px rather than 45% of the panel — which clustered all
     four hotspots in the top-left corner and left them barely moving as
     the aircraft turned. */
  it('puts NDC origin at the centre of the panel', () => {
    expect(ndcToPanel(0, 0, 500, 300)).toEqual([250, 150]);
  });

  it('puts NDC top-left at the panel origin', () => {
    expect(ndcToPanel(-1, 1, 500, 300)).toEqual([0, 0]);
  });

  it('puts NDC bottom-right at the far corner', () => {
    expect(ndcToPanel(1, -1, 500, 300)).toEqual([500, 300]);
  });

  it('flips Y, because NDC counts up and the screen counts down', () => {
    const [, y] = ndcToPanel(0, 0.5, 500, 300);
    expect(y).toBeLessThan(150);
  });
});

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

  it('barely overshoots, so a return never reads as a bounce', () => {
    let cur = 0;
    let vel = 0;
    let max = -Infinity;
    for (let i = 0; i < 400; i++) {
      [cur, vel] = springStep(cur, vel, 1, omega, 1 / 60);
      max = Math.max(max, cur);
    }
    expect(max).toBeLessThan(1.001);
  });

  /* REGRESSION. The explicit damping this replaced multiplied velocity by
     (1 - 2*omega*dt) every step. At the reduced-motion period of 0.15s that
     is -1.79 at MAX_DT, and the camera diverged to 1e305 within a second —
     reachable only by a reader who had asked for reduced motion and then
     dropped a frame. */
  it('stays finite at the reduced-motion period and MAX_DT', () => {
    const fastOmega = (2 * Math.PI) / 0.15;
    let cur = 0;
    let vel = 0;
    for (let i = 0; i < 600; i++) [cur, vel] = springStep(cur, vel, 1, fastOmega, 1 / 30);
    expect(Number.isFinite(cur)).toBe(true);
    expect(cur).toBeCloseTo(1, 4);
  });

  /* The implicit form stabilises the DAMPING term unconditionally; the
     stiffness term still has a limit. Measured, that limit at MAX_DT is
     omega = 144.7, i.e. a period no shorter than 0.043s. The two periods
     this ships with are 0.55s (omega 11.4, 12.7x margin) and the
     reduced-motion 0.15s (omega 41.9, 3.5x margin), so retuning by feel has
     a lot of room — but not infinite room, and this records where the edge
     actually is rather than pretending there is none. */
  it('stays stable for periods far shorter than either shipping value', () => {
    const omega50ms = (2 * Math.PI) / 0.05;
    expect(omega50ms).toBeLessThan(144.7);
    let cur = 0;
    let vel = 0;
    for (let i = 0; i < 600; i++) [cur, vel] = springStep(cur, vel, 1, omega50ms, 1 / 30);
    expect(Number.isFinite(cur)).toBe(true);
    expect(cur).toBeCloseTo(1, 3);
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
