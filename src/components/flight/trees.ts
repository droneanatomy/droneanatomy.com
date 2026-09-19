/* ============================================================
   trees — the conifers that make the land read as land.

   The reference this is chasing is a game-engine flyover: forested
   alpine terrain with a swarm over it. Comparing it against what we had,
   almost the whole difference is VEGETATION rather than landform. Our
   relief was already the right shape; it just looked like a relief map
   rather than a place, because nothing was growing on it. Trees are the
   thing that gives a hillside scale, texture and a horizon line.

   GENERATED, NOT DOWNLOADED. A conifer at this distance is a cone on a
   stick — the camera never gets closer than a couple of hundred units and
   the whole forest is under heavy aerial haze. Buying that silhouette
   with a megabyte of GLB and its textures would be paying for detail the
   frame cannot resolve. This costs zero bytes of transfer and builds in
   about a millisecond.

   ONE DRAW CALL FOR THE WHOLE FOREST. InstancedMesh, so thirty-six
   thousand trees cost thirty-six thousand matrices and a single call
   rather than thirty-six thousand of anything else. The tiers are merged
   into one geometry carrying vertex colours, which keeps it to one call
   instead of two — the same reason the terrain is vertex-coloured.

   MEASURED: 36,194 trees, 723,880 triangles against the terrain's own
   312,000, built in 89ms, downloaded in 0 bytes.

   PLACEMENT IS THE INTERESTING PART, and it is not random. See the note
   on STAND below.
   ============================================================ */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundAt, LOOP, PEAK, TERRAIN_SIZE } from './terrain';

/* World units, AND SIZED BY EYE RATHER THAN BY ARITHMETIC.

   The first pass reasoned from physical scale — 1600 units across reads as
   about two kilometres, so a 25-metre conifer is roughly twenty units — and
   it came out badly wrong on screen. This world is not to scale: the
   aircraft is loaded at span 11, which against a real 1-metre quadcopter
   would make a unit about nine centimetres and a real conifer taller than
   the mountains. The drone is deliberately oversized so it reads at
   altitude, and everything else has to be judged against what it looks
   like, not against metres.

   At 17-27 the canopies were wider than the gaps between them and the
   hillside read as scattered shrubs. This is roughly the drone's own span,
   which is the size that reads as forest from these camera distances. */
/* SHRUNK AGAIN, AND FOR A REASON THAT INVALIDATES SOME OF THE ABOVE.

   Frames from the reference were finally looked at rather than reasoned
   about, and at their altitude and lens THERE ARE NO INDIVIDUAL TREES AT
   ALL. Forest is carried entirely by the ground texture — mottled scrub
   and moss with drainage lines through it — and not one discrete tree
   object is resolvable anywhere in the frame.

   That makes a canopy of separable cones the wrong technique for this
   look, not merely a coarse one: distinct tree silhouettes are precisely
   what reads as a game rather than as footage. These are kept, small and
   dark, to break the surface up and give the ground something to cast
   shadows from — they are contributing TEXTURE now, not population. If
   the texture route is taken properly they should go entirely. */
const H = { min: 4, max: 8 };

/* Trunk and needles, both muted. A saturated foliage green here fights
   the ground it is standing on — the terrain's own greens were chosen for
   luminance so the ink copy survives over them, and a forest two stops
   darker would undo that in the places it clumps. These sit just below
   the terrain's GRASS. */
/* Graded to the reference: a terrain-only sample of their frames means
   RGB(79, 83, 74) at a saturation of 11/255. Foliage that sits brighter or
   more saturated than the ground it stands on pops out as objects, which
   is the opposite of what is wanted. */
const NEEDLE = new THREE.Color('#2c3626');
const NEEDLE_HI = new THREE.Color('#3d4a33');
/* The second species. Broadleaf sits warmer and lighter than conifer, and
   that difference is most of what makes a mixed wood read as a wood
   rather than as one asset repeated. */
const LEAF = new THREE.Color('#37402a');
const LEAF_HI = new THREE.Color('#4a553a');
const BARK = new THREE.Color('#3a3129');

