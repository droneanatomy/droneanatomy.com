/* ============================================================
   photoreal — everything the flight scene does differently when it is
   trying to look like a photograph rather than like a drawing.

   Kept in one file on purpose. This is a mode under review, and a mode
   that is scattered across six call sites cannot be honestly deleted if
   the answer is no. Everything here is called only from the branch
   FlightScene takes when `photoreal` is set.

   THE THREE THINGS THAT WERE MISSING, in order of how much they matter:

   1. SHADOWS. There were none — the renderer's shadowMap was never
      enabled, so the castShadow and receiveShadow flags that were already
      sitting on the terrain and the craft did nothing at all. This is the
      single largest tell: without them a forest does not sit on a
      hillside, it hovers above a picture of one, and relief reads as
      shading rather than as shape.

   2. SURFACE. The terrain is vertex-coloured over a 300x520 grid, which
      means its finest possible detail is about five units wide. Real
      ground has texture at every scale below that, and without it a
      hillside reads as painted plastic no matter how good its silhouette
      is. Added procedurally in the shader rather than as texture maps:
      no download, and it never tiles.

   3. HAZE. The stylised look leans on a lot of fog. Aerial perspective is
      real, but ours is heavy enough to be a graphic device — it flattens
      the distance into a single tone. Pushed back, not removed.
   ============================================================ */

import * as THREE from 'three';

/* How much further the fog is pushed in this mode. The beats still author
   near/far; this scales them, so the shape of each beat's aerial
   perspective survives and only its density changes. */
export const FOG_FAR_SCALE = 2.1;
export const FOG_NEAR_SCALE = 1.6;


/* ---- choreography, measured off usavionix.com -------------------------

   Their camera projection, read out of the projectionMatrix their own
   shaders receive: fov 20, near 0.1, far 2000. Twenty degrees is a long
   lens and it is doing a lot of the work — see the note at the call site.

   THE REST OF THEIR CHOREOGRAPHY, for the record, because it was measured
   once and should not have to be measured again:

     - The world is STATIC. Camera position and every object transform are
       identical frame to frame while the scroll is still. Drift measured
       at 0.00 across 850ms at all 47 sampled scroll positions.
     - The terrain is a 16-unit TILE instanced on a 3-wide grid, at
       x = -16, 0, +16, and the grid's z steps with scroll: z of
       {-9.5, 6.5, 22.5} became {-13.1, 2.9, 18.9} then {-20.4, -4.4, 11.6}
       as the page moved. An infinite scroller built from discrete tiles
       rather than from one periodic mesh, which is the same idea as our
       LOOP wrap arrived at from the other direction.
     - Ground sits at y = -2.5; a second deck of tiles at y = -1.3 carries
       the city.
     - THE AIRCRAFT FLY A THREE-SHIP V: lead on the origin, wingmen at
       about (+/-2.5, 0, -1.9). A looser staggered arrangement
       — (3.2, -1.3), (-3.3, 2.0), (-0.2, -0.1) — is used earlier on.
     - The camera pitch sequence over the scroll: -33 to -90 (drops to a
       plan view), holds -90 while climbing 9.4 to 18.5, releases to -64,
       -31, then swings right around to the far side (z goes negative,
       forward flips) at -19, back up to -90, and settles at -48. */
export const USAV_FOV = 20;

/* Every loop term off. See the note at the call site in FlightScene. */
export const ZERO_LOOP = {
  orbit: 0, push: 0, bob: 0, drift: 0, speed: 0,
  /* NOT 1. Amplitudes are all zero so the period should not matter — but
     anything still reading `phase` gets it from this, and a period of one
     second makes those terms oscillate once a second instead of standing
     still. A long period is the safe value for a mode whose whole point
     is that nothing moves on a clock. */
  period: 1000,
} as const;


