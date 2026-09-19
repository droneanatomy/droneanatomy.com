/* ============================================================
   loadCraft — bring a real GLB in, and normalise it.

   A CAD export knows nothing about our conventions: its origin is
   wherever the modeller's world zero happened to be, its scale is
   whatever units the assembly used, and its orientation depends on the
   exporter's axis settings. Rather than demand the artist get all three
   exactly right — which fails silently and is discovered as "the drone is
   3000 units wide and off-screen" — this measures the model and fits it.

   What it does NOT fix is topology. If the mesh arrives at 500k triangles
   in 213 draw calls, that is what renders. Normalising is free; decimating
   is not, and doing it at runtime would cost more than it saved.

   Falls back to the procedural placeholder if the file is missing or
   fails to parse, so a broken asset degrades to a working scene rather
   than an empty sky.

   PARSED ONCE, HANDED OUT MANY TIMES. Two sections fly this model — the
   flight beats and the enquiry deck — and each used to build its own
   GLTFLoader, so the file was fetched twice and, worse, Draco-decoded
   twice: 294k triangles unpacked on the main thread for a model that was
   already in memory. Measured on the homepage, that was 2.1 MB of the
   4.9 MB the page transferred, downloaded a second time 900ms after the
   first.

   The cache holds the PROMISE rather than the result, so a second caller
   arriving mid-flight waits on the first request instead of starting its
   own — which is the case that actually happens here, since both sections
   mount within a few hundred milliseconds of each other.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Craft } from './craft';

export type LoadOptions = {
  /* Fitted span across X, in world units. The scene's camera legs are
     framed against this, so it is the number that keeps a swapped model
     the same size on screen as the one before it. */
  span: number;
  /* Extra rotation, radians, applied after the fit. Use when the export
     came out nose-first along the wrong axis — measuring cannot tell a
     nose from a tail. */
  rotate?: [number, number, number];
  /* WHICH BLADES ACTUALLY TURN, and about what.

     Omit this and every blade-material mesh becomes a rotor, binned into
     the four quadrants of a quadcopter and spun about the vertical. That
     is right for a multirotor and wrong for anything else: a fixed-wing
     VTOL in cruise has its lift rotors STOPPED and only its pusher
     turning, and the quadrant binning would scatter one propeller's
     blades across two hubs anyway. */
  rotors?: {
    /* Keep only blades whose centre satisfies this. The vector is in the
       model's OWN coordinates — the same numbers a bbox dump of the file
       reports — not world space, so a predicate written against measured
       values stays true whatever `rotate` and `span` do. */
    pick?: (centre: THREE.Vector3) => boolean;
    /* Treat everything kept as ONE propeller on a single hub, rather than
       binning by quadrant. */
    single?: boolean;
    /* World axis the hub turns about: 'y' for a lift rotor lying flat,
       'x' for a tractor or pusher facing down the fuselage. */
    axis?: 'x' | 'y';
    /* NAMED GROUPS, for an aircraft whose propellers do different jobs.
       The Cyclops has four lift rotors and a pusher, and /fly drives them
       at different rates through a transition — the lift rotors spooling
       down as the pusher spools up. Each entry is picked and binned
       exactly as the flat form above is.

       ADDITIVE. With no `groups`, this behaves precisely as it did, which
       is what FlightScene depends on: the homepage spins the pusher only
       and must go on doing that. */
    groups?: Record<string, { pick?: (centre: THREE.Vector3) => boolean; single?: boolean; axis?: 'x' | 'y' }>;
  };
};

/* Keyed by URL, holding the promise so concurrent callers share one
   request. Module-level and never evicted, exactly like the DRACOLoader
   below: both live as long as the page does, and the page has one model.

   The value is the RAW scene, never normalised — normalise() mutates the
   transform it is given, and the two call sites want different spans and
   different rotations, so the template has to stay untouched. */
const templates = new Map<string, Promise<THREE.Object3D>>();

let draco: DRACOLoader | null = null;

/* Exported so other scenes can load a GLB without repeating the DRACO
   wiring — the decoder is a module-level singleton and preloading it twice
   would fetch the wasm twice. */
export const gltfLoader = () => {
  const l = new GLTFLoader();
  if (!draco) {
    draco = new DRACOLoader();
    /* Served from public/draco, copied out of three's own package rather
       than pulled from a CDN — this site is a static export and should
       not depend on someone else's uptime to show its hero. */
    draco.setDecoderPath('/draco/');
    draco.preload();
  }
  l.setDRACOLoader(draco);
  return l;
};

