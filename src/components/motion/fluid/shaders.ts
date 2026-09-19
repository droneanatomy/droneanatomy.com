/* GLSL for the fluid cursor.

   A standard stable-fluids solver: advect velocity, compute divergence, solve
   for pressure with Jacobi iterations, subtract the pressure gradient to make
   the field divergence-free, and add vorticity confinement to restore the
   small curls that numerical dissipation eats.

   All passes render a single fullscreen triangle-pair; the vertex shader also
   precomputes the four neighbour UVs so the fragment shaders sample without
   recomputing texel offsets.
*/

export const VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 uTexelSize;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(uTexelSize.x, 0.0);
  vR = vUv + vec2(uTexelSize.x, 0.0);
  vT = vUv + vec2(0.0, uTexelSize.y);
  vB = vUv - vec2(0.0, uTexelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
`;

/* Semi-Lagrangian advection: trace backwards along the velocity field and
   sample what was there. `uDissipation` bleeds the quantity away over time so
   the trail fades instead of accumulating forever. */
export const ADVECTION = HEAD + /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;

void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexelSize;
  vec4 result = texture(uSource, coord);
  float decay = 1.0 + uDissipation * uDt;
  fragColor = result / decay;
}`;

export const DIVERGENCE = HEAD + /* glsl */ `
uniform sampler2D uVelocity;

void main() {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;

  // Reflect velocity at the boundaries so the fluid does not leak off-canvas.
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0)  { L = -C.x; }
  if (vR.x > 1.0)  { R = -C.x; }
  if (vT.y > 1.0)  { T = -C.y; }
  if (vB.y < 0.0)  { B = -C.y; }

  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

export const CURL = HEAD + /* glsl */ `
uniform sampler2D uVelocity;

void main() {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * ((R - L) - (T - B)), 0.0, 0.0, 1.0);
}`;

/* Vorticity confinement — pushes velocity back along the curl gradient so the
   swirls survive. Without it the trail collapses into a soft smear. */
export const VORTICITY = HEAD + /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;

void main() {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;

  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;

  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  velocity = clamp(velocity, -1000.0, 1000.0);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

export const PRESSURE = HEAD + /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;

void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

export const GRADIENT_SUBTRACT = HEAD + /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;

void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

/* Gaussian blob injected at the pointer, into either velocity or dye. */
export const SPLAT = HEAD + /* glsl */ `
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;

void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + splat, 1.0);
}`;

/* Final pass — glass, not ink.

   The advected field is treated as a THICKNESS map, never as colour. A surface
   normal is derived from its gradient and used to light a sheet of clear
   material: a broad edge term where the sheet curves away from the viewer, and
   a tight specular glint along the ridges.

   Nothing here has a hue of its own. The only colour comes from uTint, which
   the host passes in from the page's own foreground colour, and uPolarity,
   which flips the effect between darkening (over light sections) and
   lightening (over dark ones). That is what stops it reading as a foreign
   object sitting on top of the page.
*/
export const DISPLAY = HEAD + /* glsl */ `
uniform sampler2D uTexture;
uniform vec2 uTexelSize;
uniform vec3 uTint;
uniform float uPolarity;   // +1 lighten (dark page), -1 darken (light page)
uniform float uStrength;

float thickness(vec2 uv) {
  return texture(uTexture, uv).r;
}

void main() {
  float c = thickness(vUv);
  float l = thickness(vL);
  float r = thickness(vR);
  float t = thickness(vT);
  float b = thickness(vB);

  // Gradient of the thickness field is the surface slope.
  vec3 normal = normalize(vec3((r - l) * 2.4, (t - b) * 2.4, 0.14));

  vec3 lightDir = normalize(vec3(-0.45, 0.62, 0.65));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Tight glint along ridges.
  vec3 halfway = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfway), 0.0), 42.0);

  // Fresnel-ish edge: brightest where the sheet turns away from the viewer.
  float edge = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);

  // How much material is present at all.
  float mass = smoothstep(0.02, 0.55, c);

  // Refraction stand-in: the slope displaces apparent density, which reads as
  // the surface bending what is behind it.
  float bend = (normal.x + normal.y) * 0.5;

  float shade = (edge * 0.55 + spec * 1.5 + bend * 0.35) * mass * uStrength;

  // Polarity decides whether the lens darkens or lightens its backdrop, so the
  // same effect stays legible across the page's light-to-dark journey.
  vec3 rgb = uTint + vec3(shade * uPolarity);
  /* Capped well below opaque: this is a lens, and you should always be able to
     read the content through it. */
  float a = clamp(abs(shade), 0.0, 0.55);

  fragColor = vec4(clamp(rgb, 0.0, 1.0), a);
}`;
