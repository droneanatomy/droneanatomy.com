import { describe, expect, it } from 'vitest';
import { ElasticRig } from './ElasticRig';
import { poseToPosition, type Pose, type Vec3 } from './orbit';

/* ElasticRig imports three.js for TYPES ONLY, so it can be driven by a
   duck-typed camera and a stub element. That is what makes the flight
   testable at all: the browser this was first verified in throttles
   requestAnimationFrame to 1Hz when it is not painting, and a spring that
   needs 0.9s of simulated time then takes half a minute of wall clock. Here
   the clock is a loop counter. */
function harness(
  home: Pose = { azimuth: 0, polar: Math.PI / 2, radius: 1 },
  { reduced = true, fit = 4 } = {}
) {
  const position = {
    x: 0,
    y: 0,
    z: 0,
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  };
  const looked = { x: 0, y: 0, z: 0 };
  const camera = {
    position,
    lookAt(x: number, y: number, z: number) {
      looked.x = x;
      looked.y = y;
      looked.z = z;
    },
  };
  const dom = {
    clientHeight: 400,
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    hasPointerCapture() {
      return false;
    },
    releasePointerCapture() {},
  };

  const rig = new ElasticRig({
    camera: camera as never,
    dom: dom as never,
    home,
    reduced,
  });
  rig.setFit(fit);

  /* Reduced motion is the default here because it zeroes the drift and the
     sway, which makes the resting pose a fixed point the spring can be
     asserted against exactly. The spring itself is unchanged apart from its
     period. */
  const run = (seconds: number, dt = 1 / 60) => {
    for (let i = 0; i < Math.round(seconds / dt); i++) rig.update(dt);
  };

  const distanceFromOrigin = () => Math.hypot(position.x, position.y, position.z);

  return { rig, position, looked, run, distanceFromOrigin, fit };
}

describe('ElasticRig at rest', () => {
  it('settles at the fitted distance from the model centre', () => {
    const h = harness();
    h.run(3);
    expect(h.distanceFromOrigin()).toBeCloseTo(h.fit, 4);
  });

  it('places the camera where the home pose says', () => {
    const home = { azimuth: 0.695, polar: 1.391, radius: 1 };
    const h = harness(home);
    h.run(3);
    const [x, y, z] = poseToPosition([0, 0, 0], { ...home, radius: home.radius * h.fit });
    expect(h.position.x).toBeCloseTo(x, 3);
    expect(h.position.y).toBeCloseTo(y, 3);
    expect(h.position.z).toBeCloseTo(z, 3);
  });

  it('looks at the model centre when nothing is selected', () => {
    const h = harness();
    h.run(3);
    expect([h.looked.x, h.looked.y, h.looked.z]).toEqual([0, 0, 0]);
  });

  it('scales with the fit, so a resize reframes without re-authoring', () => {
    const h = harness();
    h.run(3);
    h.rig.setFit(8);
    h.run(1);
    expect(h.distanceFromOrigin()).toBeCloseTo(8, 4);
  });
});

