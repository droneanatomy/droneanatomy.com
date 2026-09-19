/* ============================================================
   massif — one mountain, generated, shaded as a survey plate.

   Deliberately NOT the flight's terrain. That one is an endless field
   the craft streams over, tuned so no single feature dominates. This is
   the opposite: ONE landform with a summit, sitting in black, that has
   to hold the frame from a low profile view and still read as a map when
   the camera arrives overhead.

   Zero bytes, like the reference. Their whole page loads no 3D assets at
   all — the mountain is noise, and the survey look comes from how it is
   shaded rather than from any texture.

   THE SHADING IS THE TRICK. A height ramp alone gives a grey lump. What
   makes it read as a survey is contour lines derived from the height in
   the fragment shader, faded in as the camera comes overhead — from the
   side they would be noise, from above they are the whole point.
   ============================================================ */

import * as THREE from 'three';

export const MASSIF_SIZE = 900;
export const PEAK_H = 260;

const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

const noise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (
    hash(ix, iy) * (1 - ux) * (1 - uy) +
    hash(ix + 1, iy) * ux * (1 - uy) +
    hash(ix, iy + 1) * (1 - ux) * uy +
    hash(ix + 1, iy + 1) * ux * uy
  );
};

/* Ridged, same fold as the flight's terrain: |2n-1| creases where the
   noise crosses its midpoint, and creases are what the eye reads as rock. */
const ridged = (x: number, y: number, oct = 6) => {
  let sum = 0, amp = 0.5, freq = 1, prev = 1;
  for (let i = 0; i < oct; i++) {
    let n = noise(x * freq, y * freq);
    n = 1 - Math.abs(n * 2 - 1);
    n *= n;
    sum += n * amp * prev;
    prev = n;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
};

const fbm = (x: number, y: number, oct = 4) => {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise(x * f, y * f); f *= 2.02; a *= 0.5; }
  return v;
};

const smooth = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/* Height at a point.

   A RADIAL FALLOFF is what turns a noise field into a mountain. Without
   it the relief runs to every edge and the top-down view is a rectangle
   of texture rather than a landform with a shape — and shape is the only
   thing that survives being seen from directly above. */
export function heightAt(x: number, z: number) {
  const u = x * 0.0034, v = z * 0.0034;

  const r = Math.min(1, Math.hypot(x, z) / (MASSIF_SIZE * 0.46));
  /* Off-centre so the summit is not dead middle — a centred peak reads
     as a cone from above, which is a diagram, not a survey. */
  const r2 = Math.min(1, Math.hypot(x + 60, z - 40) / (MASSIF_SIZE * 0.40));
  const dome = Math.max(1 - smooth(r), 0.86 * (1 - smooth(r2)));

  const ridges = Math.pow(Math.min(1, ridged(u, v, 6) / 0.6), 0.8);
  const detail = fbm(u * 6, v * 6, 3) * 0.16;

  /* A SUMMIT TERM, not just noise times a falloff.

     Noise-times-dome was the first version and it produced a caldera:
     the dome peaks in the middle but the ridged field happened to sit
     low there, so the plan view came out bright around a dark centre —
     a crater, not a mountain. Multiplying two fields cannot guarantee a
     high point anywhere; adding one does. The ridges still carry all the
     character, this only guarantees the character has a top. */
  const crown = Math.pow(1 - smooth(r), 1.6) * 0.42;

  return (ridges * 0.62 + detail + crown) * dome * PEAK_H;
}