/* ---- one conifer ------------------------------------------------------
   Two stacked cones, merged, and no trunk — twenty triangles for the whole
   tree. The notes inside say why each of those is the right call at this
   distance. */
function conifer(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  /* NO TRUNK, and no apology for it. The camera in every one of these
     beats is above the canopy looking down; the trunk is occluded by the
     tree's own skirt in literally every frame. It was a third of the
     triangle count for something that cannot be seen, which matters when
     there are twenty-five thousand of them. BARK is kept for the day
     something flies low enough to need it. */
  void BARK;

  /* Two tiers, five-sided. At this size a tree is a handful of pixels
     under heavy haze, so radial segments past five are subdivision nobody
     can resolve — and five-sided cones halve the forest's triangle
     budget against seven. */
  const tiers: [number, number, number][] = [
    // radius, height, base y
    [1.0, 0.62, 0.05],
    [0.66, 0.50, 0.45],
  ];
  for (const [r, h, y] of tiers) {
    const c = new THREE.ConeGeometry(r, h, 5);
    c.translate(0, y + h / 2, 0);
    /* Lighter at the crown, darker in the skirt, so the tree has some
       modelling of its own under a light that barely moves. */
    paint(c, NEEDLE, NEEDLE_HI);
    parts.push(c);
  }

  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('trees: merge failed');
  /* Built at unit height so the instance matrix can scale it directly. */
  geo.computeVertexNormals();
  return geo;
}

/* ---- one broadleaf ----------------------------------------------------
   Two offset spheres, heavily flattened, at six segments. Rounder and
   wider than the conifer, which is the whole point: a hillside of
   identical triangles is the most obvious computer-generated forest there
   is, and the eye picks up the repetition long before it picks up any
   individual tree. Twenty-eight triangles. */
function broadleaf(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  /* AN ICOSAHEDRON, NOT A SPHERE, and the difference is the whole budget.

     A UV sphere at six by four segments came out at 72 triangles a tree,
     and with ten thousand of them — rendered twice, once for the camera
     and once into the shadow map — that single choice was costing more
     than the entire conifer population. An icosahedron at detail 0 is 20
     triangles and, squashed and rotated, reads as exactly the same
     rounded canopy at a size where the canopy is thirty pixels across. */
  const b = new THREE.IcosahedronGeometry(0.62, 0);
  b.scale(1.05, 0.86, 1.05);
  b.translate(0, 0.58, 0);
  paint(b, LEAF, LEAF_HI);
  parts.push(b);
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('trees: broadleaf merge failed');
  geo.computeVertexNormals();
  return geo;
}

/* Vertex colours by height within the part, low to high. */
function paint(g: THREE.BufferGeometry, low: THREE.Color, high: THREE.Color) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  const span = hi - lo || 1;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(low).lerp(high, (pos.getY(i) - lo) / span);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/* ---- where they grow --------------------------------------------------

   NOT SCATTERED AT RANDOM, and the rule is one the terrain already knows.

   paint() in terrain.ts colours the ground from two numbers: an elevation
   band t, and the slope of the surface normal. Those are exactly the two
   things that decide whether a conifer can stand somewhere — there is no
   forest on a valley floor that floods, none above the treeline, and none
   on a face too steep to hold soil. So this reads the SAME two numbers
   and plants where the terrain has already decided it is grass.

   That is what stops the forest looking sprinkled on. The treeline
   follows the same contour the colour band does, because it is the same
   contour, and the bare rock the terrain paints is bare in the geometry
   too. Change the bands in terrain.ts and the forest moves with them.

   Rejection sampling on a jittered grid rather than pure random: an even
   grid reads as an orchard and pure random clumps into holes. Jitter is
   the cheap middle. */
const BAND = { low: 0.20, high: 0.83 }; // t: valley floor .. treeline
const FADE = 0.12;                       // soften both edges of the band
const NZ_MIN = 0.58;                     // steeper than this sheds its soil

