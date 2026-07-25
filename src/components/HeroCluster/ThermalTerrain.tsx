'use client';

/* ============================================================
   ThermalTerrain — the hero card's visual.

   A top-down "site" image that parallaxes slightly with the cursor
   (2.5D, driven by a depth map), with a thermal-imaging lens that
   follows the pointer: inside a soft circle the terrain is shown in
   an ironbow thermal palette — roofs and roads read hot, vegetation
   and water read cold — the way an EO/IR payload sees the ground.

   Pass aligned day + thermal photos via imageSrc / thermalSrc (same
   frame, same crop). Both are cover-fit and parallaxed identically so
   features line up exactly across the lens edge. Without props, a
   procedural site is generated so the effect is still visible.

   The parallax is a subtle uniform drift (no depth map needed for a
   flat photo); depthSrc is accepted but unused for real imagery.
   ============================================================ */

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export interface ThermalTerrainProps {
  imageSrc?: string;
  thermalSrc?: string;
  depthSrc?: string;
}

/* ---------- procedural site generator ---------- */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IRONBOW: [number, [number, number, number]][] = [
  [0.0, [6, 0, 20]],
  [0.18, [48, 8, 86]],
  [0.38, [132, 20, 96]],
  [0.55, [204, 48, 42]],
  [0.7, [240, 120, 24]],
  [0.85, [252, 214, 74]],
  [1.0, [255, 255, 255]],
];

function ironbow(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < IRONBOW.length - 1; i++) {
    const [a, ca] = IRONBOW[i];
    const [b, cb] = IRONBOW[i + 1];
    if (t >= a && t <= b) {
      const k = (t - a) / (b - a || 1);
      return [
        ca[0] + (cb[0] - ca[0]) * k,
        ca[1] + (cb[1] - ca[1]) * k,
        ca[2] + (cb[2] - ca[2]) * k,
      ];
    }
  }
  return [255, 255, 255];
}

type Feature =
  | { kind: 'field'; x: number; y: number; r: number; c: string; heat: number }
  | { kind: 'water'; pts: [number, number][]; w: number }
  | { kind: 'road'; a: [number, number]; b: [number, number]; w: number }
  | { kind: 'building'; x: number; y: number; w: number; h: number; c: string }
  | { kind: 'veg'; x: number; y: number; r: number };

