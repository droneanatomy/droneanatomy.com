/* ============================================================
   craft — the aircraft, built from primitives.

   PLACEHOLDERS. Every function here returns a THREE.Group assembled from
   boxes and cylinders, sized to the real airframes' proportions. They
   exist so the choreography — camera legs, spacing, scene pacing, how big
   the VTOL reads at each beat — can be judged and signed off BEFORE any
   modelling time is spent, because a camera move that does not work will
   not start working because the mesh got better.

   REPLACING THEM WITH REAL MODELS is meant to be a small change. Each
   builder returns a Group whose origin is the aircraft's centre of mass,
   nose pointing along -Z, wings along X. A GLB authored to the same
   convention swaps in like this:

     const gltf = await new GLTFLoader().loadAsync('/models/mini.glb')
     const craft = gltf.scene                     // instead of buildVtol()
     craft.userData.rotors = craft.children.filter(o => o.name.startsWith('rotor'))

   Nothing outside this file knows what the craft is made of; the scene
   only reads `.userData.rotors` and moves the Group.
   ============================================================ */

import * as THREE from 'three';

const INK = 0x191815;
const SHELL = 0x33302b;
const FLARE = 0xfffc00;

/* Shared so the whole fleet lights identically and the GPU keeps one
   program. Real models will bring their own PBR materials. */
const bodyMat = new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.55, metalness: 0.15 });
const darkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.7, metalness: 0.1 });
const flareMat = new THREE.MeshStandardMaterial({ color: FLARE, roughness: 0.45, metalness: 0.05 });

/* Rotor discs, not blades. At the distances this scene flies, modelled
   blades alias into a flickering mess and a spinning disc is what a real
   rotor reads as anyway. */
const rotorDisc = (r: number) => {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshStandardMaterial({
      color: INK,
      roughness: 0.9,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
};

const box = (w: number, h: number, d: number, mat: THREE.Material) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

const tube = (r: number, len: number, mat: THREE.Material, segs = 12) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  return m;
};

export type Craft = THREE.Group & {
  userData: { rotors: THREE.Object3D[]; rotorGroups?: Record<string, THREE.Object3D[]>; label: string };
};

const asCraft = (g: THREE.Group, label: string, rotors: THREE.Object3D[]): Craft => {
  g.userData.rotors = rotors;
  g.userData.label = label;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g as Craft;
};

/* ---------- the VTOL: the hero airframe ---------- */

export function buildVtol(): Craft {
  const g = new THREE.Group();
  const rotors: THREE.Object3D[] = [];

  // fuselage — nose at -Z
  const fus = tube(0.34, 4.2, bodyMat, 16);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 16), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.6;
  g.add(nose);

  // main wing
  const wing = box(9.2, 0.14, 1.5, bodyMat);
  wing.position.set(0, 0.1, 0.1);
  g.add(wing);

  // a flash of the brand yellow, so the airframe reads as ours at distance
  const stripe = box(9.2, 0.06, 0.28, flareMat);
  stripe.position.set(0, 0.19, -0.45);
  g.add(stripe);

  // twin booms carrying the lift rotors
  for (const side of [-1, 1]) {
    const boom = tube(0.11, 4.6, darkMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(side * 2.5, 0.05, 0.2);
    g.add(boom);

    for (const z of [-1.9, 2.2]) {
      const hub = tube(0.16, 0.22, darkMat, 10);
      hub.position.set(side * 2.5, 0.22, z);
      g.add(hub);
      const disc = rotorDisc(1.05);
      disc.position.set(side * 2.5, 0.36, z);
      g.add(disc);
      rotors.push(disc);
    }

    // V-tail
    const fin = box(0.1, 1.25, 0.9, bodyMat);
    fin.position.set(side * 2.5, 0.6, 2.35);
    fin.rotation.z = side * 0.38;
    g.add(fin);
  }

  // pusher prop at the tail — this is what makes it wing-borne, not a quad
  const pusher = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshStandardMaterial({
      color: INK, roughness: 0.9, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    })
  );
  pusher.position.z = 2.35;
  g.add(pusher);
  rotors.push(pusher);

  return asCraft(g, 'vtol', rotors);
}

/* ---------- the fleet that joins in the swarm scene ---------- */

export type FleetVariant = 'heavy' | 'observer' | 'compact';

/* Three silhouettes that stay distinguishable in motion at distance —
   which is the only test that matters here. Detail does not survive the
   camera pulling back; proportion and stance do. */
export function buildFleetCraft(variant: FleetVariant): Craft {
  const g = new THREE.Group();
  const rotors: THREE.Object3D[] = [];

  const spec = {
    /* NOT the P10 Pro. This scene is a VTOL story and the agricultural
       sprayer does not belong in it — no slung tank, no yellow shell.
       A heavier second airframe: wider stance, taller body, legs. */
    heavy: { arm: 1.6, rotor: 0.82, body: [1.35, 0.5, 1.6] as const, legs: true },
    // observation platform: slim, gimbal ball at the nose
    observer: { arm: 1.15, rotor: 0.56, body: [0.95, 0.3, 1.25] as const, legs: false },
    // sub-250g class: small, four short arms, nothing slung
    compact: { arm: 0.62, rotor: 0.34, body: [0.5, 0.2, 0.62] as const, legs: false },
  }[variant];

  const shell = box(spec.body[0], spec.body[1], spec.body[2], bodyMat);
  g.add(shell);

  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const arm = tube(0.055, spec.arm, darkMat, 8);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -sx * sz * (Math.PI / 4);
    arm.position.set((sx * spec.arm) / 2.6, 0, (sz * spec.arm) / 2.6);
    g.add(arm);

    const d = rotorDisc(spec.rotor);
    d.position.set(sx * spec.arm * 0.62, 0.13, sz * spec.arm * 0.62);
    g.add(d);
    rotors.push(d);
  }

  if (spec.legs) {
    for (const side of [-1, 1]) {
      const leg = tube(0.045, 0.85, darkMat, 6);
      leg.position.set(side * 0.62, -0.5, 0);
      g.add(leg);
    }
  }

  if (variant === 'observer') {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), darkMat);
    ball.position.set(0, -0.24, -0.5);
    g.add(ball);
  }

  return asCraft(g, variant, rotors);
}

/* Rotors spin on the CLOCK, never on scroll.

   This is the single most useful thing the reference site does: ambient
   motion runs on elapsed time while the camera runs on scroll. Measured,
   over half their frame repaints with the scroll untouched, which is why
   a paused scene still looks alive instead of dead. It also means scroll
   jitter never has to look smooth — the ambient motion covers it. */
export function spinRotors(craft: Craft, t: number, rate = 26, hubs?: THREE.Object3D[]) {
  const r = hubs ?? craft.userData.rotors;
  for (let i = 0; i < r.length; i++) {
    // alternate direction, and detune slightly so they never strobe together
    const dir = i % 2 === 0 ? 1 : -1;
    r[i].rotation.z = t * rate * dir * (1 + i * 0.013);
  }
}