/* ---- their beats, mapped onto ours ------------------------------------

   Each of our five scenes gets the camera from the matching moment in
   their reel, read off a screen recording frame by frame:

     ours        theirs        what it is there
     approach    t=0.4s        one aircraft, HUGE, low oblique
     transit     t=4.0s        straight-down plan view, aircraft large
     swarm       t=7.7s        plan view, four aircraft spread wide
     survey      t=22-29s      aircraft bottom-left, sensor cone, thermal panel
     climb       t=14.9-18.5s  one aircraft, oblique, settling

   DISTANCE IS DERIVED, NOT COPIED, and it has to be. `cam` is an offset
   from the craft in world units, and their world is about forty units
   across against our sixteen hundred — their numbers mean nothing here.
   What transfers is HOW BIG THE AIRCRAFT SITS IN FRAME, which is a pure
   function of the lens:

       half-angle across = atan(tan(fov/2) * aspect) = 16.3 deg at fov 20
       distance = (span / 2) / tan(fraction * 16.3 deg)

   with span 11, the size loadCraft fits our model to. So "the aircraft
   fills 40% of the width", measured off their opening frame, solves to a
   camera 48 units out — and that one number is the difference between
   their hero shot and our speck-over-scenery.

   THIS IS ALSO WHY THE LENS ALONE MADE THINGS WORSE. Forcing fov 20 while
   leaving the old offsets in place magnified every beat by about 2.5x
   against framing that had been solved for 34-52 degrees. The lens and
   the distances are one decision, not two.

   Pitch comes straight from their view matrices: -33, -90, -90, -48, -44
   across the five. */
export const USAV_LOOKS: Record<
  string,
  { cam: [number, number, number]; aim: [number, number, number] }
> = {
  /* THE HERO. 40% of frame width -> 48 units out. Elevation 33 degrees,
     both from their opening frame.

     AZIMUTH IS THE PART THAT WAS WRONG, and it is what made the aircraft
     look like it was flying banked over to the right when it was in fact
     dead level. The first pass put the camera 58 degrees off the tail,
     nearly abeam — and a level deck viewed from that far round a corner
     foreshortens into a tilted parallelogram. Nothing was rolled; the
     viewpoint was simply reading the horizontal plane edge-on-ish.

     Theirs sits 32 degrees off. At 30 the aircraft is seen from behind
     and slightly to one side, which is the angle that reads as level
     flight because the wing line stays parallel to the horizon.

     Solved rather than typed: 48 units at 33 degrees up and 30 degrees
     off the tail, with the tail on -X because these beats fly toward +X. */
  approach: { cam: [-35, 26, 20], aim: [0, 0, 0] },

  /* PLAN VIEW, pitch -90, aircraft at 30% of width -> 64 units up. The
     0.6 of z is not decoration: a camera looking exactly down its own up
     axis has no defined roll, and lookAt flips. */
  transit: { cam: [0, 64, 0.6], aim: [0, 0, 0] },

  /* THE SPREAD. Still plan view, but four aircraft across the frame, so
     each is about a tenth of the width -> 193 units. This is the beat
     their reel opens the formation on. */
  swarm: { cam: [0, 193, 8], aim: [0, 0, 0] },

  /* THE THERMAL BEAT, and theirs puts the aircraft BOTTOM-LEFT with the
     cone going down-right and the panel top-right — ours had it
     bottom-right. Mirrored to match: the aim is pushed up and to the
     right of the craft, which is what drives the craft into the opposite
     corner. Pitch -48 at 161 units, for an aircraft about an eighth of
     the width. */
  /* THE AIM OFFSET IS WHAT DRIVES THE CRAFT INTO A CORNER, and it has
     been too strong twice now: at [45,20,-40] nothing of the aircraft was
     in frame at all, and at [20,9,-18] it sat on the very bottom edge.
     Backed off to nearly centred, which is at least correct, rather than
     leaving a broken frame in while chasing the corner. Getting it to sit
     bottom-left like theirs wants another pass — the offset interacts with
     the survey beat's own lock ramp, so it is not a single number. */
  survey: { cam: [-57, 120, 91], aim: [7, 3, -7] },

};