/* STANDS, NOT A UNIFORM GRID, and this is the change that made it read as
   forest rather than as sprinkles.

   Scattering every tree independently over the whole map has two problems
   at once. Visually, an even wash has no clearings and no edges, and a
   forest is mostly edges. Computationally, every candidate costs a
   groundAt for its height and four more for its slope — and groundAt is a
   six-octave ridged noise plus two fbms. Getting a dense canopy that way
   means hundreds of thousands of those calls and most of a second on the
   main thread.

   Clustering fixes both. The expensive test — is this ground forest at
   all — runs once per STAND. Each stand that passes then drops a dozen
   trees around itself, and those only need their own height. Thirty-six
   thousand trees cost 89ms that way — less per tree than the two thousand
   the uniform version placed — and they arrive in clumps with gaps
   between, which is what a treeline looks like. */
const STAND = { radius: [18, 42] as const, min: 10, max: 24 };

/* Finite-difference normal. The terrain's own normals live on a mesh we
   are not holding, and groundAt is cheap enough to sample four times. */
function slopeAt(x: number, z: number) {
  const e = 6;
  const dx = groundAt(x + e, z) - groundAt(x - e, z);
  const dz = groundAt(x, z + e) - groundAt(x, z - e);
  /* nz of the surface normal: 1 is flat, 0 is a wall. */
  return (2 * e) / Math.sqrt(dx * dx + dz * dz + 4 * e * e);
}

export interface Forest {
  /* TWO MESHES, ONE PER SPECIES, and therefore two draw calls rather than
     one. That is the price of the variation, and it is the right trade:
     a second draw call is nothing next to the repetition being visible in
     every frame. Both are added to the scene and both take the terrain's
     scroll. */
  meshes: THREE.InstancedMesh[];
  count: number;
  dispose: () => void;
}

/* `density` is trees per grid cell attempt — the count that comes out is
   whatever survives the rules, which is roughly a third of the attempts
   on this landform. */
