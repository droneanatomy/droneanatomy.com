'use client';

/* ============================================================
   FlyGame — free flight over the site's own terrain.

   A hidden page, not a feature: nothing links here and it asks search
   engines to stay away. It exists for the person who finds it.

   EVERYTHING IS BORROWED, ON PURPOSE. The land is terrain.ts's baked plate
   with the grain layer on it, the aircraft are the same GLBs the homepage
   and product pages load through loadCraft — including the VTOL's
   pusher-only rotor — and the lighting is FlightScene's sun, fill and the
   craft-only key/fill on their own layer. A secret level that looks like a
   different site is not a secret level of this one.

   THE WORLD IS ENDLESS ALONG Z AND WALLED ALONG X. terrain.ts makes the
   field periodic over LOOP so the homepage can scroll it forever, and that
   is what makes free flight possible without a bigger map: the mesh covers
   two loops, so it is snapped to the nearest whole LOOP under the craft and
   a flight in either direction along z never reaches its end — groundAt
   wraps with the same modulo, so heights stay correct at every snap. Across
   x the plate is 1600 units and does not repeat, so the craft is turned
   back softly before the edge shows.

   ARCADE, NOT SIMULATION. Velocity eases toward what the keys ask for and
   the craft banks and pitches to sell it. The one hard rule is the ground:
   the craft is held above groundAt plus a clearance scaled to its size,
   so it can be skimmed but never flown into.
   ============================================================ */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  attachTerrainGrain,
  buildTerrain,
  buildWater,
  groundAt,
  LOOP,
  refreshTerrain,
  setTerrainAnisotropy,
  TERRAIN_SIZE,
  terrainReady,
} from '@/components/flight/terrain';
import { loadCraft } from '@/components/flight/loadCraft';
import { spinRotors, type Craft } from '@/components/flight/craft';

/* ---- the fleet ---------------------------------------------------------

   Rotations and the VTOL's rotor selection are the measured values from
   FlightScene, not re-derived: the VTOL's nose is -X (+90 about y), the
   Mini's lens is -Z (a half turn), Noxr's is already +Z. Spans keep the
   real proportions the swarm uses — the VTOL five times the Mini, three
   times the Noxr — and everything else about the flight is scaled off the
   span, so a small aircraft is not simply a slow big one. */
type Spec = {
  key: string;
  name: string;
  blurb: string;
  model: string;
  span: number;
  rotate: [number, number, number];
  rotors?: Parameters<typeof loadCraft>[1]['rotors'];
  /** Cruise speed and boost, world units per second. */
  speed: number;
  boost: number;
  /** Yaw rate, radians per second. */
  turn: number;
  climb: number;
  /** Strafe is a multirotor move; a fixed wing does not slide sideways. */
  strafe: boolean;
  /** How hard it banks into a turn, radians. */
  bank: number;
};

const FLEET: Spec[] = [
  {
    key: 'cyclops',
    name: 'Cyclops',
    blurb: 'VTOL · fixed-wing range',
    model: '/models/vtol.glb',
    span: 11,
    rotate: [0, Math.PI / 2, 0],
    rotors: { pick: (c) => Math.abs(c.z) < 0.25 && c.x > 0.4, single: true, axis: 'x' },
    speed: 70,
    boost: 150,
    turn: 0.75,
    climb: 30,
    strafe: false,
    bank: 0.55,
  },
  {
    key: 'mini',
    name: 'Mini',
    blurb: 'Compact · agile',
    model: '/models/mini.glb',
    span: 2.2,
    rotate: [0, Math.PI, 0],
    speed: 26,
    boost: 60,
    turn: 1.9,
    climb: 16,
    strafe: true,
    bank: 0.3,
  },
  {
    key: 'noxr',
    name: 'Noxr',
    blurb: 'Observation · steady',
    model: '/models/noxr.glb',
    span: 3.67,
    rotate: [0, 0, 0],
    speed: 34,
    boost: 80,
    turn: 1.4,
    climb: 20,
    strafe: true,
    bank: 0.25,
  },
];

const CAMERAS = ['Chase', 'Far', 'Top', 'Cinema'] as const;

/* CINEMA frames the aircraft off-centre on a longer lens and gets out of
   its own way: no HUD, no picker, 2.39:1 letterbox. The camera stands
   behind the aircraft, off its right quarter and a little above, and looks
   PAST it down the heading — so the aircraft falls into the lower left
   third and the land ahead fills the rest. Offsets are in spans so every
   airframe frames the same. */