/* Build day / thermal(heat) / depth canvases from one feature list. */
function generateSite() {
  const W = 1280,
    H = 720;
  const rand = mulberry32(9137);

  const day = document.createElement('canvas');
  day.width = W;
  day.height = H;
  const dc = day.getContext('2d')!;

  const HW = 640,
    HH = 360; // heat + depth at half res, upscaled by the GPU
  const heat = document.createElement('canvas');
  heat.width = HW;
  heat.height = HH;
  const hc = heat.getContext('2d')!;
  const depth = document.createElement('canvas');
  depth.width = HW;
  depth.height = HH;
  const zc = depth.getContext('2d')!;
  const sx = HW / W,
    sy = HH / H;

  // base ground
  dc.fillStyle = '#a49b78';
  dc.fillRect(0, 0, W, H);
  hc.fillStyle = 'rgb(107,107,107)'; // heat ~0.42
  hc.fillRect(0, 0, HW, HH);
  zc.fillStyle = 'rgb(128,128,128)'; // depth 0.5 neutral
  zc.fillRect(0, 0, HW, HH);

  const features: Feature[] = [];

  // large soft field patches
  const fieldColors = ['#a9b56a', '#b6a866', '#94a458', '#c2b382'];
  for (let i = 0; i < 9; i++) {
    features.push({
      kind: 'field',
      x: rand() * W,
      y: rand() * H,
      r: 130 + rand() * 220,
      c: fieldColors[(rand() * fieldColors.length) | 0],
      heat: 0.24 + rand() * 0.1,
    });
  }
  // a river across the frame (cold)
  features.push({
    kind: 'water',
    w: 46 + rand() * 26,
    pts: [
      [-40, H * 0.2],
      [W * 0.35, H * 0.45],
      [W * 0.6, H * 0.4],
      [W + 40, H * 0.72],
    ],
  });
  // road grid
  for (let i = 0; i < 4; i++) {
    const horizontal = rand() > 0.5;
    if (horizontal) {
      const y = 80 + rand() * (H - 160);
      features.push({ kind: 'road', a: [-40, y], b: [W + 40, y + (rand() - 0.5) * 80], w: 12 + rand() * 8 });
    } else {
      const x = 80 + rand() * (W - 160);
      features.push({ kind: 'road', a: [x, -40], b: [x + (rand() - 0.5) * 80, H + 40], w: 12 + rand() * 8 });
    }
  }
  // buildings (hot roofs, raised)
  const roofs = ['#c3beb2', '#d2caB4', '#aca596', '#cec6b2'];
  for (let i = 0; i < 26; i++) {
    const w = 26 + rand() * 90;
    const h = 26 + rand() * 90;
    features.push({
      kind: 'building',
      x: rand() * (W - w),
      y: rand() * (H - h),
      w,
      h,
      c: roofs[(rand() * roofs.length) | 0],
    });
  }
  // vegetation clumps (cool)
  for (let i = 0; i < 22; i++) {
    features.push({ kind: 'veg', x: rand() * W, y: rand() * H, r: 14 + rand() * 46 });
  }

  const line = (
    ctx: CanvasRenderingContext2D,
    a: [number, number],
    b: [number, number],
    w: number,
    color: string,
    scaleX = 1,
    scaleY = 1
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * ((scaleX + scaleY) / 2);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a[0] * scaleX, a[1] * scaleY);
    ctx.lineTo(b[0] * scaleX, b[1] * scaleY);
    ctx.stroke();
  };

  for (const f of features) {
    if (f.kind === 'field') {
      const g = dc.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, f.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g;
      dc.globalAlpha = 0.65;
      dc.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      dc.globalAlpha = 1;

      const hv = Math.round(f.heat * 255);
      const hg = hc.createRadialGradient(f.x * sx, f.y * sy, 0, f.x * sx, f.y * sy, f.r * sx);
      hg.addColorStop(0, `rgba(${hv},${hv},${hv},0.5)`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      hc.fillStyle = hg;
      hc.fillRect((f.x - f.r) * sx, (f.y - f.r) * sy, f.r * 2 * sx, f.r * 2 * sy);
    } else if (f.kind === 'water') {
      const drawWater = (ctx: CanvasRenderingContext2D, col: string, scaleX: number, scaleY: number) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = f.w * ((scaleX + scaleY) / 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(f.pts[0][0] * scaleX, f.pts[0][1] * scaleY);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0] * scaleX, f.pts[i][1] * scaleY);
        ctx.stroke();
      };
      drawWater(dc, '#5a92ab', 1, 1); // day: brighter water
      drawWater(hc, 'rgb(18,18,18)', sx, sy); // heat ~0.07 (coldest)
    } else if (f.kind === 'road') {
      line(dc, f.a, f.b, f.w, '#6e6a63', 1, 1); // day: mid grey road
      line(hc, f.a, f.b, f.w, 'rgb(190,190,190)', sx, sy); // heat ~0.74 (warm)
    } else if (f.kind === 'building') {
      // day roof + tiny shadow
      dc.fillStyle = 'rgba(0,0,0,0.22)';
      dc.fillRect(f.x + 3, f.y + 4, f.w, f.h);
      dc.fillStyle = f.c;
      dc.fillRect(f.x, f.y, f.w, f.h);
      dc.strokeStyle = 'rgba(0,0,0,0.15)';
      dc.strokeRect(f.x, f.y, f.w, f.h);
      // heat: hot roof
      hc.fillStyle = 'rgb(216,216,216)'; // ~0.85
      hc.fillRect(f.x * sx, f.y * sy, f.w * sx, f.h * sy);
      // depth: raised
      zc.fillStyle = 'rgb(205,205,205)'; // ~0.80
      zc.fillRect(f.x * sx, f.y * sy, f.w * sx, f.h * sy);
    } else if (f.kind === 'veg') {
      const g = dc.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, '#4c5f2b');
      g.addColorStop(1, 'rgba(76,95,43,0)');
      dc.fillStyle = g;
      dc.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);

      const hg = hc.createRadialGradient(f.x * sx, f.y * sy, 0, f.x * sx, f.y * sy, f.r * sx);
      hg.addColorStop(0, 'rgba(58,58,58,0.9)'); // heat ~0.23 (cool)
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      hc.fillStyle = hg;
      hc.fillRect((f.x - f.r) * sx, (f.y - f.r) * sy, f.r * 2 * sx, f.r * 2 * sy);
    }
  }

  // day vignette
  const vg = dc.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.16)');
  dc.fillStyle = vg;
  dc.fillRect(0, 0, W, H);

  // heat -> ironbow thermal RGB
  const thermal = document.createElement('canvas');
  thermal.width = HW;
  thermal.height = HH;
  const tc = thermal.getContext('2d')!;
  const hImg = hc.getImageData(0, 0, HW, HH);
  const tImg = tc.createImageData(HW, HH);
  for (let i = 0; i < hImg.data.length; i += 4) {
    const [r, g, b] = ironbow(hImg.data[i] / 255);
    tImg.data[i] = r;
    tImg.data[i + 1] = g;
    tImg.data[i + 2] = b;
    tImg.data[i + 3] = 255;
  }
  tc.putImageData(tImg, 0, 0);

  return { day, thermal, depth };
}

