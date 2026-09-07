'use client';

/* ============================================================
   MiniViewer — where the Mini page stops being a film and becomes an
   object you can pick up.

   The field hero is a SCRUB: every frame of it is a function of scroll
   position, and the reader's only verb is "keep going". That is the right
   grammar for an argument and the wrong one for an inspection — at the end
   of it someone who wants to look at the underside of the aircraft has no
   way to ask. This is the answer: the page hands the model over.

   It replaces acts two, three and four rather than following them. See the
   note on MINI in product.ts for why the arrangement is declared there.

   HOW IT SITS ON THE PAGE, which is the part worth reading before moving
   anything. FieldHero's layers are all `position: fixed` — the timeline
   pins them while a tall spacer scrolls past underneath. Nothing that
   follows the hero can be in the same stacking conversation as those
   layers unless it beats them from outside, and the site footer already
   solves exactly this: it is normal-flow content at z-20 that scrolls up
   OVER the pinned hero. This section is the same trick, and it has to
   stay that way — give it `position: fixed` and it stops travelling with
   the document; drop the z-index and it renders behind a hero that has
   already finished.

   THE FADE IS ON THE STAGE, NOT THE SECTION, and that distinction is the
   whole crossfade. A background on the <section> would occlude the hero
   the instant the section's box entered the viewport, which is a cut. The
   section is transparent and the STAGE carries both the ground colour and
   the canvas, so ramping one opacity dissolves the hero's last frame into
   the viewer instead of replacing it.

   ONE rAF, NOT TWO. The fade could be a scroll listener and the render
   could be its own loop; they would then disagree by up to a frame and the
   canvas would fade in a step behind its own backdrop. Both are computed
   in the same callback off the same rect.
   ============================================================ */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useEffect, useRef, useState } from 'react';
import { loadCraft } from '@/components/flight/loadCraft';
import { ElasticRig } from './ElasticRig';
import { ViewerHotspots, type HotspotsHandle } from './ViewerHotspots';
import { ViewerList } from './ViewerList';
import type { ProductViewer } from './product';

/* The hero's ground, so the dissolve lands on the colour the last frame
   was already sitting on rather than stepping to a new one. */
const GROUND = '#090b07';

/* The shadow disc's own geometry size, and it is no longer the model's span
   — that moved into the data, so the component stops knowing which aircraft
   it renders. It stays a constant because the disc is rescaled from the
   model's real footprint at load anyway (see the shadow block in the
   loader), so this is only the size the plane is built at.

   DIST went with OrbitControls. The rig has no distance clamps: poses store
   a factor of the fitted framing and the elastic's own limit bounds how far
   a wheel gesture can carry it, which does the same job softly. */
const SPAN = 3.2;

/* The angle the aircraft is seen from, and it is a CONSTANT rather than a
   literal at the call site because the framing has to know it — see
   frameFor. Low: a steeper view throws the projected mass below the box
   centre it is framed around and the aircraft sits on the floor of its own
   picture. This still looks down enough to read the top deck. */
const VIEW = new THREE.Vector3(0.6, 0.17, 0.72).normalize();
const ELEV = Math.asin(VIEW.y);

/* Where the fade happens, as a fraction of the section's approach: 0 is
   the section's top entering at the bottom of the viewport, 1 is it
   reaching the top and the stage pinning.

   Weighted late on purpose. Fading evenly across the whole approach means
   the viewer is already half-visible while it is still sliding up from
   below, and the movement plus the fade read as two separate events. Held
   off until the stage is nearly in place, the dissolve happens where the
   stage is going to stay, which is what makes it a crossfade rather than
   an arrival. */
const FADE = [0.45, 0.98] as const;

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* A soft dark disc under the aircraft.

   Not a shadow map. A real one needs a light with a shadow camera tight
   enough to resolve a 3-unit object, plus a receiving plane, and it buys
   nothing here: there is no environment for the aircraft to cast onto and
   the viewer orbits, so a hard shadow edge would swing around underneath
   it and read as a second object. A radial gradient is what a contact
   shadow looks like from any angle, and it costs one 256px texture.

   Worth having at all because without it the model floats in a void, and a
   floating object reads as an asset rather than as a thing on a table. */
function contactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.16)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SPAN * 2.6, SPAN * 2.6),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      /* The disc is drawn on the ground colour, so it must darken it
         rather than composite as its own grey slab. */
      blending: THREE.NormalBlending,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -SPAN * 0.42;
  mesh.renderOrder = -1;
  return mesh;
}