const CINEMA = { back: 5.2, side: 2.1, up: 1.15, ahead: 60, aimDrop: 2.2, fov: 34 };
const LETTERBOX = 2.39;
type CameraMode = (typeof CAMERAS)[number];

/* Keys the game owns. Anything here has its browser default suppressed —
   Space and the arrows would otherwise scroll the page underneath. Ctrl is
   deliberately NOT used for anything: Ctrl+W closes the tab. */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyB', 'KeyV', 'KeyH',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Escape', 'KeyP',
]);

/* Half-width the craft may use before it is turned back. The plate is
   TERRAIN_SIZE wide; the margin keeps the edge out of the frame. */
const WALL_X = TERRAIN_SIZE / 2 - 150;

type Hud = { speed: number; alt: number; heading: number; edge: boolean };

/* One letterbox bar: half of whatever the viewport is taller than 2.39:1. */
const BAR = `max(0px, calc((100vh - 100vw / ${LETTERBOX}) / 2))`;

/* Keyboard-less devices get told rather than handed a game they cannot
   play. A subscription, not an effect that sets state: it is correct on
   the first client render and false on the server, where there is no
   pointer to ask about. */
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
const subscribeTouch = (cb: () => void) => {
  const mq = window.matchMedia(TOUCH_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const isTouchOnly = () => window.matchMedia(TOUCH_QUERY).matches;

export function FlyGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* React owns the menus; the loop owns the aircraft. The loop reads these
     refs every frame instead of re-subscribing on every state change. */
  const craftIdx = useRef(0);
  const camIdx = useRef(0);
  const pausedRef = useRef(true);

  const [selected, setSelected] = useState(0);
  const [camera, setCamera] = useState<CameraMode>('Chase');
  const [paused, setPaused] = useState(true);
  const [help, setHelp] = useState(true);
  const [loading, setLoading] = useState<string | null>('Loading terrain');
  const [hud, setHud] = useState<Hud>({ speed: 0, alt: 0, heading: 0, edge: false });
  const touchOnly = useSyncExternalStore(subscribeTouch, isTouchOnly, () => false);

  const choose = (i: number) => {
    craftIdx.current = i;
    setSelected(i);
  };
  const setPause = (p: boolean) => {
    pausedRef.current = p;
    setPaused(p);
  };

  /* The game owns the viewport. The document behind it must not scroll —
     Space and the arrows are flight controls here — and the site footer
     below the fold should stay below it. Restored on the way out. */
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      /* A DOM flag rather than state: nothing needs to re-render, the
         wrapper's data attribute shows the notice and hides the start
         card through CSS. */
      wrap.dataset.nowebgl = 'true';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    setTerrainAnisotropy(renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    const SKY = new THREE.Color('#bcc1b4');
    scene.background = SKY;
    scene.fog = new THREE.Fog(SKY, 220, 1150);

    const cam = new THREE.PerspectiveCamera(50, 1, 0.3, 2600);

    /* FlightScene's light rig, values unchanged — see the notes there. */
    const sun = new THREE.DirectionalLight(0xfff2de, 2.6);
    sun.position.set(-320, 130, 90);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xd8dcd6, 0x3a4030, 0.45));

    const CRAFT_LAYER = 1;
    const KEY_OFFSET = new THREE.Vector3(70, 90, -55);
    const FILL_OFFSET = new THREE.Vector3(-80, 20, 70);
    const craftKey = new THREE.DirectionalLight(0xfff4e2, 2.2);
    const craftFill = new THREE.DirectionalLight(0xc8d4e0, 0.75);
    const lightTarget = new THREE.Object3D();
    scene.add(lightTarget);
    for (const l of [craftKey, craftFill]) {
      l.layers.set(CRAFT_LAYER);
      l.target = lightTarget;
      scene.add(l);
    }
    /* The camera must see the craft layer too, or the aircraft vanishes. */
    cam.layers.enable(CRAFT_LAYER);

    const terrain = buildTerrain();
    scene.add(terrain);
    const grain = attachTerrainGrain(terrain);
    const water = buildWater();
    scene.add(water);
    let disposed = false;
    terrainReady().then(() => {
      if (disposed) return;
      refreshTerrain(terrain);
      setLoading(null);
    });

    /* ---- aircraft: load once each, swap on selection ----------------- */
    const loaded: (Craft | null)[] = FLEET.map(() => null);
    let active: Craft | null = null;
    let activeIdx = -1;
    FLEET.forEach((spec, i) => {
      loadCraft(spec.model, { span: spec.span, rotate: spec.rotate, rotors: spec.rotors }).then((c) => {
        if (!c || disposed) return;
        c.traverse((o) => o.layers.enable(CRAFT_LAYER));
        /* RE-CENTRED ON THE DRAWN GEOMETRY. loadCraft's normalise() moves the
           model by minus its bbox centre in UNSCALED units and then scales
           the vertices, so the offset is never scaled with them: a model
           lands at centre x (scale - 1) away from its holder. For the Mini
           at span 2.2 that is 2.63 units low — measured, the drawn box sat
           283.63-284.29 against a holder at 286.73 — which put it below the
           bottom of the chase camera's frame at every position. Measured
           here with the holder at the origin, so world and local agree. */
        c.position.set(0, 0, 0);
        c.rotation.set(0, 0, 0);
        c.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(c);
        const centre = box.getCenter(new THREE.Vector3());
        c.children.forEach((child) => child.position.sub(centre));
        loaded[i] = c;
      });
    });

    /* ---- flight state ------------------------------------------------ */
    const pos = new THREE.Vector3(0, 0, 0);
    const vel = new THREE.Vector3();
    let yaw = 0;
    let yawRate = 0;
    let bank = 0;
    let pitch = 0;
    const startAt = (spec: Spec) => {
      pos.set(0, groundAt(0, 0) + 40 + spec.span * 4, 0);
      vel.set(0, 0, 0);
      yaw = 0;
      yawRate = 0;
      bank = 0;
      pitch = 0;
    };
    startAt(FLEET[0]);

    const held = new Set<string>();
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      if (down) {
        if (!e.repeat) {
          if (e.code === 'Escape') setPause(!pausedRef.current);
          if (e.code === 'KeyH') setHelp((h) => !h);
          if (e.code === 'KeyV') {
            camIdx.current = (camIdx.current + 1) % CAMERAS.length;
            setCamera(CAMERAS[camIdx.current]);
          }
          if (e.code === 'KeyP') capture = true;
          if (e.code === 'Digit1') choose(0);
          if (e.code === 'Digit2') choose(1);
          if (e.code === 'Digit3') choose(2);
          /* Any flight key starts the flight — the first thing anyone does
             on a game screen is press W, and it should simply work. */
          if (pausedRef.current && /^(Key[WASDQEB]|Arrow|Space|Shift)/.test(e.code)) setPause(false);
        }
        held.add(e.code);
      } else {
        held.delete(e.code);
      }
    };
    const down = onKey(true);
    const up = onKey(false);
    const clear = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    /* A key released while the window is not focused never sends keyup;
       without this the craft would keep flying on a phantom W. */
    window.addEventListener('blur', clear);

    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    /* ---- the loop ---------------------------------------------------- */
    const clock = new THREE.Clock();
    let t = 0;
    let hudAt = 0;
    const camPos = new THREE.Vector3();
    const camWant = new THREE.Vector3();
    const look = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const want = new THREE.Vector3();
    let raf = 0;
    let camInit = false;
    /* Set by P; honoured right after the next render, while the drawing
       buffer still holds the frame (preserveDrawingBuffer is off, so it is
       only readable inside the same task as the render). */
    let capture = false;
    /* DEV ONLY: an explicit camera for composing a still — see __fly. */
    let shot: { pos: THREE.Vector3; target: THREE.Vector3; fov: number } | null = null;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      /* Clamped: a tab brought back after a minute must not deliver that
         minute as one step and fling the aircraft across the map. */
      const dt = Math.min(clock.getDelta(), 1 / 20);
      t += dt;

      /* Swap the aircraft when the selection changes and the model is in. */
      const idx = craftIdx.current;
      if (idx !== activeIdx && loaded[idx]) {
        const first = activeIdx === -1;
        if (active) scene.remove(active);
        active = loaded[idx];
        activeIdx = idx;
        scene.add(active!);
        /* Only the FIRST aircraft is placed at the start. Switching mid-
           flight swaps the airframe where you are — sent back to spawn
           every time, nobody would switch twice. */
        if (first) startAt(FLEET[idx]);
        else yawRate = 0;
        camInit = false;
      }
      const spec = FLEET[Math.max(0, activeIdx)];

      if (!pausedRef.current && active) {
        const k = (a: string, b?: string) => (held.has(a) || (b ? held.has(b) : false) ? 1 : 0);
        const throttle = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
        const steer = k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight');
        const lift = k('Space') - (k('ShiftLeft') || k('ShiftRight'));
        const slide = spec.strafe ? k('KeyE') - k('KeyQ') : 0;
        const top = held.has('KeyB') ? spec.boost : spec.speed;

        yawRate += (steer * spec.turn - yawRate) * (1 - Math.exp(-dt * 5));
        yaw += yawRate * dt;

        fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        want.copy(fwd).multiplyScalar(throttle * top);
        want.addScaledVector(right, slide * top * 0.6);
        want.y = lift * spec.climb;
        /* A fixed wing keeps way on: with no throttle it slows, but it does
           not stop dead the way a multirotor braking to a hover does. */
        const ease = spec.strafe ? 2.6 : 1.1;
        vel.lerp(want, 1 - Math.exp(-dt * ease));
        pos.addScaledVector(vel, dt);

        /* The wall along x: a push back toward the middle that grows as
           the craft gets closer, rather than a hard stop. */
        const over = Math.abs(pos.x) - WALL_X;
        if (over > 0) {
          vel.x -= Math.sign(pos.x) * over * 4 * dt;
          if (Math.abs(pos.x) > WALL_X + 120) pos.x = Math.sign(pos.x) * (WALL_X + 120);
        }

        /* The ground. Clearance scales with the aircraft so a Mini can skim
           a ridge and the VTOL keeps its wings out of it. */
        const floor = groundAt(pos.x, pos.z) + spec.span * 0.6 + 1.5;
        if (pos.y < floor) {
          pos.y = floor;
          if (vel.y < 0) vel.y = 0;
        }
        pos.y = Math.min(pos.y, 900);

        /* Attitude, for show: bank into the turn, pitch with the speed. */
        const localSpeed = vel.dot(fwd);
        bank += ((yawRate / Math.max(0.01, spec.turn)) * spec.bank - bank) * (1 - Math.exp(-dt * 4));
        /* rotateX(+a) tips the nose DOWN (the nose is local +Z), so forward
           speed is a positive pitch and climbing a negative one. A
           multirotor leans hard into forward flight; a fixed wing barely
           does, it flies on the wing. */
        const lean = spec.strafe ? 0.32 : 0.08;
        pitch += ((localSpeed / Math.max(1, spec.boost)) * lean - (vel.y / Math.max(1, spec.climb)) * 0.14 - pitch) * (1 - Math.exp(-dt * 4));

        if (performance.now() - hudAt > 120) {
          hudAt = performance.now();
          const heading = ((-yaw * 180) / Math.PI % 360 + 360) % 360;
          setHud({
            speed: Math.round(Math.hypot(vel.x, vel.z)),
            alt: Math.round(pos.y - groundAt(pos.x, pos.z)),
            heading: Math.round(heading),
            edge: over > -60,
          });
        }
      }

      /* Endless z: snap the two-loop mesh to the nearest whole loop. */
      const snap = Math.round(pos.z / LOOP) * LOOP;
      terrain.position.z = snap;
      water.position.set(0, water.position.y, pos.z);

      if (active) {
        active.position.copy(pos);
        active.rotation.set(0, 0, 0);
        active.rotateY(yaw);
        /* lookAt convention: the craft's +Z is its nose, so yaw 0 faces
           -z only after this half turn. */
        active.rotateY(Math.PI);
        active.rotateX(pitch);
        active.rotateZ(-bank);
        spinRotors(active, t, spec.strafe ? 40 : 28);

        lightTarget.position.copy(pos);
        craftKey.position.copy(pos).add(KEY_OFFSET);
        craftFill.position.copy(pos).add(FILL_OFFSET);

        /* Cameras, all sized off the aircraft so each one frames it. */
        const mode = CAMERAS[camIdx.current];
        const s = spec.span;
        fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        /* Top sits a little BEHIND the craft: straight overhead makes
           lookAt's up vector parallel to the view and the frame spins. */
        if (mode === 'Chase') { camWant.copy(pos).addScaledVector(fwd, -s * 3.2); camWant.y += s * 1.1; }
        else if (mode === 'Far') { camWant.copy(pos).addScaledVector(fwd, -s * 9); camWant.y += s * 4.5; }
        else if (mode === 'Cinema') {
          camWant.copy(pos).addScaledVector(fwd, -s * CINEMA.back).addScaledVector(right, s * CINEMA.side);
          camWant.y += s * CINEMA.up;
        }
        else { camWant.copy(pos).addScaledVector(fwd, -s * 2.5); camWant.y += s * 14; }
        const camFloor = groundAt(camWant.x, camWant.z) + 3;
        if (camWant.y < camFloor) camWant.y = camFloor;
        if (!camInit) {
          camPos.copy(camWant);
          camInit = true;
        }
        camPos.lerp(camWant, 1 - Math.exp(-dt * 6));
        cam.position.copy(camPos);
        if (mode === 'Cinema') {
          /* Past the aircraft, not at it — this is what puts it in the
             corner of the frame. */
          look.copy(pos).addScaledVector(fwd, s * CINEMA.ahead);
          look.y = pos.y - s * CINEMA.aimDrop;
        } else {
          look.copy(pos).addScaledVector(fwd, s * (mode === 'Top' ? 0 : 2));
        }
        const wantFov = mode === 'Cinema' ? CINEMA.fov : 50;
        if (Math.abs(cam.fov - wantFov) > 0.01) {
          cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-dt * 5));
          cam.updateProjectionMatrix();
        }
        if (shot) {
          cam.position.copy(shot.pos);
          look.copy(shot.target);
          if (cam.fov !== shot.fov) { cam.fov = shot.fov; cam.updateProjectionMatrix(); }
        }
        cam.lookAt(look);
      } else {
        cam.position.set(0, groundAt(0, 0) + 160, 220);
        cam.lookAt(0, groundAt(0, 0), 0);
      }

      renderer.render(scene, cam);
      if (capture) {
        capture = false;
        /* Letterboxed in Cinema, so the saved still is the composed frame
           and not the bars. */
        const cw = canvas.width, ch = canvas.height;
        const cinema = CAMERAS[camIdx.current] === 'Cinema';
        const hh = cinema ? Math.min(ch, Math.round(cw / LETTERBOX)) : ch;
        const out = document.createElement('canvas');
        out.width = cw;
        out.height = hh;
        out.getContext('2d')!.drawImage(canvas, 0, (ch - hh) / 2, cw, hh, 0, 0, cw, hh);
        out.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `droneanatomy-${FLEET[Math.max(0, activeIdx)].key}-${Date.now()}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }, 'image/png');
      }
    };
    frame();

    /* DEV ONLY — a handle for composing stills from a script: place the
       aircraft at an exact spot, pin an explicit camera, read projections.
       Next inlines NODE_ENV, so production builds drop this block. */
    if (process.env.NODE_ENV === 'development') {
      (window as unknown as { __fly: unknown }).__fly = {
        ground: (x: number, z: number) => groundAt(x, z),
        place: (o: { x: number; z: number; heading: number; alt: number; craft?: number }) => {
          if (o.craft !== undefined) choose(o.craft);
          pos.set(o.x, groundAt(o.x, o.z) + o.alt, o.z);
          vel.set(0, 0, 0);
          yaw = (-o.heading * Math.PI) / 180;
          yawRate = 0;
          bank = 0;
          pitch = 0;
          camInit = false;
        },
        camera: (mode: CameraMode) => {
          camIdx.current = CAMERAS.indexOf(mode);
          setCamera(mode);
        },
        shot: (o: { pos: number[]; target: number[]; fov: number } | null) => {
          shot = o ? { pos: new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), target: new THREE.Vector3(o.target[0], o.target[1], o.target[2]), fov: o.fov } : null;
        },
        /* Where the aircraft sits in the frame, in NDC (-1..1, y up). */
        project: () => { const v = pos.clone().project(cam); return [v.x, v.y]; },
        loaded: () => loaded.map(Boolean),
        activeIdx: () => activeIdx,
      };
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', resize);
      grain.dispose();
      /* Geometry and materials marked shared belong to loadCraft's template
         cache, which other pages are still drawing from. */
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => mat && !mat.userData.shared && mat.dispose());
      });
      renderer.dispose();
    };
  }, []);

  const spec = FLEET[selected];

  return (
    <div ref={wrapRef} data-cinema={camera === 'Cinema' ? '' : undefined} className="group fixed inset-0 z-[60] overflow-hidden bg-[#bcc1b4] text-[#f2ecd9]">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {/* Letterbox, Cinema only. Sized in CSS from the viewport so the bars
          always leave exactly a 2.39:1 frame. */}
      {camera === 'Cinema' && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-black" style={{ height: BAR }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-black" style={{ height: BAR }} />
          <p className="pointer-events-none absolute bottom-3 right-5 z-20 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f2ecd9]/45">V camera · P save still</p>
        </>
      )}

      {/* HUD — top left. */}
      <div className="pointer-events-none absolute left-5 top-5 font-mono group-data-[cinema]:hidden text-[11px] uppercase tracking-[0.14em] [text-shadow:0_1px_2px_rgba(9,11,7,0.8)]">
        <p className="text-[13px] tracking-[0.2em]">
          <span className="text-[var(--color-flare,#fffc00)]">●</span> {spec.name}
        </p>
        <p className="mt-2 opacity-80">SPD {String(hud.speed).padStart(3, '0')} · ALT {String(hud.alt).padStart(3, '0')} · HDG {String(hud.heading).padStart(3, '0')}°</p>
        <p className="mt-1 opacity-60">CAM {camera}</p>
        {hud.edge && <p className="mt-2 text-[var(--color-flare,#fffc00)]">Edge of survey area — turning back</p>}
      </div>

      {/* Craft picker — top right. */}
      <div className="absolute right-5 top-5 flex flex-col gap-2 group-data-[cinema]:hidden">
        {FLEET.map((f, i) => (
          <button
            key={f.key}
            type="button"
            onClick={() => choose(i)}
            className={
              'flex min-w-[190px] items-baseline justify-between gap-4 border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] backdrop-blur-[6px] transition-colors ' +
              (i === selected
                ? 'border-[var(--color-flare,#fffc00)] bg-[rgba(9,11,7,0.72)]'
                : 'border-[rgba(242,236,217,0.25)] bg-[rgba(9,11,7,0.45)] hover:bg-[rgba(9,11,7,0.65)]')
            }
          >
            <span>
              <span className="opacity-50">{i + 1}</span> {f.name}
            </span>
            <span className="text-[10px] normal-case tracking-normal opacity-60">{f.blurb}</span>
          </button>
        ))}
      </div>

      {/* Controls — bottom left, toggled with H. */}
      {help && camera !== 'Cinema' && (
        <div className="pointer-events-none absolute bottom-5 left-5 border border-[rgba(242,236,217,0.18)] bg-[rgba(9,11,7,0.55)] px-4 py-3 font-mono text-[11px] leading-[1.9] tracking-[0.06em] backdrop-blur-[6px]">
          <p><b>W S</b> forward · back &nbsp; <b>A D</b> turn</p>
          <p><b>Space</b> climb &nbsp; <b>Shift</b> descend &nbsp; <b>Q E</b> strafe{spec.strafe ? '' : ' (multirotors)'}</p>
          <p><b>B</b> boost &nbsp; <b>V</b> camera &nbsp; <b>P</b> still &nbsp; <b>1 2 3</b> craft</p>
          <p className="opacity-60"><b>H</b> hide help &nbsp; <b>Esc</b> pause</p>
        </div>
      )}

      {/* Start / pause card. */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(9,11,7,0.35)] group-data-[nowebgl]:hidden">
          <div className="max-w-[min(90vw,420px)] border border-[rgba(242,236,217,0.2)] bg-[rgba(9,11,7,0.78)] px-7 py-6 text-center backdrop-blur-[8px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">Free flight</p>
            <p className="mt-2 font-display text-[clamp(26px,3vw,40px)] uppercase leading-none">{spec.name}</p>
            <p className="mt-3 text-[14px] opacity-80">
              {touchOnly
                ? 'This one needs a keyboard. Open it on a computer.'
                : loading
                  ? `${loading}…`
                  : 'Press W to take off.'}
            </p>
            {!touchOnly && (
              <button
                type="button"
                onClick={() => setPause(false)}
                className="mt-5 border border-[var(--color-flare,#fffc00)] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-[rgba(255,252,0,0.08)]"
              >
                Fly
              </button>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 hidden items-center justify-center bg-[#090b07] px-6 text-center group-data-[nowebgl]:flex">
        <p>This needs WebGL, and this browser does not have it available.</p>
      </div>
    </div>
  );
}