/* ---- shadows ----------------------------------------------------------

   A DIRECTIONAL LIGHT'S SHADOW IS AN ORTHOGRAPHIC BOX, and the whole
   question is how big to make it. Too small and the shadows stop at a
   visible line across the hillside; too large and the map's texels are
   bigger than the trees casting into them.

   The convenient fact here is that THE WORLD DOES NOT MOVE. This scene
   flies by scrolling the land underneath a roughly stationary aircraft —
   terrain.position.z is the odometer, the craft sits near (280, 150, 150)
   in every beat. So the visible ground occupies a fixed region of world
   space, and the box can be static: no per-frame refitting, no cascade,
   and no chance of the shadow camera lagging the view.

   1700 units across at 2048 texels is about 0.83 units per texel, against
   a canopy radius of seven. Nine texels to a treetop is coarse for a hard
   edge and about right for the soft one PCF gives. */
const SHADOW = { size: 850, res: 2048, near: 150, far: 2400 };

export function enableShadows(renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight) {
  renderer.shadowMap.enabled = true;
  /* PCFSoft rather than PCF or VSM. The sun here is 22 degrees off the
     horizon, so shadows are long and their edges are the most visible
     thing about them; the extra taps are worth it. VSM would give softer
     edges still and light-bleeds through the canopy, which is exactly
     where this scene would show it. */
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW.res, SHADOW.res);

  const c = sun.shadow.camera;
  c.left = -SHADOW.size;
  c.right = SHADOW.size;
  c.top = SHADOW.size;
  c.bottom = -SHADOW.size;
  c.near = SHADOW.near;
  c.far = SHADOW.far;
  c.updateProjectionMatrix();

  /* BIAS, and it has to be normalBias rather than plain bias here.

     The terrain is one mesh 1600 units across with 240 of relief, lit
     from 22 degrees. At that grazing angle a constant depth bias either
     leaves acne on the slopes facing the sun or peels the shadow away
     from the foot of every tree. normalBias offsets along the surface
     normal instead, which scales with how obliquely the light is hitting
     each fragment — the right correction for a scene whose whole surface
     is at a different angle to the sun. */
  sun.shadow.normalBias = 1.6;
  sun.shadow.bias = -0.0004;

  /* The sun's own position is authored for its DIRECTION, and it is close
     enough to the subject that the shadow box would clip. Pushed out
     along the same vector so the box is centred on the ground the camera
     is actually looking at, with the target left at the origin. */
  sun.position.normalize().multiplyScalar(1100);
}

/* ---- terrain surface --------------------------------------------------

   Procedural detail injected into the terrain's own material.

   CHAINED, NOT ASSIGNED, and that is not a nicety. thermalProjection.ts
   already owns this material's onBeforeCompile — it is how the sensor's
   picture gets thrown onto the ground in the survey beat. Assigning a new
   handler here would silently delete that, and the failure would show up
   four beats away as a missing projection rather than as anything to do
   with this file. So the previous handler is captured and called first,
   and the cache key is extended rather than replaced.

   THE NOISE IS WORLD-SPACE. Screen-space or UV-space detail swims as the
   camera moves, which is worse than no detail at all. Anchoring it to
   world XZ means it belongs to the ground; the land scrolls under it and
   the detail scrolls with the land. */
