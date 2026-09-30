'use client';

/* ============================================================
   FieldSequence — the rendered push-in, scrubbed off scroll.

   An alternative to FieldScene for act one: same slot, same progress, no
   WebGL. The render is a camera move rather than a turntable — it starts
   far off at a high angle, arrives at the hero three-quarter around frame
   33, and finishes inside the tank lid — so it is a fall TOWARD the machine
   rather than a machine turning in place.

   Drawn to a canvas rather than swapping <img> elements. Sixty-six images
   toggling display is sixty-six chances for the browser to decode late and
   show a hole; one canvas that has every frame decoded in memory before it
   is asked to paint cannot. It is also the only way to hold the last good
   frame if a fetch fails, instead of blanking.

   Every frame is decoded up front and the component reports its progress,
   so the page's existing loader counts this in exactly as it counted the
   GLB — a sequence that streams in while the reader scrolls is worse than
   one they waited a moment for.
   ============================================================ */

import React, { useEffect, useImperativeHandle, useRef } from 'react';

export type FieldSequenceHandle = { setProgress: (t: number) => void };

/* Exported because the BUILD-TIER choice is solved against exactly these
   numbers. Keeping a private copy in FieldHero is how the two drift, and
   when they drift the symptom is a sequence that looks soft for reasons
   nothing in either file explains. */
export const FIRST_W = 0.19;
export const FIRST_FIT = 0.6;

type Props = {
  ref?: React.Ref<FieldSequenceHandle>;
  /** Folder under /sequence, e.g. 'hero'. */
  name?: string;
  frames?: number;
  /** File extension of the frames. 'png' ships the render untouched — see
   *  scripts/build-sequence.mjs. 'webp' is the compressed build. */
  ext?: 'webp' | 'png';
  /** CANCELS A DRIFT BAKED INTO THE FRAMES, as a fraction of frame width
   *  at the LAST frame. Negative means the subject ends left of centre.
   *
   *  The end sequence needs it. Measured off the frames with an
   *  alpha-weighted centroid: frame 0 sits dead centre (-0.03%), and from
   *  about frame 8 the aircraft slides left, monotonically, to -3.91% by
   *  frame 39 — so the act ends with the aircraft visibly off to one side
   *  under a headline that is centred. The same figure comes back off all
   *  three tiers (-3.91 / -3.89 / -3.88%), which is what says it is in the
   *  render rather than in the encode.
   *
   *  The correction ramps LINEARLY with the frame index rather than
   *  following that curve exactly. It is a per-frame lookup table
   *  otherwise, for a worst case of about 0.8% of width near frame 8 —
   *  three pixels on a phone, against a real 3.91% at the end where the
   *  reader actually stops. Fix the render and this goes back to 0. */
  driftX?: number;
  /** 0..1 as the frames decode. */
  onProgress?: (f: number) => void;
  onReady?: () => void;
};

