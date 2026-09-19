'use client';

/* ============================================================
   EnquiryScene — the aircraft, holding station over a lit deck.

   The reference puts a vessel on a sea under a bright horizon and lets
   the whole thing simply run. This is the same picture with the aircraft
   in the vessel's place: camera behind and a little above, the craft
   dark against the light, a surface below streaming past to say it is
   moving.

   NOT SCROLL-DRIVEN, unlike everything above it on this page. The flight
   cuts between set pieces on a trigger and the survey is scrubbed by the
   reader; this one runs on its own clock and ignores scroll entirely,
   because the section it sits under is a form. Anything that reacted to
   scroll here would be competing with someone trying to read a label.

   THE HORIZON DOES THE WORK. Sky dome and deck share one colour and the
   deck fogs into it, so the seam between them is not a line that has to
   be positioned — it emerges wherever the geometry actually meets, at
   any camera angle or aspect. Getting that for free is the whole reason
   the sky is a world-space dome rather than a screen-space gradient.
   ============================================================ */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildVtol, spinRotors, type Craft } from '../flight/craft';
import { loadCraft } from '../flight/loadCraft';

/* Display-space colours.

   A ShaderMaterial never receives three's colorspace_fragment chunk, so
   whatever these hold is written to the framebuffer untouched. Built
   from raw components for that reason — new THREE.Color('#...') would
   convert to linear and come out far too dark, which is exactly the bug
   the survey's plate hit. Colours that go to a LIGHT or a standard
   material still use hex, because those ARE colour-managed. */