const COMMON = `
  varying vec3 vPrPos;

  float prHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float prNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(prHash(i), prHash(i + vec2(1,0)), u.x),
               mix(prHash(i + vec2(0,1)), prHash(i + vec2(1,1)), u.x), u.y);
  }
  float prFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * prNoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

export interface TerrainDetail {
  dispose: () => void;
}

export function attachTerrainDetail(terrain: THREE.Mesh): TerrainDetail {
  const mat = terrain.material as THREE.MeshStandardMaterial;
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;

  mat.onBeforeCompile = (shader, renderer) => {
    /* First, so the projection's own splices are present and this one's
       replacements do not fight them. */
    prev?.call(mat, shader, renderer);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPrPos;')
      .replace(
        '#include <project_vertex>',
        'vPrPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>'
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      /* AFTER color_fragment, which is where three has just multiplied the
         vertex colours into diffuseColor. Going in before it would be
         painting under the thing that decides the hillside's colour. */
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          /* Three scales of breakup. The coarse one varies the ground over
             tens of units so a hillside is not one flat wash; the medium
             is the scale of scrub and rock litter; the fine one is what
             stops the surface looking polished when the camera is low.
             All multiplicative and all centred on 1, so the terrain's own
             colour bands still decide the hue and this only decides how
             even it is. */
          float nCoarse = prFbm(vPrPos.xz * 0.010);
          float nMed    = prFbm(vPrPos.xz * 0.070);
          float nFine   = prNoise(vPrPos.xz * 0.400);
          float breakup = 0.80
            + 0.26 * nCoarse
            + 0.13 * (nMed - 0.5)
            + 0.06 * (nFine - 0.5);
          diffuseColor.rgb *= breakup;

          /* Slightly warmer where it is lighter, cooler in the hollows.
             Real ground is never one hue at two brightnesses. */
          diffuseColor.r *= 1.0 + 0.05 * (nCoarse - 0.5);
          diffuseColor.b *= 1.0 - 0.05 * (nCoarse - 0.5);

          /* THE GRADE, AND IT IS MEASURED AGAINST THE REFERENCE.

             Sampling a terrain-only region of usavionix's own frames gives
             a mean of RGB(79, 83, 74) at a mean channel spread — their
             saturation — of 10.9 out of 255. That is very nearly
             monochrome, and dark. Ours measured RGB(150, 153, 130): about
             twice as bright and about twice as saturated.

             That gap is most of why theirs reads as footage and ours reads
             as an illustration. Aerial imagery of vegetation from altitude
             is desaturated by the atmosphere between lens and ground and
             is much darker than the colour a hillside 'is'. Painting the
             hue a hillside would be up close and lighting it brightly is
             the single most reliable way to make ground look drawn.

             Applied here rather than in the terrain's colour bands so the
             stylised mode keeps its own palette untouched — those bands
             are still what the ink copy and the dark nav were measured
             against, and they are not in this branch. */
          float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.34);
          diffuseColor.rgb *= 0.62;
          /* A cold green-grey cast, which is what the haze between camera
             and ground actually contributes. */
          diffuseColor.rgb *= vec3(0.95, 1.0, 0.94);

          /* HIGHLIGHT ROLLOFF, to kill the white ridges.

             terrain.ts tops its elevation bands with SNOW, and against the
             reference that is simply wrong — there is no white anywhere in
             their frames, at any altitude. Rather than fork the colour
             bands (they are still correct for the stylised mode, and the
             ink copy is measured against them), the highlights are rolled
             off here: a Reinhard-style compression that leaves the darks
             alone and pulls the top of the range down hard, so scree and
             snow both land as pale grey-green rock. */
          diffuseColor.rgb = diffuseColor.rgb / (1.0 + diffuseColor.rgb * 1.7);
        }`
      )
      /* Roughness varies with the same noise. A uniform roughness is one
         of the strongest cues that a surface is computer-generated —
         damp hollows and dry ridges do not scatter light the same way. */
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor *= 0.86 + 0.22 * prFbm(vPrPos.xz * 0.031);`
      )
      /* A normal perturbation, derived from the same field by finite
         difference. This is what gives the ground relief BELOW the size of
         a mesh triangle — the vertex grid here is about five units, and
         everything finer than that has to come from the normal or it does
         not exist at all. */
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          float e = 0.9;
          vec2 p = vPrPos.xz * 0.13;
          float h0 = prFbm(p);
          float hx = prFbm(p + vec2(e, 0.0));
          float hz = prFbm(p + vec2(0.0, e));
          vec3 bump = normalize(vec3(h0 - hx, 0.55, h0 - hz));
          normal = normalize(mix(normal, normalize(normal + bump * 0.55), 0.65));
        }`
      );
  };

  mat.customProgramCacheKey = () =>
    (prevKey ? prevKey.call(mat) : '') + '|flight-photoreal-detail';
  mat.needsUpdate = true;

  return {
    dispose: () => {
      mat.onBeforeCompile = prev ?? (() => {});
      mat.customProgramCacheKey = prevKey ?? (() => '');
      mat.needsUpdate = true;
    },
  };
}