/* Measure, centre, scale, orient. */
function normalise(root: THREE.Object3D, opts: LoadOptions) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());

  /* Re-centre on the bounding box rather than trusting the file's origin.
     This model's centre sits at (0, 1.0, 1.4) — small, but enough that
     the craft would orbit slightly off-axis when it banks. */
  root.position.sub(centre);

  const widest = Math.max(size.x, size.y, size.z) || 1;
  const s = opts.span / widest;
  root.scale.setScalar(s);

  if (opts.rotate) root.rotation.set(...opts.rotate);

  return { size, centre, scale: s };
}

/* Rotors, by name first and by MATERIAL as a fallback.

   The name convention is documented for the artist and is still tried
   first, because an export that follows it already has the right pivots.
   mini.glb does not follow it: its eight blades are called Body1.048
   through Body1.055, so this used to return nothing and the aircraft flew
   with dead rotors — which the old note here predicted and accepted.
   (That file was called vtol.glb when this was written; it is the Mini,
   and was renamed once the real VTOL arrived and needed the name.)

   THE BLADES ALSO HAVE NO HUBS. They are eight separate meshes with no
   shared parent to turn, so the pivots have to be built. They are grouped
   into four by the quadrant their centre falls in — measured, since the
   rotors sit at about (+/-7.65, +/-5.76) in model space — and a pivot is
   placed at each pair's midpoint.

   THE PIVOT IS TILTED -90 DEGREES ABOUT X on purpose. spinRotors turns
   whatever it is given about that object's own Z, and this model's up is
   +Y. With Euler order XYZ the composed rotation is Rx*Ry*Rz, so the spin
   applies first and the tilt then carries its axis onto +Y — which is the
   axis a rotor actually turns about. Without it the blades would cartwheel
   nose-over-tail.

   attach(), not add(): it preserves each blade's world transform while
   reparenting, so nothing shifts at the moment the hubs appear.

   CALLED MORE THAN ONCE PER ROOT when the caller uses `groups`: once for
   the flat `pick` and once per named group, so that `userData.rotors` and
   `userData.rotorGroups` both exist. That is dangerous by construction —
   this function REPARENTS blades into hubs it creates, so a naive second
   call would traverse a tree where the blades it wants are no longer
   direct children of `root` but of the FIRST call's hubs, and a
   quadrant-agnostic pick (or none at all) could also merge two physically
   different propellers into one hub before the group calls ever get a
   chance to tell them apart.

   The fix is to gather the candidate blades and their measured centres
   EXACTLY ONCE per root — before any hub exists — and cache that list
   against the root object. Every call after the first, flat or grouped,
   reads from that frozen list rather than re-traversing a tree that its
   own previous call (or a sibling group's) has been rearranging. The
   cache is a WeakMap keyed by `root`, which is a fresh clone per
   `loadCraft()` call, so it never leaks across craft or outlives the
   root it was built for. */
const rotorCandidates = new WeakMap<THREE.Object3D, { named: THREE.Object3D[]; blades: BladeCandidate[] }>();

type BladeCandidate = { mesh: THREE.Mesh; centre: THREE.Vector3 };

function collectRotorCandidates(root: THREE.Object3D) {
  const named: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (/^rotor/i.test(o.name) || /^prop/i.test(o.name)) named.push(o);
  });

  const blades: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material | THREE.Material[];
    const isBlade = Array.isArray(mat)
      ? mat.some((x) => /blade/i.test(x.name))
      : !!mat && /blade/i.test(mat.name);
    if (isBlade) blades.push(m);
  });

  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();
  const measured: BladeCandidate[] = blades.map((mesh) => {
    box.setFromObject(mesh);
    box.getCenter(centre);
    root.worldToLocal(centre);
    return { mesh, centre: centre.clone() };
  });

  return { named, blades: measured };
}

