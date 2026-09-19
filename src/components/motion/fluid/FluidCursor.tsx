'use client';

/* Refractive cursor lens.

   A fluid simulation used as a sheet of clear material rather than as ink. It
   has no colour of its own: every frame it reads the page's current background
   and foreground and shades itself from those, and it flips between darkening
   and lightening depending on whether it is currently over a light or dark
   part of the page. That is what keeps it feeling like part of the page rather
   than an effect layered on top.

   Skips entirely — no canvas mounted — under prefers-reduced-motion, on coarse
   pointers, or where WebGL2 / float render targets are unavailable.
*/

import React, { useEffect, useRef } from 'react';
import { createFluid, DEFAULT_CONFIG, type Fluid, type FluidConfig } from './solver';

export interface FluidCursorProps {
  /** How hard pointer movement pushes the fluid. */
  force?: number;
  /** Overall visibility of the lens. 1 is subtle by design. */
  strength?: number;
  /** Element whose computed colours drive the lens. Defaults to `.home`. */
  sampleSelector?: string;
  className?: string;
  config?: Partial<FluidConfig>;
}

/** sRGB relative luminance — decides whether the lens lightens or darkens. */
function luminance(rgb: [number, number, number]) {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

export const FluidCursor: React.FC<FluidCursorProps> = ({
  force = 5200,
  strength = 1,
  sampleSelector = '.home',
  className = '',
  config,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduced || coarse) return;

    const fluid: Fluid | null = createFluid(canvas, { ...DEFAULT_CONFIG, ...config });
    if (!fluid) {
      canvas.style.display = 'none';
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    fluid.resize(window.innerWidth, window.innerHeight, dpr);

    /* Resolving a computed colour to RGB needs a paint; a 1x1 canvas is the
       cheapest reliable way and handles oklab()/color-mix() for free. */
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const pctx = probe.getContext('2d', { willReadFrequently: true })!;
    const resolve = (color: string): [number, number, number] => {
      pctx.clearRect(0, 0, 1, 1);
      pctx.fillStyle = '#808080';
      pctx.fillStyle = color;
      pctx.fillRect(0, 0, 1, 1);
      const d = pctx.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255];
    };

    let lastSample = 0;
    let clientX = -1;
    let clientY = -1;
    /* Eased so the lens does not snap when the cursor crosses a section edge. */
    let polarity = -1;
    const tint: [number, number, number] = [0.5, 0.5, 0.5];

    /* Walk up from the element under the cursor until something actually paints
       a background. A lens that decides light-or-dark once for the whole page
       is wrong wherever a section disagrees — over the near-black hero card it
       would darken, which just reads as murk. */
    const backdropUnderCursor = (): [number, number, number] | null => {
      if (clientX < 0) return null;
      let el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      while (el) {
        const cs = getComputedStyle(el);
        // A visible image counts as dark backdrop for our purposes.
        if (cs.backgroundImage !== 'none' || el.tagName === 'CANVAS' || el.tagName === 'IMG') {
          return null;
        }
        const bg = cs.backgroundColor;
        if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0')) {
          return resolve(bg);
        }
        el = el.parentElement;
      }
      return null;
    };

    const updateAppearance = (now: number) => {
      if (now - lastSample < 90) return;
      lastSample = now;

      const page = document.querySelector(sampleSelector) as HTMLElement | null;
      const pcs = getComputedStyle(page ?? document.body);
      const pageBg = resolve(pcs.backgroundColor);
      const pageFg = resolve(pcs.color);

      /* elementFromPoint returns null over canvases and images — the hero card
         is exactly that case, and it is dark, so fall back to dark there. */
      const under = backdropUnderCursor();
      const bg = under ?? [0.05, 0.05, 0.06];
      const targetPolarity = luminance(bg) < 0.4 ? 1 : -1;

      // Ease polarity so crossing a boundary is a fade, not a flip.
      polarity += (targetPolarity - polarity) * 0.18;

      const mix = 0.22;
      tint[0] = pageBg[0] + (pageFg[0] - pageBg[0]) * mix;
      tint[1] = pageBg[1] + (pageFg[1] - pageBg[1]) * mix;
      tint[2] = pageBg[2] + (pageFg[2] - pageBg[2]) * mix;

      fluid.setAppearance(tint, polarity, strength);
    };

    let lastX = 0;
    let lastY = 0;
    let seeded = false;
    let raf = 0;
    let last = performance.now();
    let idleFrames = 0;

    const onPointerMove = (e: PointerEvent) => {
      clientX = e.clientX;
      clientY = e.clientY;
      const x = e.clientX / window.innerWidth;
      const y = 1 - e.clientY / window.innerHeight;

      if (!seeded) {
        lastX = x;
        lastY = y;
        seeded = true;
        return;
      }

      const dx = (x - lastX) * force;
      const dy = (y - lastY) * force;
      lastX = x;
      lastY = y;
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return;

      idleFrames = 0;
      /* Thickness, not colour — the display pass reads only the red channel. */
      fluid.splat(x, y, dx, dy, [1, 1, 1]);
    };

    const onResize = () => fluid.resize(window.innerWidth, window.innerHeight, dpr);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      if (idleFrames < 120) {
        idleFrames++;
        updateAppearance(now);
        fluid.step(dt);
        fluid.render();
      }
      raf = requestAnimationFrame(frame);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      fluid.dispose();
    };
  }, [force, strength, sampleSelector, config]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[60] h-full w-full ${className}`}
    />
  );
};

export default FluidCursor;