export function buildTrees(stands = 5200): Forest {
  const mkMat = () =>
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
      /* Two-sided because the canopies are thin and a tree seen from
         slightly below should not vanish. */
      side: THREE.DoubleSide,
    });
  const species = [
    { geo: conifer(), mat: mkMat(), share: 0.72 },
    { geo: broadleaf(), mat: mkMat(), share: 1.0 },
  ];

  /* Allocated for the worst case and trimmed after, since the survivor
     count is not known until the rules have run. */
  const cap = stands * STAND.max;
  const meshes = species.map((sp) => {
    const im = new THREE.InstancedMesh(sp.geo, sp.mat, cap);
    im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    /* Both directions. A forest that casts but does not receive is lit
       flat inside its own canopy, which is where a wood is darkest. */
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    return im;
  });
  const counts = [0, 0];

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const tiltAxis = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();

  /* Deterministic, so the forest is the same every load and every
     reviewer is looking at the same picture. */
  let seed = 20260901;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  /* The stand grid spans the terrain plane exactly: 1600 across, and TWO
     loops deep, because the terrain carries two so the far edge never
     slides into view. groundAt is periodic in LOOP, so the second period
     lands on identical ground and the forest wraps with it. */
  const cols = Math.round(Math.sqrt(stands * (TERRAIN_SIZE / (LOOP * 2))));
  const rows = Math.round(stands / cols);
  const cw = TERRAIN_SIZE / cols;
  const ch = (LOOP * 2) / rows;
  const Y_AXIS = new THREE.Vector3(0, 1, 0);

  let n = 0;
  for (let r = 0; r < rows && n < cap; r++) {
    for (let c = 0; c < cols && n < cap; c++) {
      const sx = -TERRAIN_SIZE / 2 + (c + rnd()) * cw;
      const sz = -LOOP + (r + rnd()) * ch;

      /* ---- is this stand forest at all? The expensive test, once. ---- */
      const sh = groundAt(sx, sz);
      const st = (sh + 30) / PEAK;

      /* Inside the band, with soft edges — a hard cutoff draws a contour
         line across the hillside, which is exactly the artefact the
         terrain's own colour bands were smoothed to avoid. */
      let p = Math.min(
        Math.min(1, (st - BAND.low) / FADE),
        Math.min(1, (BAND.high - st) / FADE)
      );
      if (p <= 0) continue;

      const nz = slopeAt(sx, sz);
      if (nz < NZ_MIN) continue;
      /* Thins out as the ground steepens rather than stopping dead. */
      p *= Math.min(1, (nz - NZ_MIN) / 0.2);
      if (rnd() > p) continue;

      /* ---- drop the stand's trees around it ------------------------- */
      /* RADIUS VARIES PER STAND, and it has to. At one fixed radius every
         clump is the same disc and the hillside reads as polka dots —
         which is exactly how the first clustered pass looked. Mixed sizes
         let neighbouring stands overlap into continuous canopy in places
         and leave clearings in others, which is the texture wanted. */
      const radius = STAND.radius[0] + rnd() * (STAND.radius[1] - STAND.radius[0]);
      const members = STAND.min + Math.round(rnd() * (STAND.max - STAND.min) * p);
      for (let k = 0; k < members && n < cap; k++) {
        /* sqrt on the radius keeps the disc evenly covered instead of
           piling every member into the middle. */
        const a = rnd() * Math.PI * 2;
        const rad = Math.sqrt(rnd()) * radius;
        const x = sx + Math.cos(a) * rad;
        let z = sz + Math.sin(a) * rad;

        if (x < -TERRAIN_SIZE / 2 || x > TERRAIN_SIZE / 2) continue;
        /* Wrapped rather than dropped, so stands straddling the seam do
           not thin out along it. groundAt is periodic, so the wrapped
           position is the same ground. */
        if (z < -LOOP) z += LOOP * 2;
        else if (z > LOOP) z -= LOOP * 2;

        const h = groundAt(x, z);
        const t = (h + 30) / PEAK;
        /* A member can land outside the band its stand sat in — over a
           ridge, or down into the valley. Cheap to check, and it is what
           keeps the treeline crisp at the stand scale. */
        if (t < BAND.low || t > BAND.high) continue;

        /* Species is chosen per TREE, not per stand — a mixed wood is
           mixed at the scale of individuals. Conifer dominates, which is
           what puts the stand on a mountainside rather than in a park. */
        const sp = rnd() < species[0].share ? 0 : 1;
        const im = meshes[sp];
        const idx = counts[sp];

        const s = H.min + rnd() * (H.max - H.min) * (sp === 1 ? 0.82 : 1);
        /* NON-UNIFORM SCALE, slightly. Every tree being a scaled copy of
           one silhouette is the repetition the eye catches first; letting
           width and height vary independently breaks it for free. */
        scl.set(s * (0.84 + rnd() * 0.34), s * (0.88 + rnd() * 0.3), s * (0.84 + rnd() * 0.34));
        pos.set(x, h - 0.3 * s, z); // sunk so the skirt meets the ground

        /* A few degrees of lean, in a random direction. Nothing on a
           hillside grows perfectly plumb, and a forest of parallel axes
           reads as a hairbrush. */
        tiltAxis.set(rnd() * 2 - 1, 0, rnd() * 2 - 1).normalize();
        q.setFromAxisAngle(tiltAxis, (rnd() - 0.5) * 0.16);
        spin.setFromAxisAngle(Y_AXIS, rnd() * Math.PI * 2);
        q.multiply(spin);

        m.compose(pos, q, scl);
        im.setMatrixAt(idx, m);

        /* Per-instance tint. A forest of one colour reads as a texture; a
           little variation reads as trees. */
        const v = 0.78 + rnd() * 0.42;
        tint.setRGB(v, v * (0.94 + rnd() * 0.12), v * 0.9);
        im.setColorAt(idx, tint);
        counts[sp]++;
        n++;
      }
    }
  }

  meshes.forEach((im, i) => {
    im.count = counts[i];
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return {
    meshes,
    count: n,
    dispose: () => {
      species.forEach((sp) => {
        sp.geo.dispose();
        sp.mat.dispose();
      });
      meshes.forEach((im) => im.dispose());
    },
  };
}
