/* ============================================================
   clouds — drifting grey banks around the massif.

   SLICED, not single sheets. Each band is several planes spread over a
   vertical thickness rather than one plane at one height, and the
   reason is the camera: at the profile end of the arc it sits within
   three degrees of horizontal, so a single sheet is seen edge-on and
   renders as a hard straight LINE ruled across the mountain. Tried it;
   it looked like a scratch on the lens. Stacking thin slices and
   weighting their opacity into a bell means looking along the band
   accumulates a soft-edged haze instead of hitting one surface.

   Still flat planes, not a volume. The parallax between the bands is
   the only thing a raymarched volume would buy here, and it would cost
   a march per pixel on a page already carrying four WebGL contexts.

   THEY HAVE TO FADE OUT, and that is not a stylistic preference. The
   section's camera climbs from just above the ground to 1575 units
   overhead, so it passes THROUGH these heights on the way up. Left at
   full strength they would end up between the lens and the survey plate
   at exactly the moment the plate is the whole point of the shot — the
   contours would be read through fog. They belong to the profile half.
   ============================================================ */

import * as THREE from 'three';
import { MASSIF_SIZE } from './massif';

/* Display-space, like every other ShaderMaterial colour in this project:
   a ShaderMaterial never receives three's colorspace_fragment chunk, so
   whatever is handed over is written to the framebuffer untouched, and
   new THREE.Color('#...') would arrive converted to linear and far too
   dark. See the same note in massif.ts. */
const GREY = new THREE.Color(0x9a / 255, 0x94 / 255, 0x8a / 255);

const VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform vec2 uDrift;
  uniform float uTime, uFade, uDensity, uScale, uSeed;

  float hash(vec2 p){
    return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main(){
    vec2 p = vUv * uScale + uDrift * uTime;

    /* Domain warp. Plain fbm gives even, woolly blobs; feeding it back
       into its own coordinates stretches them into the torn, streaky
       shapes a cloud bank actually has. */
    float n = fbm(p + fbm(p * 0.5) * 0.9);

    /* A soft threshold rather than a hard one, so the banks have thin
       edges that trail off instead of a cut line. */
    float a = smoothstep(0.34, 0.80, n) * uDensity;

    /* RADIAL, not rectangular. These planes are far wider than the
       massif so their corners sit well inside the frame at the low
       camera positions — a square fade would draw the sheet's own edge
       across the sky. */
    float r = length(vUv - 0.5) * 2.0;
    a *= 1.0 - smoothstep(0.45, 1.0, r);

    gl_FragColor = vec4(uColor, a * uFade);
  }
`;

export interface CloudBank {
  group: THREE.Group;
  /* Called every frame: `t` is elapsed seconds, `fade` is 0..1. */
  update: (t: number, fade: number) => void;
  dispose: () => void;
}

/* Heights are in the massif's own units, where the summit reaches about
   150. So the first two bands cut ACROSS the mountain's flanks and the
   third sits clear above the peak — which is what makes the massif read
   as tall rather than as a shape on a table. */
const LAYERS = [
  { y: 46, thickness: 30, size: 2.7, scale: 9.0, density: 0.80, drift: [0.0055, 0.0021], seed: 0 },
  { y: 96, thickness: 34, size: 3.1, scale: 7.0, density: 0.66, drift: [-0.0038, 0.0034], seed: 37 },
  { y: 172, thickness: 26, size: 3.6, scale: 5.0, density: 0.46, drift: [0.0026, -0.0015], seed: 91 },
];

/* Slices per band. Five is where the edge-on view stopped reading as a
   line; more only costs fill rate on planes this large. */
const SLICES = 5;

/* Opacity across the stack — a bell, so a band fades out at its top and
   bottom instead of ending on its outermost slice. */
const bell = (i: number) => {
  const t = (i / (SLICES - 1)) * 2 - 1;
  return Math.exp(-t * t * 1.7);
};

export function buildClouds(): CloudBank {
  const group = new THREE.Group();
  const mats: THREE.ShaderMaterial[] = [];
  const geos: THREE.PlaneGeometry[] = [];

  LAYERS.forEach((L) => {
    const weights = Array.from({ length: SLICES }, (_, i) => bell(i));
    const sum = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < SLICES; i++) {
    const geo = new THREE.PlaneGeometry(MASSIF_SIZE * L.size, MASSIF_SIZE * L.size, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: GREY },
        uDrift: { value: new THREE.Vector2(L.drift[0], L.drift[1]) },
        uTime: { value: 0 },
        uFade: { value: 1 },
        /* Divided by the stack's total weight, so a band's overall
           density is what LAYERS says regardless of how many slices it
           is cut into. */
        uDensity: { value: (L.density * weights[i]) / sum },
        uScale: { value: L.scale },
        /* A different seed per slice, or the five would be identical
           sheets and the stack would look like one again. */
        uSeed: { value: L.seed + i * 13.7 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      /* DoubleSide because the camera ends up above these, and depthWrite
         off so the banks blend through each other instead of the nearest
         one punching a hole in the ones behind. */
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = L.y + (i / (SLICES - 1) - 0.5) * L.thickness;
    /* After the massif, so the transparency has something to blend with
       rather than being sorted against it by centroid distance — which
       flips arbitrarily as the camera swings overhead. */
    mesh.renderOrder = 1;
    group.add(mesh);
    mats.push(mat);
    geos.push(geo);
    }
  });

  return {
    group,
    update: (t, fade) => {
      for (const m of mats) {
        m.uniforms.uTime.value = t;
        m.uniforms.uFade.value = fade;
      }
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