export const FieldSequence: React.FC<Props> = ({
  ref,
  name = 'hero',
  frames = 66,
  ext = 'webp',
  driftX = 0,
  onProgress,
  onReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<HTMLImageElement[]>([]);
  const ready = useRef(false);
  const current = useRef(-1);
  /* Held so a resize can repaint the frame the scroll is actually on.
     Without it the canvas clears on resize and stays blank until the next
     scroll event — which, at rest, may never come. */
  const shown = useRef(0);

  /* The aircraft's size in the FIRST frame, as a fraction of the frame:
     19.0% of the width, 36.5% of the height. Measured off the export, and
     identical across all three build tiers because they are the same crop
     at different resolutions. RE-MEASURE AFTER A NEW EXPORT. */


  /* What that first frame should occupy on a narrow screen. */


  /* Cover, with a NARROW-SCREEN baseline anchored on the opening frame.
  
     Two wrong answers came before this one, and both are instructive.
  
     Plain cover: the render is 16:9, so on a portrait canvas it scales by
     HEIGHT and the horizontal crop eats the aircraft rather than the empty
     margin. The subject overshot a phone by 172%.
  
     Then a cap solved against the WIDEST frame — 71% of frame width, at
     frame 60. It fitted, and it broke the shot: this sequence is a push-in
     that ends inside the tank lid, so growing past the edge at the end is
     the intent, not a fault. Sizing the whole sequence so its biggest frame
     fits left the OPENING frame at about 16% of the screen — a speck.
  
     The scale is one number for the whole sequence, never per-frame: all
     the growth lives in the frames themselves, and rescaling per frame
     would cancel the very move it exists to carry. So the only question is
     which frame to anchor it on, and the answer is the one the reader
     arrives on. Frame 0 at 60% of the width; everything after grows from
     there and is meant to.
  
     Wide screens keep plain cover — the baseline only takes over when it is
     SMALLER, which is exactly the case where cover was cropping the
     aircraft. */
  const paint = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number, t: number) => {
    /* The canvas is sized to innerWidth x dpr, so the frame is essentially
       never drawn at 1:1 — on a 2x display it is enlarged whatever the
       source width is. That makes the RESAMPLER part of the image quality,
       and its default is `low`, which is a cheap bilinear filter and looks
       exactly like the haze you get from a source that is too small.
       Setting it here rather than once at context creation because the
       property is reset whenever the canvas is resized, which this
       component does on every window resize. */
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cover = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const baseline = (cw * FIRST_FIT) / (FIRST_W * img.naturalWidth);
    const scale = Math.min(cover, baseline);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    /* Centred, then pulled back by however far the frames have drifted by
       this point. Scaled by `w`, not by `cw`: the offset was measured as a
       fraction of the FRAME, so it has to travel with the frame's drawn
       width or the correction would change every time the fit does. */
    ctx.drawImage(img, (cw - w) / 2 - driftX * w * t, (ch - h) / 2, w, h);
  };

  /* One frame, no blending.

     This cross-faded the two frames an index fell between, to soften the
     stepping. It is gone: dissolving two positions of the same object
     gives a double image on every hard edge — the propeller tips worst of
     all, where the two are furthest apart — and that reads as a cheap
     effect rather than as motion. A clean step is better than a soft
     wrong one.

     Stepping is a sampling problem and it gets fixed by sampling: act one
     was lengthened to 950vh so a wheel notch advances about one frame, and
     the real answer is more frames out of the render. */
  const draw = (i: number) => {
    const canvas = canvasRef.current;
    const img = imgs.current[i];
    if (!canvas || !img?.complete || !img.naturalWidth) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paint(ctx, img, canvas.width, canvas.height, frames > 1 ? i / (frames - 1) : 1);
    current.current = i;
  };

  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    /* Capped at 2, like the WebGL renderer. A 3x phone would otherwise ask
       the compositor for nine times the pixels for no visible gain. */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    draw(current.current < 0 ? 0 : current.current);
  };

  useEffect(() => {
    let alive = true;
    let done = 0;

    const settle = () => {
      if (!alive) return;
      done += 1;
      onProgress?.(done / frames);
      if (done === frames) {
        ready.current = true;
        draw(Math.round(shown.current * (frames - 1)));
        onReady?.();
      }
    };

    for (let i = 0; i < frames; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = `/sequence/${name}/${String(i).padStart(4, '0')}.${ext}`;
      /* onerror counts too. A missing frame should cost one still image,
         not a loader that never reaches 100 and a curtain that never
         lifts — the page failing open is worth more than the frame. */
      img.onload = settle;
      img.onerror = settle;
      imgs.current[i] = img;
    }

    resize();
    window.addEventListener('resize', resize);
    return () => {
      alive = false;
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, frames, ext]);

  useImperativeHandle(ref, () => ({
    setProgress: (t: number) => {
      shown.current = t;
      if (!ready.current) return;
      const i = Math.max(0, Math.min(frames - 1, Math.round(t * (frames - 1))));
      /* Only when the index actually changes. Most scroll events land on
         the frame already painted, and redrawing it is a full-viewport
         blit for nothing. */
      if (i !== current.current) draw(i);
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full"
      aria-hidden
    />
  );
};
