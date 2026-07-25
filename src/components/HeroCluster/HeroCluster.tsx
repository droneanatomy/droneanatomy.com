'use client';

/* ============================================================
   HeroCluster — Lusion-style hero.

   A light section holding a dark rounded "card" in which a cluster
   of glossy 3D jack shapes tumbles slowly. Content (wordmark, tag-
   line, nav, scroll cue, corner ticks) is laid over the top.

   Follows the project's WireframeTerrain pattern: a client component
   that owns a <canvas>, builds the scene in an effect, runs a rAF
   loop, pauses when off-screen, and cleans up on unmount. Mounted
   lazily (ssr:false) via LazyHeroCluster so Three.js never ships to
   the server or runs on small screens.
   ============================================================ */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import styles from './HeroCluster.module.css';

export interface HeroClusterProps {
  className?: string;
  wordmark?: string;
  tagline?: string;
}

/* Brand palette for the jacks: yellow is the accent, the rest are a
   neutral value ramp so the yellow reads as the one saturated note —
   the same discipline Lusion uses with its single blue. */
const PALETTE = [
  { hex: 0xfffc00, metal: 0.0, rough: 0.28, clear: 0.6 }, // brand yellow
  { hex: 0x14151a, metal: 0.0, rough: 0.35, clear: 0.9 }, // charcoal
  { hex: 0xffffff, metal: 0.0, rough: 0.22, clear: 0.8 }, // white
  { hex: 0xc4c6cf, metal: 0.0, rough: 0.30, clear: 0.7 }, // light grey
  { hex: 0x3a3d47, metal: 0.0, rough: 0.40, clear: 0.8 }, // slate
];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HeroCluster: React.FC<HeroClusterProps> = ({
  className = '',
  wordmark = 'DroneAnatomy',
  tagline = 'We build the autonomous systems that define the next era of flight.',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webGLFailed, setWebGLFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      setWebGLFailed(true);
      return;
    }

    const DPR = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(DPR);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 9.2);

    /* Studio environment for the clearcoat reflections — a soft
       gradient prefiltered into an env map. This is what gives the
       glossy plastic its life; without it the shapes read flat. */
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 128;
    envCanvas.height = 128;
    const ectx = envCanvas.getContext('2d')!;
    const grad = ectx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#c9ccda');
    grad.addColorStop(1, '#4a4d5a');
    ectx.fillStyle = grad;
    ectx.fillRect(0, 0, 128, 128);
    // a couple of bright soft "lights" for specular hits
    for (const [x, y, r] of [[38, 30, 26], [96, 70, 20]] as const) {
      const g = ectx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ectx.fillStyle = g;
      ectx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    pmrem.dispose();
    envTex.dispose();

    /* Lights: a key + soft fill so the yellow stays punchy and the
       darks keep a readable shoulder. */
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe3f0, 0.8);
    fill.position.set(-5, -2, 2);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    /* One jack = three rounded arms on the X/Y/Z axes. Capsules give
       the arms their soft cylindrical ends. Reused geometry, one
       material per jack. */
    const armGeo = new THREE.CapsuleGeometry(0.30, 1.05, 8, 20);
    const cluster = new THREE.Group();
    scene.add(cluster);

    const rand = mulberry32(74215);
    const JACKS = 15;
    const jacks: { mesh: THREE.Group; spin: THREE.Vector3 }[] = [];

    for (let i = 0; i < JACKS; i++) {
      const p = PALETTE[i % PALETTE.length];
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(p.hex),
        metalness: p.metal,
        roughness: p.rough,
        clearcoat: p.clear,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.1,
      });

      const jack = new THREE.Group();
      const ax = new THREE.Mesh(armGeo, mat);
      ax.rotation.z = Math.PI / 2; // along X
      const ay = new THREE.Mesh(armGeo, mat); // along Y
      const az = new THREE.Mesh(armGeo, mat);
      az.rotation.x = Math.PI / 2; // along Z
      jack.add(ax, ay, az);

      // Distribute within a rough sphere, random size and orientation.
      const s = 0.62 + rand() * 0.7;
      jack.scale.setScalar(s);
      const r = 1.7 + rand() * 1.9;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      jack.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.8,
        r * Math.cos(phi)
      );
      jack.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      cluster.add(jack);

      jacks.push({
        mesh: jack,
        spin: new THREE.Vector3(
          (rand() - 0.5) * 0.3,
          (rand() - 0.5) * 0.3,
          (rand() - 0.5) * 0.3
        ),
      });
    }

    /* Pointer parallax — the cluster leans toward the cursor. */
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    const onLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', onLeave);

    /* Pause the loop when the hero scrolls out of view. */
    let inView = true;
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting;
      },
      { threshold: 0.02 }
    );
    io.observe(container);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!inView) return;
      const dt = Math.min(clock.getDelta(), 0.05);

      // Whole cluster turns slowly; each jack tumbles on its own.
      cluster.rotation.y += dt * 0.14;
      cluster.rotation.x += dt * 0.05;
      for (const j of jacks) {
        j.mesh.rotation.x += j.spin.x * dt;
        j.mesh.rotation.y += j.spin.y * dt;
        j.mesh.rotation.z += j.spin.z * dt;
      }

      pointer.sx += (pointer.x - pointer.sx) * 0.05;
      pointer.sy += (pointer.y - pointer.sy) * 0.05;
      cluster.rotation.y += pointer.sx * 0.0025;
      camera.position.x = pointer.sx * 0.5;
      camera.position.y = -pointer.sy * 0.4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      io.disconnect();
      armGeo.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.material) {
          const mat = m.material as THREE.Material | THREE.Material[];
          Array.isArray(mat) ? mat.forEach((x) => x.dispose()) : mat.dispose();
        }
      });
      scene.environment?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className={`${styles.hero} ${className}`}>
      {/* Top chrome */}
      <div className={styles.top}>
        <a href="/" className={styles.mark}>
          {wordmark}
        </a>
        <p className={styles.tagline}>{tagline}</p>
        <nav className={styles.nav} aria-label="Primary">
          <button className={styles.pillIcon} aria-label="Collapse">
            <span />
          </button>
          <a href="/contact" className={styles.pillDark}>
            Let&rsquo;s talk <i />
          </a>
          <button className={styles.pill}>Menu &middot;&middot;</button>
        </nav>
      </div>

      {/* 3D card */}
      <div className={styles.card} ref={containerRef}>
        {webGLFailed ? (
          <div className={styles.fallback} />
        ) : (
          <canvas ref={canvasRef} className={styles.canvas} />
        )}
        <span className={`${styles.tick} ${styles.tl}`}>+</span>
        <span className={`${styles.tick} ${styles.tr}`}>+</span>
        <span className={`${styles.tick} ${styles.bl}`}>+</span>
        <span className={`${styles.tick} ${styles.br}`}>+</span>
      </div>

      {/* Bottom rail */}
      <div className={styles.rail}>
        <span className={styles.plus}>+</span>
        <span className={styles.scroll}>Scroll to explore</span>
        <span className={styles.plus}>+</span>
      </div>
    </section>
  );
};

export default HeroCluster;