/* MATERIAL CORRECTION, AND IT HAS TO HAPPEN ON CLONES.

   loadCraft hands out Object3D.clone(true): the node tree is duplicated but
   the material REFERENCES are kept on purpose, so the homepage's swarm does
   not pay for N copies (see markShared in loadCraft.ts). Mutating a material
   here would therefore silently retune the flight section as well. So every
   material this viewer touches is cloned once, keyed by uuid, and the clones
   are what get reassigned. Textures ride along by reference, so the three
   images in this export are NOT duplicated.

   WHAT IS ACTUALLY WRONG WITH THE EXPORT. glTF's default metallicFactor is
   1.0, and Blender's exporter omits the field when it equals that default —
   the opposite of Blender's own Principled BSDF default of 0. Two materials
   here omit it, 'Opaque(240,240,240)' and 'Steel - Satin', and between them
   they cover 47% of the airframe's 294,478 triangles. A metal has no diffuse
   term at all, so those surfaces were rendering as pure environment
   reflection: what you saw was the studio, not the aircraft. That is the
   blown, plasticky highlight. Turning the lights down would only have given
   a dimmer mirror.

   The tell is in the data: every material anyone deliberately authored
   writes metalness explicitly. Only the two CAD-imported appearances inherit
   it. This airframe is carbon fibre and plastic — none of it is bare metal.

   THAT WAS ONE OF TWO CAUSES, AND THIS FIX ONLY CLOSES THE FIRST. The note
   above used to end by saying turning the lights down would merely have
   given a dimmer mirror. True of the metalness bug, and it led to the
   opposite error: the lights went UP instead, and the render stayed washed
   out for a second and independent reason — see the exposure block below.
   Both had to be fixed. If this ever looks blown again, measure before
   reaching for either: the brightest pixels landing on several unrelated
   materials at once means the stack, and them landing on one material means
   the material. */
const MATERIAL_FIX: Record<string, (m: THREE.MeshPhysicalMaterial) => void> = {
  /* 26.2% of the model. Base colour is already near-black (0.09), so as a
     dielectric it becomes a matte composite shell with a low specular sheen
     instead of a black chrome one. */
  'Opaque(240,240,240)': (m) => {
    m.metalness = 0;
  },
  /* 20.8%. Named steel by the CAD package, but it is arm tubes and spine —
     composite, mis-tagged on import. Same correction, and the roughness goes
     up because a dielectric at 0.44 still reads wetter than moulded plastic. */
  'Steel - Satin': (m) => {
    m.metalness = 0;
    m.roughness = 0.6;
  },
  /* Clearcoat is a second specular lobe stacked on the first. At full
     strength over a pushed environment it is the other half of the blowout.
     Capped rather than removed: it is what makes woven carbon read as
     lacquered rather than chalky, and it stays above zero so three keeps the
     same USE_CLEARCOAT program and the cost does not move. */
  'Carbon Fibre': (m) => {
    m.clearcoat = Math.min(m.clearcoat, 0.4);
    m.clearcoatRoughness = Math.max(m.clearcoatRoughness, 0.25);
  },
  CAMO: (m) => {
    m.clearcoat = Math.min(m.clearcoat, 0.4);
    m.clearcoatRoughness = Math.max(m.clearcoatRoughness, 0.25);
  },
};

function correctMaterials(root: THREE.Object3D) {
  const swapped = new Map<string, THREE.Material>();
  const fix = (m: THREE.Material) => {
    const seen = swapped.get(m.uuid);
    if (seen) return seen;
    const c = m.clone();
    /* Material.copy DEEP-COPIES userData, so the clone inherits the shared
       flag loadCraft set on the template — and this component's cleanup
       skips disposing anything marked shared. Clearing it is what makes
       these clones collectable; without it they leak on every unmount. */
    c.userData.shared = false;
    MATERIAL_FIX[c.name]?.(c as THREE.MeshPhysicalMaterial);
    swapped.set(m.uuid, c);
    return c;
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(fix)
      : fix(mesh.material);
  });
}