export function buildMassif(): THREE.Mesh {
  /* 380 segments. The silhouette against black is the whole read at the
     profile end, and an under-sampled ridge reads as a smooth lump
     exactly where it should look sharp. */
  const geo = new THREE.PlaneGeometry(MASSIF_SIZE, MASSIF_SIZE, 380, 380);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  /* Track the height actually REACHED, rather than trusting PEAK_H.

     PEAK_H is the ceiling of the formula, not its outcome: ridges, detail
     and crown never all peak at the same point, and the dome multiplies
     most of it away. The real maximum came out around half the nominal,
     so normalising the plate tone by PEAK_H mapped the whole massif into
     the bottom half of the ramp and the plan view rendered near-black. */
  let peak = 1;
  for (let i = 0; i < pos.count; i++) {
    const h = heightAt(pos.getX(i), -pos.getY(i));
    pos.setZ(i, h);
    if (h > peak) peak = h;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPeak: { value: peak },
      /* 0 = lit from the side as a landform, 1 = flat survey plate.
         Driven by the camera's own arc, so the mountain becomes a map at
         exactly the moment you are looking straight down at it. */
      uPlan: { value: 0 },
      /* Contours fade in with the plan view. Seen from the side they are
         just noise across the face. */
      uContour: { value: 0 },
      uLight: { value: new THREE.Vector3(-0.5, 0.72, 0.48).normalize() },
      /* Built from RAW components, not from the hex.

         new THREE.Color('#0a0908') converts to the linear working space,
         and a ShaderMaterial never gets three's colorspace_fragment
         chunk — so that linear value would be written to the framebuffer
         untouched and display near 0, while scene.background (which IS
         colour-managed) displays as rgb(7,9,11). The plate's void came
         out about eight levels darker than the page's, which drew the
         mesh's rectangle back across the black after the edge fade had
         just removed it. Float components are stored as given, so these
         land on screen as exactly the ground colour. */
      uFogColor: { value: new THREE.Color(10 / 255, 9 / 255, 8 / 255) },
      /* Set per frame from the camera's own distance. Fixed world
         distances were the second half of the near-black plan view: the
         camera pulls back to 1575 units to frame the whole plate, and a
         fog ending at 1600 then swallowed the entire massif in ground
         colour. Fog is for atmosphere in the profile shot; it has to get
         out of the way as the camera climbs. */
      uFogNear: { value: 300 },
      uFogFar: { value: 1600 },
      /* Where the plate dissolves into the void.

         The mesh is a SQUARE and the mountain is round, so there is a
         flat apron between the two. Lit by the same lambert term it came
         out mid-grey, which drew the plane's own rectangular edge across
         the black — a mountain sitting on a visible tray. The dome dies
         at 0.46 * size, so fading just outside that costs no landform
         and leaves the massif floating. */
      uEdge0: { value: MASSIF_SIZE * 0.467 },
      uEdge1: { value: MASSIF_SIZE * 0.499 },
    },
    vertexShader: `
      varying float vH;
      varying vec3 vN;
      varying float vDepth;
      varying float vR;
      void main(){
        vH = position.z;                 /* plane is XY before rotation */
        vR = length(position.xy);        /* ...so radius is in XY too */
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vH;
      varying vec3 vN;
      varying float vDepth;
      varying float vR;
      uniform float uPeak, uPlan, uContour, uFogNear, uFogFar, uEdge0, uEdge1;
      uniform vec3 uLight, uFogColor;

      void main(){
        float h = clamp(vH / uPeak, 0.0, 1.0);

        /* Two readings of the same surface, crossfaded by uPlan.

           LANDFORM: lit by a low sun, so the relief is carried by the
           normal. Reads as a mountain from the side and as a grey smear
           from above, because from above every normal points at you.

           PLATE: lit by HEIGHT alone, ignoring the normal entirely. Reads
           as nonsense from the side and as a survey from above. Neither
           works at both ends, which is why it crossfades rather than
           picking one. */
        float lambert = max(dot(normalize(vN), uLight), 0.0);
        float landform = 0.05 + pow(lambert, 0.9) * 0.84;
        float plate = pow(h, 0.78);

        float tone = mix(landform, plate, uPlan);

        /* Contour lines, from the height. A triangle wave puts a thin
           band at every level crossing; widening the band with the
           fragment's own derivative keeps the lines one pixel wide at any
           distance instead of aliasing into moire on the far slopes. */
        float bands = h * 26.0;
        float tri = abs(fract(bands) - 0.5) * 2.0;
        float w = fwidth(bands) * 1.6;
        float line = 1.0 - smoothstep(0.0, clamp(w, 0.02, 0.6), tri);
        tone = mix(tone, tone + line * 0.5, uContour);

        vec3 col = vec3(tone);

        /* Dissolve the apron, so the square mesh has no visible border. */
        col = mix(col, uFogColor, smoothstep(uEdge0, uEdge1, vR));

        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        col = mix(col, uFogColor, fog);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
