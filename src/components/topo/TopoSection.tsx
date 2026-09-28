'use client';

/* ============================================================
   TopoSection — one mountain, scrubbed from profile to plan.

   The arc, and where it stops. Measured off the reference:

     0.00  low, near the horizon. The massif as a landform.
     0.45  the camera has climbed and tilted; ridges foreshortening.
     1.00  DIRECTLY OVERHEAD. Contours lit, route line drawn, summits
           labelled. It has become a survey plate.

   It ends there on purpose — that is the beat asked for, and it is also
   the natural end of the idea. Everything after it on the reference is a
   different section with a different scene.

   SCRUBBED, not triggered. The opposite choice from the flight above it,
   and deliberate: the flight is a sequence of set pieces where scroll
   cuts between them, whereas this is ONE continuous move whose whole
   point is that the viewer drives the rotation and feels the mountain
   turn under them. A trigger would take that away.
   ============================================================ */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildMassif, heightAt, MASSIF_SIZE, PEAK_H } from './massif';
import { buildClouds } from './clouds';
import { setPixelRatioForDevice } from '../gpuBudget';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Summits, in world units. Placed by sampling the generated height field
   rather than typed, so they sit ON the mountain however the noise is
   retuned — a hard-coded label drifts off its peak the moment a constant
   changes. */
type Summit = { name: string; note: string; x: number; z: number; y: number };

function findSummits(): Summit[] {
  const want = [
    { name: 'RIDGE ALPHA', note: 'SURVEY 01', rx: -0.16, rz: 0.1 },
    { name: 'THE SADDLE', note: 'SURVEY 02', rx: 0.14, rz: -0.12 },
  ];
  return want.map((w) => {
    /* Hill-climb from the seed toward the highest ground nearby, so the
       marker lands on a real summit and not on whatever the seed hit. */
    let x = w.rx * MASSIF_SIZE, z = w.rz * MASSIF_SIZE;
    let step = MASSIF_SIZE * 0.05;
    for (let i = 0; i < 26; i++) {
      let bx = x, bz = z, bh = heightAt(x, z);
      for (let a = 0; a < 8; a++) {
        const t = (a / 8) * Math.PI * 2;
        const nx = x + Math.cos(t) * step, nz = z + Math.sin(t) * step;
        const nh = heightAt(nx, nz);
        if (nh > bh) { bh = nh; bx = nx; bz = nz; }
      }
      if (bx === x && bz === z) step *= 0.6;
      x = bx; z = bz;
    }
    return { name: w.name, note: w.note, x, z, y: heightAt(x, z) };
  });
}

export interface TopoSectionProps {
  progressRef: React.MutableRefObject<number>;
  /* Screen-space positions of the summit markers, 0..1, so the DOM
     labels can follow the 3D points without the labels living in WebGL —
     type stays selectable and readable to a screen reader. */
  onMarkers?: (m: { name: string; note: string; x: number; y: number; on: number }[]) => void;
  className?: string;
}