describe('ElasticRig selection', () => {
  const anchor: Vec3 = [-0.025, -0.139, -1.19];
  const pose: Pose = { azimuth: 2.85, polar: 1.45, radius: 0.42 };

  it('flies the camera to the authored framing', () => {
    const h = harness();
    h.rig.select(pose, anchor);
    h.run(4);
    const [x, y, z] = poseToPosition(anchor, { ...pose, radius: pose.radius * h.fit });
    expect(h.position.x).toBeCloseTo(x, 3);
    expect(h.position.y).toBeCloseTo(y, 3);
    expect(h.position.z).toBeCloseTo(z, 3);
  });

  it('moves the pivot onto the hotspot, so the part stays put as it turns', () => {
    const h = harness();
    h.rig.select(pose, anchor);
    h.run(4);
    expect(h.looked.x).toBeCloseTo(anchor[0], 3);
    expect(h.looked.y).toBeCloseTo(anchor[1], 3);
    expect(h.looked.z).toBeCloseTo(anchor[2], 3);
  });

  it('sits closer than home, because the framing radius is a factor of the fit', () => {
    const h = harness();
    h.run(3);
    const homeRadius = h.distanceFromOrigin();
    h.rig.select(pose, anchor);
    h.run(4);
    const anchorDistance = Math.hypot(
      h.position.x - anchor[0],
      h.position.y - anchor[1],
      h.position.z - anchor[2]
    );
    expect(anchorDistance).toBeLessThan(homeRadius);
    expect(anchorDistance).toBeCloseTo(pose.radius * h.fit, 3);
  });

  it('returns home when the selection is released', () => {
    const home = { azimuth: 0.695, polar: 1.391, radius: 1 };
    const h = harness(home);
    h.rig.select(pose, anchor);
    h.run(4);
    h.rig.select(null, null);
    h.run(4);
    expect(h.distanceFromOrigin()).toBeCloseTo(h.fit, 3);
    /* toBeCloseTo rather than toEqual([0,0,0]): the pivot springs back
       through zero and settles at -0, which is a distinct value to toEqual
       and an identical one to everything else. */
    expect(h.looked.x).toBeCloseTo(0, 3);
    expect(h.looked.y).toBeCloseTo(0, 3);
    expect(h.looked.z).toBeCloseTo(0, 3);
  });

  it('survives a selection change mid-flight rather than fighting itself', () => {
    const h = harness();
    h.rig.select(pose, anchor);
    h.run(0.2); // interrupt long before it settles
    const other: Pose = { azimuth: 1.571, polar: 1.571, radius: 0.95 };
    const otherAnchor: Vec3 = [0.326, -0.133, -0.171];
    h.rig.select(other, otherAnchor);
    h.run(4);
    const [x, y, z] = poseToPosition(otherAnchor, { ...other, radius: other.radius * h.fit });
    expect(h.position.x).toBeCloseTo(x, 3);
    expect(h.position.y).toBeCloseTo(y, 3);
    expect(h.position.z).toBeCloseTo(z, 3);
  });
});

describe('ElasticRig settled', () => {
  const anchor: Vec3 = [-0.025, -0.139, -1.19];
  const pose: Pose = { azimuth: 2.85, polar: 1.45, radius: 0.42 };

  it('is false before a single frame has been run', () => {
    const h = harness();
    expect(h.rig.settled()).toBe(false);
  });

  it('is false while the camera is still flying', () => {
    const h = harness();
    h.run(1);
    h.rig.select(pose, anchor);
    h.run(0.05); // barely started
    expect(h.rig.settled()).toBe(false);
  });

  it('becomes true once the flight converges', () => {
    const h = harness();
    h.rig.select(pose, anchor);
    h.run(4);
    expect(h.rig.settled()).toBe(true);
  });

  it('goes false again the moment a new hotspot is chosen', () => {
    const h = harness();
    h.rig.select(pose, anchor);
    h.run(4);
    expect(h.rig.settled()).toBe(true);
    h.rig.select({ azimuth: 1.202, polar: 1.376, radius: 0.44 }, [0.3, 0.381, 0.612]);
    h.run(0.05);
    expect(h.rig.settled()).toBe(false);
  });

  /* The reason settled() measures error rather than velocity. With the sway
     on, a selected pose never stops moving — the rest position is a slow
     sinusoid — so a velocity test would report "still flying" forever. */
  it('stays true under the sway, which never stops moving', () => {
    const h = harness({ azimuth: 0, polar: Math.PI / 2, radius: 1 }, { reduced: false });
    h.rig.select(pose, anchor);
    h.run(5);
    expect(h.rig.settled()).toBe(true);
    h.run(4); // a good way into the 6s and 9s sway periods
    expect(h.rig.settled()).toBe(true);
  });
});

describe('ElasticRig frame pacing', () => {
  it('clamps a backgrounded tab to MAX_DT instead of exploding', () => {
    const h = harness();
    /* A tab that has been away for twelve seconds hands back one enormous
       frame. An unclamped explicit integrator diverges on it. */
    h.rig.update(12);
    h.rig.update(12);
    expect(Number.isFinite(h.position.x)).toBe(true);
    expect(h.distanceFromOrigin()).toBeLessThan(h.fit * 3);
  });

  it('reaches the same pose at 30Hz as at 60Hz', () => {
    const a = harness();
    const b = harness();
    a.rig.select({ azimuth: 1.23, polar: 1.35, radius: 0.44 }, [0.248, 0.14, 0.491]);
    b.rig.select({ azimuth: 1.23, polar: 1.35, radius: 0.44 }, [0.248, 0.14, 0.491]);
    a.run(4, 1 / 60);
    b.run(4, 1 / 30);
    expect(a.position.x).toBeCloseTo(b.position.x, 3);
    expect(a.position.y).toBeCloseTo(b.position.y, 3);
    expect(a.position.z).toBeCloseTo(b.position.z, 3);
  });
});