/* ---------- component ---------- */

export const ThermalTerrain: React.FC<ThermalTerrainProps> = ({ imageSrc, thermalSrc, depthSrc }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const tex = (cv: HTMLCanvasElement, srgb: boolean) => {
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    };

    const site = generateSite();
    const uDay = tex(site.day, true);
    const uThermal = tex(site.thermal, true);

    const uniforms = {
      uDay: { value: uDay as THREE.Texture },
      uThermal: { value: uThermal as THREE.Texture },
      uMouse: { value: new THREE.Vector2(0, 0) },       // -1..1, eased
      uMouseUV: { value: new THREE.Vector2(0.5, 0.5) }, // 0..1 screen, eased
      uHover: { value: 0 },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0.17 },
      uImgAspect: { value: 1280 / 720 }, // procedural default; updated on real load
      uParallax: { value: 0.016 },
    };

    // Real-asset overrides. Cover-fit uses the loaded image's true aspect.
    const loader = new THREE.TextureLoader();
    if (imageSrc)
      loader.load(imageSrc, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        uniforms.uDay.value = t;
        if (t.image) uniforms.uImgAspect.value = t.image.width / t.image.height;
      });
    if (thermalSrc)
      loader.load(thermalSrc, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        uniforms.uThermal.value = t;
      });
    void depthSrc; // depth map not needed for real photos (uniform parallax)

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uDay, uThermal;
        uniform vec2 uMouse, uMouseUV, uRes;
        uniform float uHover, uTime, uRadius, uImgAspect, uParallax;

        void main(){
          // cover-fit the image to the card without distortion
          float viewAspect = uRes.x / uRes.y;
          vec2 uv = vUv;
          if (viewAspect > uImgAspect) {
            uv.y = (uv.y - 0.5) * (uImgAspect / viewAspect) + 0.5;
          } else {
            uv.x = (uv.x - 0.5) * (viewAspect / uImgAspect) + 0.5;
          }
          // 2.5D parallax: whole image drifts a little with the cursor
          uv += uMouse * uParallax;

          vec3 day = texture2D(uDay, uv).rgb;
          vec3 therm = texture2D(uThermal, uv).rgb;

          // screen-space lens circle around the cursor
          vec2 sdiff = vUv - uMouseUV;
          sdiff.x *= viewAspect;
          float dist = length(sdiff);
          float mask = smoothstep(uRadius, uRadius * 0.7, dist) * uHover;

          vec3 col = mix(day, therm, mask);

          // bright scan ring at the lens edge
          float ring = (1.0 - smoothstep(0.0, uRadius * 0.05, abs(dist - uRadius))) * uHover;
          col += ring * vec3(1.0, 0.95, 0.7) * 0.55;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const scene = new THREE.Scene();
    const cam = new THREE.Camera();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0, hover: 0, thover: 0 };
    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      pointer.tx = nx * 2 - 1;
      pointer.ty = -(ny * 2 - 1);
      uniforms.uMouseUV.value.set(nx, 1 - ny);
      pointer.thover = 1;
    };
    const onLeave = () => { pointer.thover = 0; };
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerleave', onLeave);

    let inView = true;
    const io = new IntersectionObserver((en) => { inView = en[0].isIntersecting; }, { threshold: 0.02 });
    io.observe(wrap);

    const resize = () => {
      const w = wrap.clientWidth,
        h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!inView) return;
      uniforms.uTime.value = clock.getElapsedTime();

      // ease pointer + hover
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      pointer.hover += (pointer.thover - pointer.hover) * 0.08;
      uniforms.uMouse.value.set(pointer.x, pointer.y);
      uniforms.uHover.value = pointer.hover;

      renderer.render(scene, cam);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerleave', onLeave);
      io.disconnect();
      quad.geometry.dispose();
      material.dispose();
      uDay.dispose();
      uThermal.dispose();
      renderer.dispose();
    };
  }, [imageSrc, thermalSrc, depthSrc]);

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default ThermalTerrain;