export const TopoSection: React.FC<TopoSectionProps> = ({ progressRef, onMarkers, className = '' }) => {
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
    setPixelRatioForDevice(renderer, 1.75);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const GROUND = new THREE.Color('#0a0908');
    const scene = new THREE.Scene();
    scene.background = GROUND;

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 4000);
    const massif = buildMassif();
    scene.add(massif);

    const clouds = buildClouds();
    scene.add(clouds.group);

    const mat = massif.material as THREE.ShaderMaterial;
    const summits = findSummits();

    const camPos = new THREE.Vector3();
    const target = new THREE.Vector3();
    const proj = new THREE.Vector3();

    /* Written by apply(), read by the frame loop — the drift needs a
       clock and apply() only sees scroll. */
    let cloudFade = 1;

    const apply = (p: number) => {
      const e = easeInOut(clamp01(p));

      /* The arc. Elevation angle from just above the horizon to straight
         down, radius pulling in as it climbs so the massif keeps filling
         the frame rather than shrinking into the distance. */
      const elev = lerp(0.055, Math.PI / 2 - 0.012, e);
      /* Pulls BACK on the way up, not in.

         It moved closer at first, which framed the profile well and then
         arrived overhead seeing about a third of the massif — a crop of
         a map is not a map. Overhead, the visible width is roughly
         2 * radius * tan(fov/2), so 1.75x the massif at 34 degrees puts
         the whole landform in frame with margin. */
      const radius = lerp(MASSIF_SIZE * 0.72, MASSIF_SIZE * 1.75, e);
      /* A little azimuth drift, so the move is not a pure vertical
         hinge — turning while rising reads as flying around it. */
      const azim = lerp(-0.42, -0.02, e);

      const horiz = Math.cos(elev) * radius;
      camPos.set(
        Math.sin(azim) * horiz,
        lerp(PEAK_H * 0.42, 0, e) + Math.sin(elev) * radius,
        Math.cos(azim) * horiz
      );

      /* Aim at the summit early and at the centre of the plate late —
         framing the peak is what makes the profile view a portrait, and
         centring is what makes the overhead view a map. */
      target.set(
        lerp(summits[0].x, 0, e),
        lerp(PEAK_H * 0.55, 0, e),
        lerp(summits[0].z, 0, e)
      );
      camera.position.copy(camPos);
      camera.lookAt(target);
      camera.fov = lerp(40, 34, e);
      camera.updateProjectionMatrix();

      /* Shading follows the camera. The plate reading only makes sense
         from above, so it arrives late and fast. */
      const plan = smoothstep(0.42, 0.96, p);
      mat.uniforms.uPlan.value = plan;
      mat.uniforms.uContour.value = smoothstep(0.55, 1.0, p);

      /* The cloud banks belong to the profile half.

         Tied to the scrub rather than to the fog or the plan crossfade,
         and gone EARLIER than either: the camera rises through these
         heights, so by the time it is looking down they would sit
         between the lens and the plate. Clear by 0.62 leaves the whole
         survey read unobstructed. */
      cloudFade = 1 - smoothstep(0.24, 0.62, p);

      /* Fog follows the camera. Held tight in the profile shot where it
         is doing the atmospheric work, then pushed past the far edge of
         the plate so the overhead view is not veiled by it. */
      const dist = camPos.length();
      mat.uniforms.uFogNear.value = lerp(dist * 0.5, dist * 1.6, plan);
      mat.uniforms.uFogFar.value = lerp(dist * 1.7, dist * 4.0, plan);

      /* Project the summits so the DOM labels can sit on them. */
      if (onMarkers) {
        const on = smoothstep(0.72, 0.94, p);
        onMarkers(
          summits.map((s) => {
            proj.set(s.x, s.y, s.z).project(camera);
            return {
              name: s.name,
              note: s.note,
              x: (proj.x * 0.5 + 0.5) * 100,
              y: (-proj.y * 0.5 + 0.5) * 100,
              on: proj.z > 1 ? 0 : on,
            };
          })
        );
      }
    };

    let raf = 0;
    let inView = true;
    const io = new IntersectionObserver((e) => { inView = e[0].isIntersecting; }, { threshold: 0 });
    io.observe(wrap);

    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    /* The one piece of this section that is NOT scrubbed.

       Everything else here is driven by the reader's scroll, which was
       deliberate. Clouds cannot be: a bank that only moves when you
       scroll reads as a texture stuck to the screen. The drift is slow
       enough that it never competes with the camera move.

       The clock is read INSIDE the visibility gate, so time does not
       accumulate while the section is off screen and the banks do not
       jump forward by however long the reader spent elsewhere. */
    const clock = new THREE.Clock();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let drift = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!inView) return;
      const dt = Math.min(0.1, clock.getDelta());
      if (!reduced) drift += dt;
      apply(progressRef.current);
      clouds.update(drift, cloudFade);
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      io.disconnect();
      clouds.dispose();
      massif.geometry.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, [progressRef, onMarkers]);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'absolute', inset: 0, background: '#0a0908' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default TopoSection;
