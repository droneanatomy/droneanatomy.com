/* ============================================================
   meshLinks — the dashed net between the airframes in the fleet beat.

   "One controller, every airframe" is a claim about a NETWORK, and until
   now the scene only showed four aircraft flying near each other, which
   is a formation rather than a fleet. These are the links: every craft to
   every other, dashes travelling along them.

   A FULL MESH, NOT A STAR. A star from the lead aircraft would say the
   others answer to it, and they do not — the controller is on the ground
   and every airframe is a peer on the same radio. Four nodes fully
   connected is six edges, which is still legible at this scale; it stops
   being so at five or six nodes, and if the fleet ever grows this should
   become a hub-and-spoke off an implied ground station instead.

   THE DASHES MARCH, and that is the whole reason this is not a static
   overlay. A still dashed line reads as a diagram annotation drawn on
   top of the picture; the same line with its pattern travelling reads as
   traffic, which is the actual claim. It costs one float per vertex per
   frame.

   Hairlines, unavoidably. WebGL ignores linewidth on virtually every
   platform, so these are one pixel whatever is asked for. That suits
   them — a heavier link would compete with the airframes, and the
   airframes are the subject.
   ============================================================ */

import * as THREE from 'three';

/* Every pair among four craft: lead first, then the three fleet members
   in the order the caller hands them over. */
const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3],
  [1, 2], [1, 3], [2, 3],
];

const NODES = 4;

/* World units. The formation holds the craft roughly twenty units apart,
   so this gives six or seven dashes to a link — enough to read as a
   dashed line rather than as a dotted one, few enough that they do not
   blur together at distance. */
const DASH = 1.2;
const GAP = 1.7;

/* World units a second the pattern travels. Slow: this is a link holding
   station, not a progress bar. */
const MARCH = 3.4;

export interface MeshLinks {
  line: THREE.LineSegments;
  /* `nodes` must be NODES long, lead craft first. `on` is the fleet
     beat's own weight, 0..1. */
  update: (nodes: THREE.Vector3[], on: number, t: number) => void;
  dispose: () => void;
}

export function buildMeshLinks(): MeshLinks {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(EDGES.length * 2 * 3);
  /* Named exactly `lineDistance` because that is the attribute three's
     dashed shader reads. Written by hand rather than through
     computeLineDistances(), which recomputes from zero every call and so
     cannot carry the marching offset. */
  const dist = new Float32Array(EDGES.length * 2);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('lineDistance', new THREE.BufferAttribute(dist, 1));

  const mat = new THREE.LineDashedMaterial({
    /* Blue — AND IT IS OFF-PALETTE ON PURPOSE.

       The page is locked to yellow, grey, white, black and orange, and
       that lock was deliberate enough that sixteen blue values were swept
       out of it in one pass. This is the one blue left standing, asked
       for by name. Recording that here so nobody sweeps it out again
       thinking it was missed.

       It does earn its place on contrast. The fleet beat's sky is
       #c1c6b9, a green grey, and blue is close to its complement — this
       still measures about 2.6:1 on it (the sky was re-tinted at matched
       luminance, so the ratio survived), against 1.8:1 for the white it replaced
       and under 2:1 for flare yellow. A deeper blue would score higher
       still, but stops reading as a live link and starts reading as ink
       that happens to be blue.

       Either way, what carries these is where they are rather than what
       colour they are: every link terminates on an airframe, and the
       airframes are the darkest objects in frame, so the ends read
       strongly even where a middle section crosses pale mountain. */
    color: new THREE.Color('#2f6bff'),
    dashSize: DASH,
    gapSize: GAP,
    transparent: true,
    opacity: 0,
    /* Off, so the links blend through each other where they cross rather
       than the nearest one punching a hole in the others. */
    depthWrite: false,
  });

  const line = new THREE.LineSegments(geo, mat);
  /* The craft move every frame and the bounding sphere is never
     recomputed, so three would cull this against a stale one and the net
     would blink out as the formation drifts. */
  line.frustumCulled = false;
  line.visible = false;
  line.renderOrder = 2;

  return {
    line,
    update: (nodes, on, t) => {
      line.visible = on > 0.02;
      if (!line.visible || nodes.length < NODES) return;
      mat.opacity = on * 0.85;

      /* One phase for the whole net, so the dashes on every link stay in
         step. Negative, so the pattern travels from the first node of
         each edge toward the second rather than backwards into it. */
      const phase = -t * MARCH;

      for (let e = 0; e < EDGES.length; e++) {
        const [ai, bi] = EDGES[e];
        const a = nodes[ai], b = nodes[bi];
        const o = e * 6;
        pos[o] = a.x; pos[o + 1] = a.y; pos[o + 2] = a.z;
        pos[o + 3] = b.x; pos[o + 4] = b.y; pos[o + 5] = b.z;
        const d = e * 2;
        dist[d] = phase;
        dist[d + 1] = phase + a.distanceTo(b);
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.lineDistance.needsUpdate = true;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
