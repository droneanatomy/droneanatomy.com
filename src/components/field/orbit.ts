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

/* Normalised device coordinates to pixels within the panel.

   PIXELS, AND THAT IS THE POINT. The obvious way to place a projected dot
   is a percentage translate, and it silently does the wrong thing: a CSS
   percentage inside `transform` resolves against the ELEMENT'S OWN border
   box, not its offset parent. Translating a 20px dot by "45%" moves it 9px.
   All four hotspots ended up clustered in the top-left corner, moving by
   fractions of a pixel as the aircraft turned.

   `left`/`top` percentages would resolve correctly, but they are layout
   properties and writing them every frame costs a reflow per dot. A pixel
   transform composites instead. */
export function ndcToPanel(
  ndcX: number,
  ndcY: number,
  width: number,
  height: number
): [number, number] {
  /* Y is flipped because NDC counts up from the bottom and the screen
     counts down from the top. */
  return [(ndcX * 0.5 + 0.5) * width, (-ndcY * 0.5 + 0.5) * height];
}

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