const display = (hex: number) =>
  new THREE.Color(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

/* The shot, as three angles. They are not independent.

   PITCH ALONE SETS THE HORIZON. Where the horizon falls in frame depends
   only on how far the lens is tilted — not on its height, not on its
   distance. Move the camera up a hundred units and the horizon does not
   shift a pixel.

   DEPRESSION ALONE SETS WHAT YOU SEE OF THE CRAFT. Lens above it and you
   are looking at its top; lens below and you are looking at its belly.

   And those two together decide the third thing, which is why the
   earlier rig could not be nudged into this one: a craft drawn ABOVE the
   horizon line is, by definition, higher than the lens, so it can only
   ever be seen from underneath. Wanting to look down on it means
   accepting it sits below the line — and that means raising the horizon
   into the copy, which is what the scrim behind the type is for. Every
   piece of this follows from those two facts. */
const CAM_Z = 52;         /* a little further back than 44 */
const DEPRESSION = 0.212; /* ~12.2 deg above the craft — enough to see its top */
const PITCH = -0.106;     /* ~6.1 deg DOWN, putting the horizon at a third */
const CAM_Y = 0;          /* derived below; kept for the resize path */
/* On the axis. The craft is the fixed point now and the camera is
   placed relative to it, rather than both being tuned against each
   other — which is what made the previous rig four coupled numbers. */
const CRAFT_Y = 0;

const HORIZON = 0xd2cfc9;
const VOIDC = 0x080807;
const DEEP = 0x080706;

const SKY_VERT = `
  varying vec3 vDir;
  void main(){
    /* The dome is re-centred on the camera every frame, so a point's own
       local position IS the direction to it. */
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uHorizon, uVoid;
  void main(){
    float h = vDir.y;
    /* A tight band at the horizon and a long tail into the dark. exp of
       the absolute height gives both from one term, and never creases
       the way a smoothstep pair does where the two halves meet. */
    float band = exp(-abs(h) * 6.2);
    /* A little extra lift just above the line, so the sky reads as
       atmosphere rather than as a lamp behind a black card. */
    float haze = exp(-max(h, 0.0) * 2.1) * 0.22;
    vec3 col = mix(uVoid, uHorizon, clamp(band + haze, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const DECK_VERT = `
  varying vec3 vWorld;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const DECK_FRAG = `
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 uHorizon, uDeep;
  uniform vec2 uCam;
  uniform float uFlow, uNear, uFar;

  /* Three crossed waves, each bent by the one before it. Cheaper than
     noise and, for a surface only ever seen at a grazing angle, reads
     the same — what carries the water is the glint pattern, not the
     detail inside it. */
  float waves(vec2 p){
    float a = sin(p.x * 0.9 + sin(p.y * 0.6) * 1.6);
    float b = sin(p.y * 1.3 + a * 0.9);
    float c = sin((p.x + p.y) * 0.55 + b * 1.2);
    return (a + b + c) / 3.0;
  }

  void main(){
    float d = length(vWorld.xz - uCam);
    float fog = smoothstep(uNear, uFar, d);

    /* Scrolls TOWARD the camera, because the craft is flying away.

       The direction of this and the way the aircraft points are one
       decision, and getting them out of step makes an aircraft that
       flies backwards. Tail-on and flowing toward the lens is the pair
       that agrees; turn the craft around and this has to turn with it.

       THE FREQUENCY IS THE ALTITUDE. At 0.035 the swells came out about
       180 units across, and a 180-unit swell seen from 1500 units away
       looks like water a few metres below the lens — the craft read as
       floating on it however far down the plane was actually pushed.
       Fine detail at distance is what the eye reads as height, so this
       is the number that sells the flight, not the camera. */
    vec2 p = vec2(vWorld.x, vWorld.z + uFlow) * 0.17;
    float w = waves(p);
    float glint = pow(max(w, 0.0), 3.0);

    /* The lit path, widening with distance the way a sun path does.
       Without it the deck is an even field and the eye has nothing to
       follow out to the horizon. */
    float path = exp(-pow(vWorld.x / (40.0 + d * 0.30), 2.0));

    vec3 col = mix(uDeep, uHorizon, pow(fog, 0.85));
    col += uHorizon * glint * (0.10 + 0.80 * path) * (1.0 - fog * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface EnquirySceneProps {
  className?: string;
}

export const EnquiryScene: React.FC<EnquirySceneProps> = ({ className = '' }) => {
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
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 6000);

    const horizon = display(HORIZON);

    /* ---- sky ---- */
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(2600, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uHorizon: { value: horizon }, uVoid: { value: display(VOIDC) } },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
      })
    );
    scene.add(sky);

    /* ---- deck ---- */
    const deckMat = new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: horizon },
        uDeep: { value: display(DEEP) },
        uCam: { value: new THREE.Vector2() },
        uFlow: { value: 0 },
        /* Starts well out, because at this altitude nothing nearer than
           a few hundred units is ever in frame — a near value tuned for
           a low camera just wasted the whole ramp. */
        uNear: { value: 260 },
        uFar: { value: 1500 },
      },
      vertexShader: DECK_VERT,
      fragmentShader: DECK_FRAG,
    });
    /* Segmented, not a single quad. The waves are computed per fragment
       so the geometry does not need detail — but a 1x1 plane this large
       gets its interpolated world position wrong enough at the corners
       to bend the lit path visibly. */
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 24, 24), deckMat);
    deck.rotation.x = -Math.PI / 2;
    /* FAR below, and that distance is the whole point.

       At -46 the craft read as sitting ON the surface, exactly like the
       reference's vessel — which is right for a ship and wrong for an
       aircraft. Altitude cannot be shown by moving the craft up the
       frame, because a shape against an empty sky has no scale; it is
       shown by putting a great deal of visible surface underneath it. */
    deck.position.y = -130;
    scene.add(deck);

    /* ---- light ---- */
    /* From the horizon, behind the craft. The aircraft is meant to read
       as a dark shape with its top edges caught — the same way the
       reference's vessel does — and that only happens with the key
       light coming from where the bright band is. */
    const key = new THREE.DirectionalLight(0xe8e6e3, 2.4);
    key.position.set(0.2, 0.35, -1).multiplyScalar(100);
    scene.add(key);
    scene.add(new THREE.AmbientLight(0x36332c, 1.5));

    /* ---- craft ---- */
    let craft: Craft = buildVtol();
    scene.add(craft);

    /* Dark, matte, and the SAME for every part of the model.

       The GLB arrives with 23 materials tuned for a lit product render;
       against a bright horizon they turn the silhouette into a patchwork
       of greys. One override material is what makes it read as a shape
       against the light. */
    const skin = new THREE.MeshStandardMaterial({ color: 0x131210, roughness: 0.62, metalness: 0.15 });
    const dress = (o: THREE.Object3D) => {
      o.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) m.material = skin;
      });
    };
    dress(craft);

    let disposed = false;
    /* NO QUARTER TURN, unlike the flight scene.

       That scene steers with lookAt, which points -Z at the target, so
       it needs the model yawed to put its nose there. Nothing here uses
       lookAt — the craft holds a fixed facing — so inheriting that turn
       just rotated it broadside, which is what it was doing.

       Rendered at all four quarter turns and looked: the two odd turns
       are the profile, and the two even ones are nose-on and tail-on.
       This is NOSE-ON — the craft facing the viewer.

       It was tail-on for a while, on the argument that a craft flying
       away agrees with a deck streaming toward the lens. That argument
       is real and this now contradicts it: the aircraft faces us while
       the water still runs at us, so it reads as holding station against
       the flow rather than travelling with it. Fine for a closing hero
       shot, and if it ever bothers anyone the fix is the deck rather
       than the craft — negate the flow rate at the uFlow line below.

       Worth keeping from the tail-on note: side-on, the rear read as a
       featureless slab and the nose was much the better half. From the
       raised camera that argument goes away — looking down, both show
       the top deck, the mast and all four rotors.

       Span 23 rather than the flight's 11: it is further away here and
       should still hold the frame the way the reference's vessel holds
       its own. */
    loadCraft('/models/mini.glb', { span: 23, rotate: [0, 0, 0] }).then((real) => {
      if (disposed || !real) return;
      scene.remove(craft);
      craft = real;
      dress(craft);
      scene.add(craft);
    });

    /* ---- distant traffic ---- */
    /* The reference has birds. Ours has other aircraft, far enough out
       to be specks — they exist to give the sky a sense of depth and
       scale, and for no other reason. */
    const speckN = 22;
    const speckPos = new Float32Array(speckN * 3);
    const speckSeed: number[] = [];
    for (let i = 0; i < speckN; i++) {
      /* Deterministic. Math.random would give a different sky on every
         render, and this file is server-rendered before it is hydrated. */
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12345.6789;
      const fa = a - Math.floor(a), fb = b - Math.floor(b);
      speckPos[i * 3] = (fa - 0.5) * 900;
      speckPos[i * 3 + 1] = 20 + fb * 190;
      speckPos[i * 3 + 2] = -300 - fa * 900;
      speckSeed.push(fb);
    }
    const speckGeo = new THREE.BufferGeometry();
    speckGeo.setAttribute('position', new THREE.BufferAttribute(speckPos, 3));
    const specks = new THREE.Points(
      speckGeo,
      new THREE.PointsMaterial({ color: 0x23211d, size: 3.2, sizeAttenuation: true })
    );
    scene.add(specks);

    /* ---- loop ---- */
    const clock = new THREE.Clock();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let flown = 0;
    let raf = 0;
    let inView = true;

    const io = new IntersectionObserver((e) => { inView = e[0].isIntersecting; }, { threshold: 0 });
    io.observe(wrap);

    /* How far back the rig sits, for this aspect.

       Vertical fov is fixed, so a narrow window does not crop the craft
       vertically — it crops it ACROSS, and this model is far wider than
       it is tall. Backing off on narrow screens is what keeps the rotor
       arms inside the frame on a phone. */
    let reach = CAM_Z;
    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      /* Clamped, because the correction is a reciprocal and a portrait
         phone sends it to 3.2x — which does keep the arms in frame, and
         leaves the craft a speck in an ocean. Two is the most that is
         ever worth backing off; past that the framing problem has become
         a composition problem. */
      reach = CAM_Z * Math.min(2, Math.max(1, 1.35 / Math.max(0.4, camera.aspect)));
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      /* The clock is read INSIDE the gate, so time does not accumulate
         while the section is off screen — otherwise the loop jumps by
         however long the reader spent elsewhere on the page. */
      if (!inView) return;
      const dt = Math.min(0.1, clock.getDelta());
      const t = clock.getElapsedTime();

      if (!reduced) flown += 46 * dt;
      deckMat.uniforms.uFlow.value = flown;

      /* The hold. Slow enough that nothing here reads as an animation
         playing — it should look like an aircraft holding its line in
         moving air. */
      const bob = Math.sin(t * 0.62) * 0.55 + Math.sin(t * 0.29) * 0.35;
      const drift = Math.sin(t * 0.24) * 1.1;
      craft.position.set(drift, CRAFT_Y + bob, 0);
      craft.rotation.z = -Math.sin(t * 0.24) * 0.055;
      /* THE FACING IS SET AT LOAD, not here.

         loadCraft already yaws the model a quarter turn, because its
         long axis is X and -Z is the direction three treats as forward,
         and the `rotate` argument above adds whatever else the shot
         needs. Anything added here lands on top of both — a pi at this
         line once came to 270 degrees and flew the craft broadside. So
         this is only the slow weave, centred on zero. */
      craft.rotation.y = Math.sin(t * 0.19) * 0.03;
      craft.rotation.x = 0.03 + Math.sin(t * 0.62) * 0.012;
      if (!reduced) spinRotors(craft, t);

      /* Behind and above, looking slightly down and past the craft. The
         downward tilt is what puts the horizon above centre, which is
         what leaves room for the deck to run out underneath it. */
      /* Height DERIVED from the depression angle, so "how far above the
         craft we are looking from" stays true if the distance changes —
         including when resize backs the rig off for a narrow screen. */
      const camY = CRAFT_Y + reach * Math.tan(DEPRESSION);
      camera.position.set(Math.sin(t * 0.12) * 1.4, camY + bob * 0.2, reach);
      /* Aim derived from the pitch rather than typed as a point, so the
         horizon's height in frame stays put if the rig is ever moved. */
      camera.lookAt(0, camY + Math.tan(PITCH) * (reach + 40), -40);

      sky.position.copy(camera.position);
      deckMat.uniforms.uCam.value.set(camera.position.x, camera.position.z);

      specks.rotation.y = t * 0.004;

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      io.disconnect();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      deck.geometry.dispose();
      deckMat.dispose();
      speckGeo.dispose();
      (specks.material as THREE.Material).dispose();
      skin.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default EnquiryScene;