export function MiniViewer({ name, viewer }: { name: string; viewer: ProductViewer }) {
  const sectionRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Drives the hint only. The fade and the camera never round-trip through
     React — they are per-frame values and setState at 60Hz would re-render
     the tree for something the DOM can be told directly. */
  /* idle -> the poster, and nothing downloaded. loading -> the click has
     happened and the model is on the wire. ready -> it is on screen.

     The whole point of the state is that NOTHING heavy exists in 'idle':
     no WebGLRenderer, no PMREM pass, no 2.5MB GLB. See the note on the
     second effect. */
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [grabbed, setGrabbed] = useState(false);

  /* Which feature is open, and it IS React state rather than a ref: unlike
     the camera and the fade, a selection changes what the tree renders —
     the lit dot, the label, the open row. It changes at the rate someone
     clicks, not at 60Hz. */
  const [selected, setSelected] = useState<number | null>(null);
  /* The dots are positioned from the render loop, so the loop needs a way
     to reach them that does not go through a re-render. */
  const hotspotsRef = useRef<HotspotsHandle>(null);
  /* The rig is built inside the viewer effect and read by the selection
     effect below. A ref rather than state because publishing it with
     setState would re-render the tree at the moment the model lands, for a
     value nothing renders. */
  const rigRef = useRef<ElasticRig | null>(null);

  /* The fade is computed by the first effect and consumed by the second.
     A ref rather than state because it changes every frame — see the note
     on the fade at the top of this file. */
  const fadeRef = useRef(0);
  /* The poster's own label, so the rare case of a WebGL context that
     refuses to build after the capability probe said yes can report itself
     without a setState inside an effect. */
  const labelRef = useRef<HTMLSpanElement>(null);
  /* The same flag the effect's closures read. State alone is invisible to
     them — they are created once and would capture `false` forever. */
  const grabbedRef = useRef(false);

  /* THE CROSSFADE, AND IT RUNS WHETHER OR NOT THE VIEWER HAS BEEN LOADED.

     This is the half that cannot be deferred. The section still has to
     dissolve the hero's last frame into the page ground on the way in —
     that is true of the poster exactly as it was of the model, and gating
     it behind the click would leave the hero showing through a viewer that
     had simply never been asked for.

     So the two loops are separate: this one owns the DOM (opacity, pointer
     arming) and always exists; the renderer's owns the canvas and only
     exists once someone has asked for it. They meet at fadeRef. */
  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const panel = panelRef.current;
    if (!section || !stage || !panel) return;

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);

      /* Where the section's top is, expressed as its approach to the top of
         the viewport. Read every frame rather than cached on scroll: the
         hero above is scrubbed and can change the document height, and a
         cached offset would then be measuring a page that no longer
         exists. */
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const approach = 1 - Math.min(1, Math.max(0, r.top / vh));
      const fade = smoothstep(FADE[0], FADE[1], approach);
      fadeRef.current = fade;

      stage.style.opacity = String(fade);
      /* Armed ON THE PANEL, not on the stage.

         Two things ride on this. The obvious one is the fade: a canvas that
         is still swallowing wheel events while invisible over the hero's
         last beat reads as the page refusing to scroll. It is also what
         stops the poster being clickable before it can be seen.

         The one that matters more now that the viewer is a box rather than
         the whole screen: everything OUTSIDE the panel has to keep
         scrolling the page normally. The wheel is overloaded here — inside
         the panel it means zoom, anywhere else it means scroll — and the
         only thing separating those two meanings is which element is under
         the pointer. Arming the stage would have made the whole viewport
         mean zoom, and left no way to scroll past a section that holds for
         two and a half viewports. */
      panel.style.pointerEvents = fade > 0.9 ? 'auto' : 'none';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* THE VIEWER ITSELF, built only once the reader has asked for it.

     Everything in here is expensive and none of it is needed to render the
     page: a WebGL context, a PMREM convolution of the studio environment,
     and a 2.5MB Draco-compressed GLB that then has to be decoded on the
     main thread. On a page whose hero is already 950vh of scrubbed image
     sequence, that is a lot to spend on a section most readers will scroll
     past without touching.

     Gating it on `status` rather than on visibility is deliberate. An
     IntersectionObserver would load it for everyone who scrolls that far,
     which is nearly everyone; a click is the only signal that actually
     means "I want to look at this". */
  useEffect(() => {
    if (status === 'idle') return;

    const section = sectionRef.current;
    const mount = mountRef.current;
    if (!section || !mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      /* No WebGL. The stage keeps its ground colour and the copy, which is
         a poorer page but not a broken one. */
      /* The click handler already probed for WebGL, so reaching here means
         a context that advertised itself and then refused to build. Written
         to the poster's label rather than pushed through state, which keeps
         a setState out of an effect body. */
      if (labelRef.current) labelRef.current.textContent = 'Model unavailable';
      return;
    }

    /* 1.5, NOT 2. This viewer draws the scene TWICE per frame — the lens
       carries KHR_materials_transmission, and three answers that by
       rendering the whole scene into a separate target to refract against
       (three.module.js renderTransmissionPass). At devicePixelRatio 2 the
       panel is ~2160x1136 with MSAA, then again for that pass. Dropping to
       1.5 removes ~44% of the fragment work and the blade edges still have
       enough samples to stay clean. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    /* The transmission target defaults to FULL viewport size in 0.182, with
       generateMipmaps on, so it rebuilds a mip chain every frame. Half
       resolution quarters that, and nothing downstream of a camera lens can
       resolve the difference. */
    renderer.transmissionResolutionScale = 0.5;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    /* NEUTRAL, AND THE 1.32 IT REPLACED WAS THE ANSWER TO A BAD MEASUREMENT.

       The note that used to sit here said the canvas "averaged RGB 1/255"
       at an exposure of 1.05, and concluded the subject needed more light.
       That average was taken over the WHOLE canvas — which is more than
       half transparent background, and background is exactly zero. It was
       measuring the empty space around the aircraft, so it could only ever
       say "too dark", and the exposure, the environment and both lights
       were all raised to answer it.

       Measured properly — over opaque geometry only, excluding the
       background and the contact shadow — the airframe was arriving at a
       mean luminance of 129 with 10.3% of its pixels above 200. That is a
       mid-grey object, and this one is meant to be matte black carbon over
       dark composite. The brightest pixels landed on four different
       materials at once, which is the tell that no single material was at
       fault and the whole stack was simply too hot.

       At these values the same measurement reads mean 67, p99 189, and
       0.2% above 200. */
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    /* The canvas is the control surface, so it has to take the pointer even
       though the stage above it is presentational. */
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    /* No opening position. The rig writes one on its first update() from the
       home pose, and the frames before the model lands are not drawn anyway
       — the tick returns early until the section is on screen. Seeding a
       guess here would only be a second answer to a question the data
       already answers. */

    /* IMAGE-BASED LIGHTING, and the model needs it rather than merely
       benefiting from it. This export carries clearcoat and transmission
       materials, and both are defined almost entirely by what they
       REFLECT — with punctual lights alone they resolve to near-black
       plastic. RoomEnvironment is three's own procedural studio, so this
       costs no download on a site that is a static export. */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    /* WELL UNDER UNITY, and this is the knob that was doing most of the
       damage. RoomEnvironment is a bright white studio box, and it lights
       every surface from every direction at once. Pushed past unity it
       floods a dark subject uniformly — which is what made the props and
       motor housings read as chalky white plastic rather than as dark parts
       catching a highlight, and what washed the colour out of the camo.

       It cannot go to zero: the clearcoat and the lens are defined almost
       entirely by what they reflect, and with punctual lights alone they
       resolve to near-black. This is enough to keep those alive while
       leaving the modelling to the key and the rim. */
    scene.environmentIntensity = 0.55;
    /* Not scene.background — the ground colour belongs to the stage
       underneath so the whole thing can fade as one. */

    /* A key on top of the environment, because IBL alone is flat: it lights
       every face about equally and the airframe loses its edges. */
    const key = new THREE.DirectionalLight(0xfff4e4, 2.0);
    key.position.set(-3.2, 4.4, 2.6);
    scene.add(key);
    /* Cool, opposite the key. Against a near-black ground the silhouette is
       only legible where something is catching an edge, so this stays
       comparatively strong RELATIVE TO THE KEY — the 0.6 ratio between them
       is what was worth preserving when the absolute levels came down. */
    const rim = new THREE.DirectionalLight(0xbcc6d4, 1.2);
    rim.position.set(2.8, 1.2, -3.4);
    scene.add(rim);

    const shadow = contactShadow();
    shadow.visible = false; // placed once the model's real box is known
    scene.add(shadow);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* THE RIG, AND WHAT IT REVERSED.

       The old note here said the drift was an invitation rather than an
       animation, and that once someone took hold of the model it was theirs
       and the rotation never came back on. That was right when a drag could
       leave the aircraft anywhere and keeping it there was the only way to
       respect the choice. Under the elastic there is no view to keep — every
       gesture springs back — so a drift that stopped forever would just
       leave a dead object after the first touch. It resumes.

       Home is today's VIEW vector in spherical, carried in from the data.
       VIEW itself stays because frameFor reads ELEV off it: the
       projected-height correction depends on the elevation the aircraft is
       seen from, and the two must not be able to disagree. */
    const rig = new ElasticRig({
      camera,
      dom: renderer.domElement,
      home: viewer.home,
      reduced,
      onGrab: () => {
        grabbedRef.current = true;
        setGrabbed(true);
      },
    });

    rigRef.current = rig;

    /* THE PICKER, and it is how the numbers in product.ts were authored.

       Dynamically imported behind a NODE_ENV check so the condition folds
       to a literal at build time and the module never enters the static
       export — verified by grepping out/ for its log string. */
    let detachPicker: (() => void) | undefined;
    if (process.env.NODE_ENV === 'development') {
      void import('./pickAnchor').then((m) => {
        detachPicker = m.attachPicker({ dom: renderer.domElement, camera, scene, rig });
      });
    }

    let craft: THREE.Object3D | null = null;
    let alive = true;
    loadCraft(viewer.model, { span: viewer.span }).then((c) => {
      /* The section can unmount while a 2.5MB model is in flight. */
      if (!alive) return;
      if (!c) {
        if (labelRef.current) labelRef.current.textContent = 'Model unavailable';
        return;
      }
      craft = c;
      correctMaterials(c);
      scene.add(c);
      /* Asynchronous, so this is not a render cascade at mount — it is the
         model arriving some time after a click. Retiring the poster here
         rather than on the click itself means the frame never shows an
         empty stage between the two. */
      setStatus('ready');

      /* RE-CENTRED AND RE-FRAMED HERE, from the model's real world box,
         rather than trusting the span that was asked for.

         loadCraft normalises by setting position to -centre and THEN
         scaling, and those two do not commute: a child at local p ends up
         at s*p - centre, so the box centre lands at centre*(s-1) instead of
         at the origin. With this export (centre near (0, 1.0, 1.4), s about
         0.08) that is roughly a unit low and a unit back — which on the
         homepage is absorbed by the flight path and is invisible, and here
         put the aircraft near the bottom edge and off the orbit axis. It is
         left alone rather than fixed in place because the flight beats are
         framed against its current behaviour; this is the one caller that
         needs the model exactly on the origin.

         Framing is solved the same way, for the same reason: SPAN is a
         request, and what matters is what actually arrived. Fitting the
         real radius to the real fov means a different export reframes
         itself instead of turning up cropped or tiny. */
      const box = new THREE.Box3().setFromObject(c);
      c.position.sub(box.getCenter(new THREE.Vector3()));

      const size = box.getSize(new THREE.Vector3());

      /* FITTED TO THE BOX, NOT TO A SPHERE AROUND IT.

         The first version divided the bounding RADIUS by sin(fov/2), which
         is the standard fit-a-sphere formula and is badly wrong for this
         shape. A quadcopter is wide, deep and almost flat — roughly
         3.2 x 2 x 0.6 here — so its bounding sphere is over five times its
         own height. Framing that sphere put the camera far enough back
         that the aircraft filled 31% of the width and 24% of the height,
         and read as a thumbnail in a large black field.

         The two axes are constrained differently and the binding one wins:
         height against the vertical fov, width against the horizontal fov,
         which is the vertical one scaled by the aspect. Deriving it this
         way also makes a portrait phone pull back on its own, since the
         aspect falls below 1 and the horizontal term grows.

         X OR Z, WHICHEVER IS LARGER, because the camera orbits: the axis
         facing the lens swaps as it goes round, and fitting only to the
         one that happens to face it at load would crop the aircraft
         halfway through the first drag. */
      const fit = frameFor(size);

      modelSize = size;
      /* The rig holds poses as factors of this, so handing it the fit is
         the whole of "frame the model" — nothing sets a camera position
         here any more. */
      rig.setFit(fit);

      /* The disc goes on the aircraft's own underside, and takes its width
         from the footprint rather than from SPAN. */
      const foot = Math.max(size.x, size.z);
      shadow.scale.setScalar((foot * 1.9) / (SPAN * 2.6));
      shadow.position.y = -size.y * 0.5 - foot * 0.06;
      shadow.visible = true;
    });

    /* The distance that frames a box of this size at the CURRENT aspect.
       Hoisted out of the load handler because resizing has to be able to
       ask the same question again — see the note in resize(). */
    const frameFor = (size: THREE.Vector3) => {
      const tanV = Math.tan(((camera.fov * Math.PI) / 180) / 2);
      /* X OR Z, WHICHEVER IS LARGER, because the camera orbits: the axis
         facing the lens swaps as it goes round, and fitting only to the one
         that happens to face it at load would crop the aircraft halfway
         through the first drag. */
      const horiz = Math.max(size.x, size.z);

      /* PROJECTED HEIGHT, NOT BOX HEIGHT — the correction that stopped this
         cropping the moment the viewer stopped being fullscreen.

         Fitting size.y treats the aircraft as if it were seen exactly
         edge-on. It is not: from ELEV above, a flat wide object lays its
         own footprint into the vertical, and the silhouette stands

             size.y * cos(ELEV) + horiz * sin(ELEV)

         tall. For this airframe — roughly 0.6 deep against 3.2 across —
         that is about 1.16 against a box height of 0.6, so the real
         silhouette is nearly twice what the old formula was framing.

         Fullscreen hid it. A 16:9 stage is limited by its WIDTH, so the
         horizontal term won and the wrong vertical term was never the
         binding one. Boxing the viewer into a panel three times wider than
         it is tall handed the constraint to the vertical, and the error
         surfaced immediately: the aircraft filled 83% of the panel height
         and was clipped along the bottom edge. */
      const projH = size.y * Math.cos(ELEV) + horiz * Math.sin(ELEV);
      return (
        Math.max(projH / (2 * tanV), horiz / (2 * tanV * camera.aspect)) *
        /* Margin, so the aircraft is a subject in a frame rather than a
           thing jammed against the edges. It is breathing room only — the
           projection is accounted for above rather than absorbed here,
           which is what lets one number hold across panel shapes. */
        1.4
      );
    };

    /* The model's world size once it has landed, so a resize can re-solve
       the framing. Null until then. */
    let modelSize: THREE.Vector3 | null = null;

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      /* RE-FRAME ON RESIZE, UNCONDITIONALLY NOW.

         The fit is solved against the aspect ratio, so a window that gets
         narrower or shorter after load invalidates it — and because the
         vertical fov is fixed, a shorter window crops rather than scales.
         Verified by shrinking the window after load: the aircraft went
         from filling 69% of the frame height to 100% of it, clipped top
         and bottom.

         THE `grabbed` GATE IS GONE WITH THE REASON FOR IT. It existed
         because the reader's chosen distance was theirs to keep, and
         yanking the camera back to a computed framing because they
         happened to drag the window edge would have thrown away the view
         they had chosen. Under the rig there is no chosen distance to
         lose — every framing springs back to a rest pose anyway — so
         re-solving the fit is always the right answer. */
      if (!modelSize) return;
      rig.setFit(frameFor(modelSize));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    /* CLOCKED ABOVE THE EARLY RETURN, and that placement is the point. The
       rig integrates against real elapsed time, so the frame that resumes
       after the viewer has been scrolled past would otherwise hand it the
       whole absence as one dt. The rig clamps to MAX_DT and would survive
       it, but it would still arrive as a visible jump; advancing the stamp
       every frame means it never sees one. */
    let lastFrame = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);

      const now = performance.now();
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;

      /* Skip the draw when there is nothing to see. The fade is READ from
         the DOM loop above rather than recomputed here, so the two can
         never disagree about whether this frame is visible. */
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      if (fadeRef.current <= 0.001 || r.bottom <= 0 || r.top >= vh) return;

      rig.update(dt);
      /* AFTER the rig and BEFORE the draw. The dots are projected through
         the camera, so syncing them before rig.update would place them
         against last frame's camera and they would lag the model by one
         frame — which on a drifting object reads as the dots sliding. */
      hotspotsRef.current?.sync(camera, rig.settled());
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      rig.dispose();
      rigRef.current = null;
      detachPicker?.();

      if (craft) scene.remove(craft);
      shadow.geometry.dispose();
      (shadow.material as THREE.MeshBasicMaterial).map?.dispose();
      (shadow.material as THREE.Material).dispose();
      env.texture.dispose();
      pmrem.dispose();

      /* The model's buffers are SHARED — loadCraft hands out clones of one
         parsed template and marks them, so disposing them here would empty
         the geometry out from under any other page that has it cached.
         Same rule FlightScene follows on the homepage. */
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (!m.geometry?.userData.shared) m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => !x.userData.shared && x.dispose());
        else if (mat && !mat.userData.shared) mat.dispose();
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    /* `viewer` MUST BE A STABLE REFERENCE, and every caller passes one
       straight off a module constant in product.ts. It is a real dependency
       — the effect reads the model URL, the span and the home pose out of
       it — so it is declared rather than silenced. But this effect owns a
       WebGL context and a 2.5MB decode, and an inline object literal at the
       call site would tear both down and rebuild them on every render of
       the parent. If that ever happens, the fix is to hoist the literal,
       not to drop the dependency. */
  }, [status, viewer]);

  /* SELECTION -> CAMERA, AND THIS IS THE WHOLE OF THE "FLIGHT".

     There is no tween here because there is no tween anywhere: changing the
     rest pose and the pivot IS the flight, and the same spring that snaps a
     drag back carries the camera over. A far-side hotspot therefore takes
     longer to reach than a neighbouring one for free, and grabbing the
     model halfway through simply works.

     The pivot moving is the half that matters. Orbiting the model's centre
     while reading about the nose camera would swing the part being
     described across the frame; orbiting the part itself keeps it roughly
     pinned and turns the aircraft behind it. */
  useEffect(() => {
    const rig = rigRef.current;
    /* Not built yet — the viewer effect only constructs one once the reader
       has asked for the model. The `status` dependency below is what
       replays this against the rig that eventually exists. */
    if (!rig) return;
    if (selected === null) {
      rig.select(null, null);
      return;
    }
    const h = viewer.hotspots[selected];
    if (!h) return;
    rig.select(h.pose, h.anchor);
  }, [selected, viewer.hotspots, status]);

  /* ARROWS STEP, ESCAPE RELEASES.

     Bound to the SECTION rather than the window, and that is a deliberate
     limit rather than an oversight: this page is a scroll narrative and the
     arrow keys scroll it. A viewer that swallowed them for the whole
     document would break keyboard scrolling everywhere above and below
     itself to serve a control most readers will never reach for.

     Because the listener is on the section, it only fires once something
     inside has focus — a dot or a row. That is the correct gate: the keys
     mean "next feature" exactly when the features are what you are
     operating, and mean "scroll" the rest of the time. */
  useEffect(() => {
    if (status !== 'ready') return;
    const el = sectionRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      const n = viewer.hotspots.length;
      if (!n) return;
      if (e.key === 'Escape') {
        setSelected(null);
        return;
      }
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      /* Only once we know we are handling it — an unhandled key must still
         reach the page. */
      e.preventDefault();
      setSelected((s) => {
        const from = s ?? (dir === 1 ? -1 : 0);
        return (from + dir + n) % n;
      });
    };

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [status, viewer.hotspots.length]);

  return (
    <section
      ref={sectionRef}
      /* z-20 to clear the hero's fixed layers, and NO background — see the
         note on the fade at the top of this file.

         The height is the scroll budget: one viewport to dissolve in and
         rather more to hold still while the model is being turned over. It
         is deliberately generous, because the sticky stage stops being
         pinned the moment this box runs out and the aircraft would be
         yanked away mid-drag. */
      className="relative z-20 h-[240vh]"
      aria-label={`${name} — interactive model`}
    >
      {/* The stage still fills the viewport and still carries the ground
          colour, because BOTH are what the crossfade needs — the dissolve
          works by ramping one opaque, viewport-sized layer over the hero's
          last frame. Only the VIEWER inside it is boxed. Shrinking the
          stage to the size of the panel would leave the hero visible around
          the edges throughout the fade, which is a different effect and a
          worse one. */}
      <div
        ref={stageRef}
        className="pointer-events-none sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden"
        style={{ background: GROUND, opacity: 0 }}
      >
        {/* Captioned figure, not an overlay. With the model in a box the
            label and the hint no longer have viewport corners to sit in,
            and floating them there would leave them stranded a long way
            from the thing they describe. Above and below the frame they
            read as its caption. */}
        {/* ONE WIDTH EXPRESSION, SHARED BY THE PANEL AND ITS CAPTION, and
            it is solved against the HEIGHT as well as the width.

            The panel was sized by an independent width cap and height cap,
            which lets the window's shape set the panel's: on a short
            viewport the height cap bound first and the frame stretched to
            3.25:1, a letterbox slot with the aircraft marooned in the
            middle of it. Deriving the width from whichever of the three
            limits binds — the px ceiling, the viewport width, or the
            viewport height times the aspect — keeps the frame the same
            shape on every screen and simply makes it smaller when there is
            less room.

            The caption row and the hint share the expression so their ends
            line up with the frame's rather than with some wider box. */}
        <div className="w-[min(1080px,86vw,calc(58vh*1.9))] text-[#f2ecd9]">
          <div className="mb-[clamp(8px,1.5vh,18px)] flex items-baseline justify-between gap-4">
            <p className="font-display text-[clamp(11px,0.95vw,18px)] font-bold uppercase tracking-[0.02em] opacity-70">
              {name}
            </p>
            {/* Was "Turn it over", which the elastic rig made false — the
                aircraft cannot be turned over any more, only leaned around
                and released. This points at the list instead, which is now
                the control that actually gets the reader somewhere, and
                says how many there are so the row of dots reads as a set
                rather than as decoration. */}
            <p className="font-display text-[clamp(9px,0.75vw,13px)] uppercase tracking-[0.18em] opacity-40">
              Four points
            </p>
          </div>

          {/* THE LIST'S POSITIONING CONTEXT, and it exists so that one word
              — `inset-y-0` — means the right thing.

              The list is absolutely positioned to the render's right-hand
              edge, so it needs an ancestor whose box IS the render's box.
              The width wrapper outside is the wrong one: it also holds the
              caption row and the hint, so the list would have stretched to
              span all three and centred itself against the wrong height.

              On wide screens this box is exactly the panel, because the
              panel is its only in-flow child. Below `sm` the list returns
              to normal flow and this grows to hold both. */}
          <div className="relative">
            {/* THE VIEWER. Its aspect is fixed and its width comes from the
                parent, so the two can never disagree — see the note above. */}
            <div
              ref={panelRef}
              className="relative aspect-[1.9] w-full"
              style={{ pointerEvents: 'none' }}
            >
            <div ref={mountRef} className="absolute inset-0" />

            {/* Only once there is a model to stick them to. Mounted before
                that they would project against a camera that has not been
                framed yet and cluster at the centre of an empty panel. */}
            {status === 'ready' && (
              <ViewerHotspots
                ref={hotspotsRef}
                hotspots={viewer.hotspots}
                selected={selected}
                onSelect={setSelected}
              />
            )}

            {/* THE POSTER'S PICTURE — the sequence's own last frame, which
                is the aircraft head on.

                Chosen rather than rendered: showing the real thing before
                the click is what makes the 2.5MB an informed decision
                instead of a gamble on what is behind the button. It is the
                same aircraft in the same livery the viewer loads, so the
                click reads as getting closer to something rather than
                swapping it for something else.

                Cropped to the panel's own 1.9 aspect and sized so the
                subject spans about 62% of it — cover on a box that already
                matches would still crop on a hair's difference in layout.

                It fades rather than unmounting: the model arrives on a
                frame of its own choosing, and a poster that vanishes leaves
                the ground colour showing for however long that takes. */}
            {/* Plain <img>: static export, decorative, and already sized to
                the box it fills — the optimiser has nothing to add. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mini-viewer-poster.webp"
              alt=""
              aria-hidden="true"
              decoding="async"
              className={
                'pointer-events-none absolute inset-0 size-full object-contain ' +
                'transition-opacity duration-700 ' +
                (status === 'ready' ? 'opacity-0' : 'opacity-100')
              }
            />

            {/* THE POSTER, and it is a real <button>.

                It could have been a div with an onClick — it is the only
                thing in the frame and the frame is obviously the target.
                But this is the control that decides whether the page
                downloads two and a half megabytes, and a keyboard or a
                screen reader has as much right to that decision as a mouse
                does. A button gets focus, Enter and Space, and announces
                itself, for no styling cost.

                Kept mounted through 'loading' so the frame is never empty
                between the click and the model landing — it just changes
                what it says. It goes when the aircraft arrives. */}
            {status !== 'ready' && (
              <button
                type="button"
                disabled={status === 'loading'}
                onClick={() => {
                  /* PROBED HERE, IN THE EVENT HANDLER, and that placement is
                     the point. Asking during render would be a side effect
                     and would disagree with the server, which cannot know
                     the answer; asking inside the effect would put a
                     setState in an effect body. In a click handler it is
                     just a question asked at the moment it matters. */
                  let ok = false;
                  try {
                    const probe = document.createElement('canvas');
                    ok = !!(probe.getContext('webgl2') || probe.getContext('webgl'));
                  } catch {
                    ok = false;
                  }
                  if (!ok) {
                    if (labelRef.current) {
                      labelRef.current.textContent = 'WebGL unavailable';
                    }
                    return;
                  }
                  setStatus('loading');
                }}
                className={
                  'group absolute inset-0 flex flex-col items-center justify-center ' +
                  'gap-[clamp(7px,1.2vh,13px)] text-[#f2ecd9] ' +
                  'transition-opacity duration-500 ' +
                  (status === 'loading' ? 'cursor-default opacity-60' : 'cursor-pointer')
                }
              >
                <span
                  aria-hidden
                  className={
                    'flex size-[clamp(38px,4vw,56px)] items-center justify-center rounded-full ' +
                    'border text-[clamp(13px,1.3vw,18px)] leading-none ' +
                    'transition-colors duration-300 ' +
                    (status === 'loading'
                      ? 'border-[rgba(242,236,217,0.22)]'
                      : 'border-[rgba(242,236,217,0.28)] group-hover:border-[rgba(242,236,217,0.65)]')
                  }
                >
                  {status === 'loading' ? '·' : '↻'}
                </span>

                <span
                  ref={labelRef}
                  className="font-display text-[clamp(11px,0.95vw,15px)] font-bold uppercase tracking-[0.16em]"
                >
                  {status === 'loading' ? 'Loading' : 'View in 3D'}
                </span>

                {/* The size is stated because the click is a decision to
                    spend it, and a reader on a metered connection is
                    entitled to know the price before paying it. */}
                <span className="font-display text-[clamp(9px,0.72vw,12px)] uppercase tracking-[0.16em] opacity-40">
                  2.5 MB
                </span>
              </button>
            )}

            {/* A hairline, drawn as an outline so it sits OUTSIDE the box
                and never covers a pixel the renderer drew — the same
                argument as the gallery's gate in Field.module.css. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ outline: '1px solid rgba(242,236,217,0.14)', outlineOffset: '-1px' }}
            />
            </div>

            {/* OUTSIDE the panel, inside its positioning context. Kept out
                of the panel because the panel's pointer-events are armed
                and disarmed by the fade loop, and the list must not inherit
                that — it only exists once the model is loaded, which is
                already long past the point where the fade has finished. */}
            {status === 'ready' && (
              <ViewerList
                hotspots={viewer.hotspots}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </div>

          {/* Only once there is something to drag. Before that the poster
              carries the instruction, and two competing ones would be one
              too many.

              ONE STRING FOR BOTH STATES, RATHER THAN TWO. The old hint,
              "Drag to rotate · scroll to zoom", named two gestures that no
              longer do what they said: both now spring back. This names
              what actually happens, and it stays true whether or not a
              feature is selected — which is what lets it keep its single
              fade instead of needing to cross-fade between two messages
              every time the reader picks a row. */}
          <p
            className={
              'mt-[clamp(8px,1.5vh,18px)] text-center font-display ' +
              'text-[clamp(10px,0.85vw,14px)] uppercase tracking-[0.18em] ' +
              'transition-opacity duration-700 ' +
              (status === 'ready' && !grabbed ? 'opacity-55' : 'opacity-0')
            }
            aria-hidden={status !== 'ready'}
          >
            Drag to look &middot; release to settle
          </p>
        </div>
      </div>
    </section>
  );
}

export default MiniViewer;