const findRotors = (root: THREE.Object3D, opts: LoadOptions['rotors']) => {
  let candidates = rotorCandidates.get(root);
  if (!candidates) {
    candidates = collectRotorCandidates(root);
    rotorCandidates.set(root, candidates);
  }

  if (candidates.named.length) return candidates.named;
  if (!candidates.blades.length) return [];

  const bins = new Map<string, { sum: THREE.Vector3; n: number; parts: THREE.Mesh[] }>();
  for (const { mesh, centre } of candidates.blades) {
    if (opts?.pick && !opts.pick(centre.clone())) continue;
    /* One key for everything when the caller says these are one
       propeller — the quadrant split exists to separate a quad's four
       rotors, and applied to a single prop it would saw it in half along
       z and spin the halves opposite ways. */
    const key = opts?.single
      ? 'ONE'
      : `${centre.x >= 0 ? 'R' : 'L'}${centre.z >= 0 ? 'F' : 'B'}`;
    const bin = bins.get(key) ?? { sum: new THREE.Vector3(), n: 0, parts: [] };
    bin.sum.add(centre);
    bin.n += 1;
    bin.parts.push(mesh);
    bins.set(key, bin);
  }

  /* Diagonals first, so spinRotors' alternating direction gives a real
     quad's counter-rotating pairs rather than whatever order a Map
     happened to fill. */
  const order = opts?.single ? ['ONE'] : ['RF', 'LB', 'LF', 'RB'];
  const hubs: THREE.Object3D[] = [];
  for (const key of order) {
    const bin = bins.get(key);
    if (!bin) continue;
    const hub = new THREE.Object3D();
    hub.position.copy(bin.sum.divideScalar(bin.n));
    /* spinRotors turns a hub about its LOCAL z, so the hub is rotated to
       put that axis where the propeller's thrust goes: -90 about x lays
       local z onto world +y for a lift rotor, +90 about y lays it onto
       world +x for one facing down the fuselage. */
    if (opts?.axis === 'x') hub.rotation.y = Math.PI / 2;
    else hub.rotation.x = -Math.PI / 2;
    root.add(hub);
    hub.updateMatrixWorld(true);
    bin.parts.forEach((b) => hub.attach(b));
    hubs.push(hub);
  }
  return hubs;
};

/* Marks a template's geometries and materials as shared, so a scene
   tearing itself down knows not to dispose them out from under the other
   scene still drawing them. See the note in FlightScene's cleanup.

   Necessary because the two consumers dispose differently: the enquiry
   scene frees its own objects by name and never touches the craft, while
   the flight scene traverses everything it holds. Before the cache that
   asymmetry was harmless — each had its own copy. */
function markShared(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.geometry) m.geometry.userData.shared = true;
    const mat = m.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat)) mat.forEach((x) => { x.userData.shared = true; });
    else if (mat) mat.userData.shared = true;
  });
}

export async function loadCraft(url: string, opts: LoadOptions): Promise<Craft | null> {
  try {
    let template = templates.get(url);
    if (!template) {
      template = gltfLoader()
        .loadAsync(url)
        .then((gltf) => {
          markShared(gltf.scene);
          return gltf.scene as THREE.Object3D;
        });
      /* Cached before the await, so a caller arriving while this is still
         in flight joins it rather than starting a second request. A
         failure is evicted below so a transient error is retried rather
         than remembered forever. */
      templates.set(url, template);
    }

    const root = (await template).clone(true);

    /* clone(), NOT a deep copy. Object3D.clone duplicates the node tree
       but keeps the geometry and material REFERENCES, which is the point:
       the two craft are independent objects that can sit in different
       scenes with different transforms while pointing at one set of vertex
       buffers. A deep copy would undo most of what the cache just saved.

       (The GPU still uploads per renderer — these are two WebGL contexts,
       and a buffer cannot cross one. What is shared is the fetch, the
       Draco decode, and the CPU-side arrays.) */

    /* Wrap rather than transform in place. normalise() moves the model to
       centre it, and the wrapper is what the scene then positions — so the
       craft's own transform stays free for heading and bank without the
       centring offset fighting it. */
    const holder = new THREE.Group();
    normalise(root, opts);
    holder.add(root);

    holder.userData.rotors = findRotors(root, opts.rotors);
    holder.userData.rotorGroups = {};
    for (const [name, g] of Object.entries(opts.rotors?.groups ?? {})) {
      holder.userData.rotorGroups[name] = findRotors(root, g);
    }
    holder.userData.label = 'vtol';
    return holder as Craft;
  } catch {
    templates.delete(url);
    return null;
  }
}

/* What the loader measured, for reporting in dev. Cheap enough to always
   compute and far easier than opening the file to find out why a model
   came in the wrong size. */
export function describe(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const s = box.getSize(new THREE.Vector3());
  let tris = 0, draws = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    draws++;
    const g = m.geometry as THREE.BufferGeometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { size: s, triangles: Math.round(tris), drawCalls: draws };
}
