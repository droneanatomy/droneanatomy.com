'use client';

/* ============================================================
   FlightScene — one fixed canvas, driven by page scroll.

   The architecture the reference site uses, and the one we already had
   half of:

     · ONE full-screen canvas, position:fixed, that never moves
     · a very tall document behind it, whose only job is scroll distance
     · scroll -> page progress -> per-scene progress (flightBeats)
     · the camera runs on SCROLL; everything else runs on the CLOCK

   That last line is the important one. Measuring their page with the
   scroll untouched, over half the frame still repainted every few
   seconds — rotors, haze, drift. It is why a scene paused mid-read looks
   alive, and why scroll jitter never has to look smooth: the ambient
   motion covers it. Our P10 hero is the opposite, pure scrub, and that
   is exactly why its tail felt dead.

   SCROLL TRIGGERS; IT DOES NOT SCRUB.

   Each scene runs a LOOPING animation on the clock — orbit, push, bob,
   drift — that plays forever whether anyone scrolls or not. Crossing a
   scene boundary FIRES a transition, and that transition then plays out
   on its own clock over TRANSITION_SEC and finishes on its own. Scroll
   lets go the moment it has fired.

   This is a state machine, not an interpolation of scroll:

     holding(i)          the scene's loop runs, forever
     crossing a boundary fires -> transitioning(i -> j, started at t)
     after TRANSITION_SEC        -> holding(j)

   Why not scrub it: a scrubbed transition's speed is whatever speed
   someone happens to be spinning a wheel at. It can be halted halfway,
   reversed mid-move, or slammed through in three frames. Firing it and
   letting it run gives the move its own timing, which is the difference
   between a page that animates and a page that is being dragged.

   Transitions step ONE scene at a time even if the scroll jumps several,
   so no set piece is ever skipped past without being seen.

   Camera stations are authored as data in flightBeats because there is no
   Blender yet. The reference ships camera-animations.glb and scrubs an
   AnimationMixer, which is the right end state. The swap is contained:
   replace the look interpolation and nothing else changes.
   ============================================================ */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  FLIGHT, SCENES, TRANSITION_SEC, advanceClock, sceneAt, clamp01, easeInOutCubic, lerp,
  type Look,
} from './flightBeats';
import { buildVtol, buildFleetCraft, spinRotors, type Craft } from './craft';
import {
  buildTerrain,
  buildWater,
  groundAt,
  refreshTerrain,
  terrainReady,
  setTerrainAnisotropy,
  LOOP,
  TERRAIN_SIZE,
} from './terrain';
import { buildTrees, type Forest } from './trees';
import {
  attachTerrainDetail,
  enableShadows,
  FOG_FAR_SCALE,
  FOG_NEAR_SCALE,
  USAV_FOV,
  USAV_LOOKS,
  ZERO_LOOP,
  type TerrainDetail,
} from './photoreal';
import { loadCraft, describe } from './loadCraft';
import { buildMeshLinks } from './meshLinks';

/* What the survey beat publishes for the DOM chrome to draw against.

   Screen coordinates in CSS pixels, so the SVG callout can be laid out in
   the same space as the sensor panel without knowing anything about the
   camera. Written into a ref every frame rather than pushed through
   state — this changes 60 times a second and re-rendering a tree to move
   two dashed lines would be absurd. */

/* Blend two looks. Every field interpolates, including fog and sky, so a
   transition changes the weather as well as the angle — which is most of
   what sells two shots of the same terrain as two different places. */
const V = (a: readonly number[], b: readonly number[], t: number, out: THREE.Vector3) =>
  out.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));

/* Where each fleet craft sits relative to the VTOL once formed up. */
const FORMATION: Record<string, [number, number, number]> = {
  heavy: [-15, -6, 13],
  observer: [16, 3, 11],
  compact: [7, 9, 21],
};

export interface FlightSceneProps {
  /* 0..1 across the whole scrolling document. */
  progressRef: React.MutableRefObject<number>;
  /* Fires when a transition SETTLES on a new scene — not while one is
     playing. The deck copy follows this rather than raw scroll, so the
     words change when the picture does. */
  onScene?: (index: number) => void;
  /* OFF BY DEFAULT, and that default is the point: this mode is under
     review and the homepage must not change while it is. Everything it
     touches is guarded on it, so with the flag down this file renders the
     scene that was here before, to the pixel. See /preview/trees.

     NAMED FOR WHAT IT DOES NOW. It started as `trees` because a forest
     was the whole of it; it has since grown shadows, a procedural ground
     surface and thinner haze, and a flag called `trees` that also changes
     the fog is a flag that will be misread. */
  photoreal?: boolean;
  className?: string;
}

export const FlightScene: React.FC<FlightSceneProps> = ({
  progressRef,
  onScene,
  photoreal = false,
  className = '',
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      return; // no WebGL: the wrapper's flat sky colour stands in
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    /* Was 1.05, then 1.35 to recover the level after the fill was cut to
       0.45 (the ground had been sitting at a median of 38/255, which reads
       as dusk rather than daylight). 1.35 on top of a key of 3.1 then
       overshot the other way and bleached the sunlit slopes — see the
       sun's own note. This is the balance point: the key carries the
       level, exposure no longer has to.

       Worth knowing before touching this: a Color scene.background does
       NOT go through tone mapping, so exposure moves the land without
       moving the sky. Measured, the sky comes back exactly as authored.
       That is why this can be tuned freely without disturbing the ink
       copy or the dark nav, both of which are set against the sky. */
    renderer.toneMappingExposure = 1.28;

    /* Before the scene, because enableShadows edits the renderer and the
       sun, and the sun is added to the scene below. */
    const scene = new THREE.Scene();
    /* Matches the first beat's sky in flightBeats — the green grey
       described there. Only ever seen for the frames before the first
       beat blend lands, but a warm value here reads as a flash. */
    const SKY = new THREE.Color('#bcc1b4');
    scene.background = SKY;
    /* Fog is doing more work here than the lighting. Aerial distance is
       almost entirely haze, and without it a 900-unit plane reads as a
       tabletop model rather than as land seen from height. */
    scene.fog = new THREE.Fog(SKY, 180, 720);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2200);

    /* A LOW sun, and a much weaker fill.

       Relief is read almost entirely from the difference between the lit
       and unlit faces of a ridge. The first pass had the sun high (220
       against 160 lateral, roughly 54 degrees) and a hemisphere fill at
       1.15 — which lit the shadow sides nearly as brightly as the lit
       ones and flattened the mountains into green shapes. Dropping the
       sun to about 22 degrees lengthens the modelling across every slope,
       and cutting the fill to 0.45 lets the away-faces actually go dark.

       Warmer sun against a cooler fill also separates them: lit ground
       reads sunlit, shadowed ground reads sky-lit, which is what happens
       outdoors. */
    /* SOFTENED FROM 0xffe8c4, which was costing more than it looked.
       That value is (255, 232, 196), so in linear terms it multiplied the
       green channel by 0.81 and blue by 0.56 — on green ground that ate
       most of the albedo's advantage over red before fog had even been
       applied. This is still visibly warm against the cool fill, which is
       what the note above wants; it just no longer neutralises the thing
       it is lighting. */
    /* DROPPED FROM 3.1, which was overdriving the lit faces into the ACES
       shoulder. That matters more than it sounds: the shoulder does not
       merely clip, it DESATURATES toward white, so every sunlit slope was
       being bleached of whatever colour it had. Green ground made it
       obvious — the hillsides came out cream and green survived only on
       faces turned away from the sun.

       2.25 was the first correction and it overshot: highlights recovered
       but the whole land came down with them, and the ink copy went with
       it. The level belongs in the albedo, not the key — see the note on
       the greens in terrain.ts — so this sits just under the point where
       the brightest slopes start to bleach. Read with the exposure note. */
    const sun = new THREE.DirectionalLight(0xfff2de, 2.6);
    sun.position.set(-320, 130, 90);
    scene.add(sun);
        /* Sky half nudged a touch green for the same reason as the fog; the
       ground half was already a green and stays as it is. */
    scene.add(new THREE.HemisphereLight(0xd8dcd6, 0x3a4030, 0.45));

    if (photoreal) enableShadows(renderer, sun);

    /* Before the terrain's texture is configured, which happens when its
       plates land. */
    setTerrainAnisotropy(renderer.capabilities.getMaxAnisotropy());

    const terrain = buildTerrain();
    scene.add(terrain);
    /* The land starts as noise and becomes the baked landscape the moment
       its plates arrive — see terrainReady in terrain.ts. Done as an
       upgrade rather than a gate because groundAt is called synchronously
       by the sensor, the thermal field and the forest, and none of them
       can wait on a fetch. */
    terrainReady().then(() => {
      /* `disposed` is declared further down, which is fine: this callback
         cannot run before the effect body has finished. */
      if (disposed) return;
      refreshTerrain(terrain);
    });

    /* A SIBLING OF THE TERRAIN, NOT A CHILD, and the reason is the scroll.

       The land moves by setting terrain.position.z to `flown % LOOP` and
       relies on the height field being exactly periodic over that
       distance. Parenting the forest to the terrain would inherit that
       for free — but the terrain is rotated -90 degrees about X, so every
       instance matrix would have to be authored in the plane's local
       space, where Y is world -Z. Placing them in world space and giving
       them the same shift is the same result with none of that. The shift
       is applied beside the terrain's own, below. */
    let forest: Forest | null = null;
    let detail: TerrainDetail | null = null;
    if (photoreal) {
      forest = buildTrees();
      forest.meshes.forEach((im) => scene.add(im));
      /* After the terrain exists and before the first frame. */
      terrain.castShadow = true;
    }

    if (photoreal) detail = attachTerrainDetail(terrain);
    const water = buildWater();
    scene.add(water);

    /* The procedural VTOL goes in immediately so the scene is never empty,
       and the real model replaces it when it arrives. Loading a 2.4 MB
       Draco GLB takes a moment and a blank sky in the meantime would read
       as a broken page rather than a loading one. */
    let vtol: Craft = buildVtol();
    scene.add(vtol);

    let disposed = false;
    /* Yawed a quarter turn. The model's long axis is X (bbox 27.7 wide
       against 20.7 deep), so lookAt — which points -Z at the target —
       flew it sideways. Measuring cannot tell a nose from a tail, so
       this is the one thing the loader will not guess. */
    loadCraft('/models/vtol.glb', {
      span: 11,
      /* ONE HUNDRED AND EIGHTY. Not plus or minus ninety, both of which
         were wrong in the same way.

         THE NOSE IS -Z, and this is measured, not inferred. The LENS
         material's two pieces sit at z -7.25, at the extreme -z end of a
         model that runs -7.81 to 10.19 on that axis, and dead centre in x
         (-0.05). The rotors span x symmetrically, -12.08 to +12.08 — that
         is the ARM SPAN, and it being the longest extent (24.17 against
         18.01 front-to-back) is exactly what made +x look like the nose.

         three's lookAt on a non-camera object aligns the object's +Z with
         the target, so the rotation has to carry -Z onto +Z: a half turn
         about y. Working it through — (x cos + z sin, y, -x sin + z cos) —
         (0,0,-1) lands on (0,0,1) at 180 degrees.

         WHAT THE OLD VALUES DID. At -90, (0,0,-1) lands on (+1,0,0): the
         nose points ninety degrees off the heading and the aircraft flies
         sideways. At +90 it lands on (-1,0,0) — sideways the other way.
         The note that used to be here reasoned confidently from "the nose
         runs along its own +X", which was never checked against the mesh;
         it read the arm span as the fuselage. Neither previous value ever
         pointed the nose down the flight path. */
      rotate: [0, Math.PI, 0],
    }).then((real) => {
      if (!real || disposed) return;
      scene.remove(vtol);
      vtol = real;
      scene.add(vtol);
      if (process.env.NODE_ENV !== 'production') {
        const d = describe(real);
        // eslint-disable-next-line no-console
        console.info('[flight] vtol.glb', d.triangles.toLocaleString(), 'tris,',
          d.drawCalls, 'draw calls,', 'fitted span 11u');
      }
    });

    /* The net between the airframes in the fleet beat. Added before the
       craft so it is in the scene from the first frame; it stays invisible
       until that beat weighs in. */
    const links = buildMeshLinks();
    scene.add(links.line);

    const fleet: Craft[] = (['heavy', 'observer', 'compact'] as const).map((v) => {
      const c = buildFleetCraft(v);
      c.visible = false;
      scene.add(c);
      return c;
    });

    /* Scratch, allocated once. A per-frame `new THREE.Vector3()` in a
       scroll handler is how you get GC sawtooth in a scrubbed scene. */
    const craftPos = new THREE.Vector3();
    /* Lead craft first, then the three fleet members — the order
       meshLinks builds its edge list against. Allocated once and written
       in place, like every other per-frame vector here. */
    const nodes = [0, 1, 2, 3].map(() => new THREE.Vector3());
    const headPos = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const aimPos = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const skyA = new THREE.Color();
    const skyB = new THREE.Color();

    /* THEIR CAMERA, BEAT BY BEAT, merged over ours.

       Done here rather than at the point of use because `looks` is what
       every later lerp reads — swapping the table at source means the
       transitions, the survey lock and the fog all keep working on the
       new poses without a single one of them knowing anything changed. */
    const looks: Look[] = SCENES.map((sc) =>
      photoreal && USAV_LOOKS[sc.id] ? { ...sc.look, ...USAV_LOOKS[sc.id] } : sc.look
    );
    /* Looked up rather than written as 3, so reordering or inserting a
       scene does not silently move the detection overlay onto whichever
       beat happens to land in fourth place. */
    const SURVEY = SCENES.findIndex((sc) => sc.id === 'survey');

    /* The machine. `current` is the scene being held; `trans` is non-null
       only while a fired transition is playing out. */
    let current = 0;
    let trans: { from: number; to: number; start: number } | null = null;
    let announced = -1;

    /* Distance the LAND has travelled. Integrated rather than derived from
       the clock, because each scene streams at its own speed and a scene
       change must not make the ground jump — integrating keeps it
       continuous across a speed change. */
    let flown = 0;
    let lastT = 0;

    /* When the survey beat last SETTLED, on the scene clock.

       The lock used to be derived from how close a moving target had got
       to the footprint, which was the right answer while the land was
       still streaming — the aircraft found something and braked onto it.
       With the beat now a hover there is nothing to approach, so the lock
       is simply time: the shot arrives, holds for a moment, and then the
       sensor panel opens on it. NaN whenever this is not the beat being
       held, so leaving and coming back replays the reveal. */
    let settledAt = Number.NaN;


    /* Seconds from the shot settling to a full lock. Long enough that the
       panel is clearly a consequence of the aircraft stopping rather than
       part of the same cut. */
    const LOCK_SEC = 2.4;

    /* The ground reference the craft holds its clearance above. Smoothed
       and anticipatory rather than sampled straight from underneath —
       see the terrain-following block below. Seeded on the first frame so
       the craft does not swing up from zero. */
    let groundRef = Number.NaN;

    const applyScroll = (p: number, t: number) => {
      /* SCROLL'S ONLY JOB. Which scene is the scroll asking for — and if
         that is not the one being held, and nothing is already playing,
         fire the next step toward it. */
      if (!trans) {
        const want = sceneAt(p, FLIGHT.clock);
        if (want !== current) {
          const step = want > current ? 1 : -1;
          trans = { from: current, to: current + step, start: t };
        }
      }

      let a = looks[current];
      let b = a;
      let blend = 0;

      if (trans) {
        /* The beat being entered may set its own duration — see enterSec
           in flightBeats. Read from the target rather than the source,
           because what makes a move long is where it is going. */
        const dur = SCENES[trans.to].enterSec ?? TRANSITION_SEC;
        const u = clamp01((t - trans.start) / dur);
        a = looks[trans.from];
        b = looks[trans.to];
        blend = easeInOutCubic(u);
        if (u >= 1) {
          current = trans.to;
          trans = null;
          a = b = looks[current];
          blend = 0;
        }
      }

      if (current !== announced && !trans) {
        announced = current;
        onScene?.(current);
      }

      /* The survey beat's own weight, resolved HERE rather than at the end
         of the frame because the brake below has to multiply the ground
         speed before it is integrated. During a transition the two ends
         carry 1-blend and blend between them; at rest only the held scene
         counts, so the beam and the overlay fade on exactly the curve the
         fog and the framing do. */
      const detOn = trans
        ? trans.from === SURVEY
          ? 1 - blend
          : trans.to === SURVEY
            ? blend
            : 0
        : current === SURVEY
          ? 1
          : 0;
      if (!trans && current === SURVEY) {
        if (Number.isNaN(settledAt)) settledAt = t;
      } else if (current !== SURVEY) {
        settledAt = Number.NaN;
      }
      const ramp = Number.isNaN(settledAt) ? 0 : clamp01((t - settledAt) / LOCK_SEC);
      const locked = ramp * ramp * (3 - 2 * ramp) * detOn;

      V(a.craft, b.craft, blend, craftPos);
      V(a.heading, b.heading, blend, headPos);
      V(a.cam, b.cam, blend, camPos);
      V(a.aim, b.aim, blend, aimPos);

      /* THE LOOP. Runs on the clock at the scene's own period, forever,
         and is completely independent of scroll. During a transition the
         two scenes' loops crossfade along with everything else. */
    /* USAVIONIX'S SCENE HAS NO CLOCK, and that is the biggest single
       difference in how the two read.

       Measured off their site: with the scroll held still, every camera
       and every object transform is byte-identical frame to frame. Their
       drift between samples 850ms apart is exactly 0. Nothing bobs, nothing
       orbits, nothing scrolls — the whole sequence is a pure function of
       scroll position, and stopping the scroll stops the world.

       Ours does the opposite. Terrain scrolls on a clock, the craft bobs
       and orbits and drifts on their own periods, and the scene keeps
       moving when the reader stops. That reads as an idle animation
       playing behind the copy; theirs reads as something being deliberately
       shown to you.

       So in this mode every loop term goes to zero and the scene becomes
       scroll-driven only, exactly as theirs is. The beats still author
       these values because the stylised mode still uses them. */
      const la = photoreal ? ZERO_LOOP : a.loop;
      const lb = photoreal ? ZERO_LOOP : b.loop;
      const period = lerp(la.period, lb.period, blend);
      const orbit = lerp(la.orbit, lb.orbit, blend);
      const push = lerp(la.push, lb.push, blend);
      /* Damped, but only about half way. The land under this beat is
         already stopped dead, and a craft sliding across frame over
         static ground reads as the terrain having broken rather than as
         a hover — but taking the motion out ENTIRELY leaves a
         photograph. What is left is a slow rise and fall on the spot,
         which is what hovering looks like. */
      const calm = 1 - locked * 0.45;
      const bob = lerp(la.bob, lb.bob, blend) * calm;
      const drift = lerp(la.drift, lb.drift, blend) * calm;

      const phase = (t / Math.max(1, period)) * Math.PI * 2;

      /* THE LAND MOVES, NOT THE CRAFT.

         The craft holds its station and the terrain streams past beneath
         it, which is what reads as continuous forward flight. Because the
         height field is exactly periodic every LOOP units, the modulo is
         not a seam — it is the same ground arriving again, so this can run
         indefinitely without a rebuild.

         Integrated from dt so a scene change alters the SPEED without
         teleporting the ground. dt is clamped: a backgrounded tab returns
         a multi-second delta and would otherwise jump the land a mile. */
      const dt = Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      flown += lerp(a.loop.speed, b.loop.speed, blend) * dt;   // see follower below
      const shift = flown % LOOP;
      terrain.position.z = shift;
      water.position.z = shift;
      /* Exactly the terrain's shift. Anything else and the forest slides
         across the land it is supposed to be growing out of. */
      if (forest) forest.meshes.forEach((im) => { im.position.z = shift; });

      craftPos.y += Math.sin(phase) * bob;
      craftPos.x += Math.sin(phase * 0.61) * drift;
      craftPos.z += Math.cos(phase * 0.47) * drift * 0.7;

      /* TERRAIN FOLLOWING, filtered.

         Sampling the ground directly under the craft made it hug every
         contour: a ridge streaming past at 155 u/s shoved the airframe up
         and dropped it again, which is the jerk. No aircraft flies that
         profile and nothing that does reads as flight.

         Two fixes, and both are needed:

         ANTICIPATE. Take the highest ground over the next few seconds of
         travel, not the ground underneath. Sampling underneath means the
         craft only starts climbing once the ridge is already beneath it,
         so it is always late and always abrupt. Looking ahead by roughly
         three seconds of travel means it is already above whatever
         arrives — the same thing a terrain-following autopilot does.

         SMOOTH. Then ease toward that reference on a time constant rather
         than snapping to it. The lookahead's max jumps in steps as peaks
         enter and leave the window; the filter turns those steps into a
         gentle swell. TAU of 2.2s is long enough to erase the steps and
         short enough to clear real ground. */
      const speed = lerp(a.loop.speed, b.loop.speed, blend);
      const look = Math.max(240, speed * 3);
      let highest = -1e9;
      for (let k = 0; k < 6; k++) {
        const zz = craftPos.z - shift - (look * k) / 5;
        const g = groundAt(craftPos.x, zz);
        if (g > highest) highest = g;
      }

      const TAU = 2.2;
      if (Number.isNaN(groundRef)) groundRef = highest;
      else groundRef += (highest - groundRef) * (1 - Math.exp(-dt / TAU));

      craftPos.y += groundRef;

      vtol.position.copy(craftPos);
      vtol.lookAt(headPos);
      /* A gentle bank, and it is ZEROED in photoreal for the same reason
         the other loops are: that mode is scroll-driven and nothing should
         move while the reader is still. It also removes any doubt about
         whether an apparent tilt is roll or viewpoint — with this off, it
         can only be viewpoint. Left on elsewhere; a little bank is what
         keeps the stylised mode from looking like a model on a wire. */
      if (!photoreal) vtol.rotateZ(Math.sin(phase * 0.83) * 0.06);

      /* Orbit the camera station around the craft's up axis, and breathe
         it in and out. Both are the shot, not garnish — with them off, a
         held scene is a still frame. */
      const swing = Math.sin(phase * 0.73) * orbit * calm;
      const cs = Math.cos(swing), sn = Math.sin(swing);
      const ox = camPos.x * cs - camPos.z * sn;
      const oz = camPos.x * sn + camPos.z * cs;
      tmp.set(ox, camPos.y, oz);
      const breathe = 1 + (Math.sin(phase * 0.51) * push) / Math.max(1, tmp.length());
      camera.position.copy(craftPos).addScaledVector(tmp, breathe);
      camera.lookAt(tmp.copy(craftPos).add(aimPos));

      /* THEIR LENS IS 20 DEGREES, ours 34 to 52. Read straight off their
         projection matrix, and it is not a detail — a 20mm-equivalent
         long lens compresses depth, holds the far ridge at nearly the size
         of the near one, and is most of why their frames read as
         reconnaissance footage rather than as a game camera. A wide lens
         puts the viewer inside the landscape; a long one puts them a mile
         above it with a spotting scope. */
      const fov =
        (photoreal ? USAV_FOV : lerp(a.fov, b.fov, blend)) * (portrait ? 1.34 : 1);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      skyA.set(a.sky); skyB.set(b.sky);
      skyA.lerp(skyB, blend);
      (scene.background as THREE.Color).copy(skyA);
      const fog = scene.fog as THREE.Fog;
      fog.color.copy(skyA);
      fog.near = lerp(a.fog[0], b.fog[0], blend) * (photoreal ? FOG_NEAR_SCALE : 1);
      fog.far = lerp(a.fog[1], b.fog[1], blend) * (photoreal ? FOG_FAR_SCALE : 1);

      const fleetLit = lerp(a.fleet ? 1 : 0, b.fleet ? 1 : 0, blend);
      fleet.forEach((c, k) => {
        c.visible = fleetLit > 0.02;
        if (!c.visible) return;
        const f = FORMATION[c.userData.label];
        tmp.set(f[0], f[1], f[2]).multiplyScalar(lerp(2.4, 1, fleetLit));
        c.position.copy(craftPos).add(tmp);
        c.position.y += Math.sin(phase * 1.3 + k * 2.1) * 0.8;
        c.lookAt(headPos.x, c.position.y, headPos.z);
        c.scale.setScalar(fleetLit);
      });

      /* The net. Positions are taken AFTER the formation has been placed
         for this frame, so the links land on the airframes rather than
         one frame behind them — at 36 units a second of drift that lag
         would be visible as the dashes hanging off the craft. */
      nodes[0].copy(craftPos);
      for (let k = 0; k < fleet.length; k++) nodes[k + 1].copy(fleet[k].position);
      links.update(nodes, fleetLit, t);

      /* The beam, and the two points the DOM callout hangs off.

         Projected here rather than in the component because this is the
         only place that has the camera after it has been aimed for this
         frame — doing it a tick later, from a ref, would draw the dashed
         leaders against where the aircraft WAS. */
    };

    let raf = 0;
    let inView = true;
    const clock = new THREE.Clock();
    /* THE SCENE'S OWN TIME, accumulated rather than read off the wall.

       The frame below returns early when the section is out of view, so the
       clock goes unread while the reader is elsewhere and its next delta
       carries the whole absence. Feeding that straight to the loops jumped
       them most of a cycle in one frame; see advanceClock in flightBeats. */
    let sceneT = 0;

    const io = new IntersectionObserver((e) => { inView = e[0].isIntersecting; }, { threshold: 0 });
    io.observe(wrap);

    let portrait = false;

    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      portrait = w / h < 1;
      /* fov itself is set per-frame from the scene's look; resize only
         records the orientation it should be scaled by. Widening on
         portrait is the cheap version of what the reference does with a
         separate mobile camera clip — a framing that works in landscape
         crops the aircraft out of a phone. */
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!inView) return;
      sceneT = advanceClock(sceneT, clock.getDelta());
      applyScroll(clamp01(progressRef.current), sceneT);
      spinRotors(vtol, sceneT);
      fleet.forEach((c) => c.visible && spinRotors(c, sceneT, 34));
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      io.disconnect();
      links.dispose();
      /* SKIPS ANYTHING MARKED SHARED, which is the craft's geometry and
         materials — loadCraft parses the model once and hands both this
         scene and the enquiry deck a clone that points at the same
         buffers. Disposing them here would delete the model out from
         under a section that is still drawing it.

         Not hypothetical: React's StrictMode mounts, unmounts and
         remounts in development, so this cleanup runs while the cached
         template is still live and about to be handed to the remount. */
      /* Before the sweep below, because the forest's geometry and
         material are its own and nothing shares them. */
      detail?.dispose();
      forest?.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          if (!m.geometry?.userData.shared) m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => { if (!x.userData.shared) x.dispose(); });
          else if (mat && !mat.userData.shared) mat.dispose();
        }
      });
      renderer.dispose();
    };
    /* `photoreal` IS IN HERE, and it belongs. The effect reads it when it
       builds the world, so React re-running this on a change is correct
       rather than merely tolerated: the cleanup above disposes the whole
       scene and the next run builds the other one. That is what makes the
       toggle on /preview/trees work without the route having to force a
       remount by hand. Everything else here is a ref or a stable setter. */
  }, [progressRef, onScene, photoreal]);

  return (
    /* ABSOLUTE, not fixed. The pinning is done by an ancestor with
       position:sticky, which confines it to its own section — a fixed
       canvas covers the viewport for the whole document, so on a page
       where the flight is one section among others it would paint over
       everything above and below it. */
    <div ref={wrapRef} className={className} style={{ position: 'absolute', inset: 0, background: '#bcc1b4' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default FlightScene;

export { TERRAIN_SIZE, SCENES };
