'use client';

/* ============================================================
   FieldBench — act three. The airframe on a workshop bench.

   Layout is oryzo's #features, read off their DOM at 1920x889 rather than
   eyeballed: a 432px copy column inset 60px from the left, an icon at y=133,
   a kicker at y=241, body copy from y=286 in 32px lines, a dashed rule at
   y=654, and a two-line title from y=700 in 45px lines. Expressed here as
   fractions of the viewport so the composition survives other screens.

   Three panels share that column and swap. Oryzo swaps them hard —
   visibility toggles with a short opacity fade, never a crossfade — and
   their dashed rules draw once and STAY drawn, which is what stops the
   section reading as three separate slides.

   Where this departs from them, deliberately:

   The background is a MULTIPLANE stack of photographic layers, not a WebGL
   set. Same silhouette, different machine. That costs one thing worth
   naming: oryzo's soft left edge is real depth-of-field rendered in their
   3D scene, and flat layers cannot produce it, so the blur and the wash
   under the copy are supplied here in CSS. Without them the type sits on a
   busy photograph and loses its counters.

   Driven imperatively from FieldHero's single scroll scalar — a progress
   prop would re-render this tree every frame for transforms React has no
   stake in.
   ============================================================ */

import type { ProductPage } from './product';
import React, { useImperativeHandle, useRef } from 'react';
import Image from 'next/image';
import { clamp01, lerp, smoothstep, ZOOM_HOLD } from './beats';
import { GATE_H, GATE_W, gateUnit } from './FieldGallery';
import styles from './Field.module.css';

/* ---- The backdrops -----------------------------------------------------
   One full-bleed image per panel. It fills the frame and it does not move.

   This was a multiplane stack that drifted with the scroll and answered the
   pointer. Both are gone, and dropping the motion is what lets the layers
   go with it: layers only mean something if they move at DIFFERENT rates,
   so a stack that never moves is three images stacked on top of each other
   with only the top one visible. Once nothing translates there is also
   nothing to overscan for, which is what was pushing each photograph out of
   the composition it had been shot for.

   So each panel gets one picture, at object-cover, exactly the size of the
   frame. The only thing that ever happens to it is that it is replaced.

   PLACEHOLDER ART, like the rest of this section. */
/* Flip to false to go straight back to stills. Everything else is shared —
   the wipe, the stacking, the timing — so this is a genuine A/B, not two
   code paths. See the video block below for what it actually costs. */
const USE_VIDEO_PLATES = true;

/* `video` is optional. A plate without one falls back to its still even
   while the flag is on, so this can be adopted a panel at a time. The still
   also serves as the poster, which is what covers the gap before the first
   frame decodes — without it the panel opens on black.

   These point at /videos/bench/, which are CROPPED builds: 1316x1080 at
   30fps, the right 68.5% of the original frame. The copy column's panel is
   opaque, so the left 31.5% of these clips can never be seen and there was
   no reason to ship it. The originals in /videos/ are untouched and still
   serve the P10 Pro product page full-frame — do not overwrite them.

   Rebuild with:
     ffmpeg -i public/videos/NAME.mp4 -vf "fps=30,crop=1316:1080:604:0"        -c:v libx264 -profile:v high -crf 26 -preset slow -pix_fmt yuv420p        -movflags +faststart -an public/videos/bench/NAME.mp4 */
/* Plates come from the product — see ProductPage.bench.plates. */


/* ---- The switch -------------------------------------------------------
   Each plate is wiped away as its panel's copy leaves, uncovering the next
   one sitting flat beneath it. The wipe travels along the diagonal, from
   the BOTTOM-LEFT corner to the TOP-RIGHT.

   A gradient mask, not a clip-path and not a rotation.

   Against clip-path: a polygon edge is a hard cut, and a hard cut on a
   diagonal staircases — the browser antialiases a clip boundary far worse
   than it interpolates a gradient. WIPE_EDGE gives the line a few percent
   of softness, which is what stops it reading as a jagged seam travelling
   across the picture.

   Against the rotation this replaces: a page turn is an object moving in
   depth, and it asks the reader to believe the photograph is a sheet of
   something. A wipe makes no such claim. It is one picture becoming
   another along a moving line, which is the whole of what this beat needs
   to say.

   `to top right` sets the gradient's axis from the bottom-left corner to
   the top-right one, so a single travelling stop pair sweeps exactly the
   diagonal asked for — no angle to compute, and it stays correct at any
   aspect ratio, which a hand-figured `Ndeg` would not.

   Plate 0 must paint ON TOP, so that it hides 1 and 2 until it is wiped,
   then 1 hides 2. That takes an explicit z-index and does not come free
   from DOM order — later siblings paint ABOVE earlier ones, which is the
   opposite. Written in array order without it, the LAST plate covers
   everything, the first two wipes happen invisibly underneath, and the
   section shows one picture for its whole length while the copy changes
   around it.

   Descending z-index, so the array still reads in the order the reader
   sees. A one-way sequence needs no other bookkeeping, and the reverse
   works for free when the reader scrolls back up. */
const WIPE_SPAN = 0.11;
/* Softness of the travelling line, as a percentage of the diagonal it runs
   along. The band is TWICE this — the stops sit at line-EDGE and line+EDGE.

   This was 9, which is an 18% band: roughly 400px of gradient on a 1920
   screen. On plates of similar brightness that reads as a soft wipe; on
   these it read as blur, because the plates it crosses are not similar at
   all. The night frame averages luminance 13 and the spray frame 198, so an
   18% band is 400px of everything in between, which is exactly what a
   motion-blurred smear looks like.

   0.2 gives a band of 0.4% — about 9px at a 2200px diagonal. Enough to
   antialias the line and no more.

   Not zero, and not clip-path. A hard boundary on a 45-degree edge
   staircases: browsers antialias a clip edge far worse than they
   interpolate a gradient, so the cheapest way to get a clean diagonal is a
   gradient with a very tight band, not an actual hard cut. If it ever looks
   jagged, raise this rather than reaching for clip-path. */
const WIPE_EDGE = 0.2;

/* ---- The panels --------------------------------------------------------
   Copy is a first pass. Each `desc` line is masked and revealed separately,
   so keep them as separate strings rather than one paragraph — the array IS
   the line breaking, and re-wrapping it changes the choreography. */
/* Panels come from the product — see ProductPage.bench.panels. */




/* Where each panel owns the column, on act three's clock.
   The last runs short of 1 so the section ends on the bench alone with the
   copy gone — oryzo does the same, and it is what gives the reader somewhere
   to arrive before the page moves on. */
const PANEL_SPAN = 0.22;
const PANEL_GAP = 0.02;

/* The footnote arrives as the last panel leaves, on the empty bench.

   This used to sit at 0.72 under a measured constraint that no longer
   holds, and the correction is worth recording because it silently freed
   the whole tail of the act. ScrollTrigger's scrub is asymptotic, and when
   act three was the last thing in the document its clock could only reach 1
   by coming to rest at maximum scroll — while actually scrolling, t never
   arrived, so anything keyed past ~0.78 was never seen. Adding the footer
   put 680px of ordinary page after the spacer. The timeline now ends 680px
   BEFORE the document does, so t reaches 1 mid-scroll with room to spare
   and the footer's height is holding room rather than a cliff.

   Measured at 1920x889, dev build: t = 0.81 at 94% of the timeline, 0.90 at
   97%, 0.999 at 100%. Re-measure if the footer's height changes — it is
   what pays for everything keyed after 0.78 below. */
const OUTRO = 0.70;

/* ---- The end card ------------------------------------------------------
   The section signs off. The bench turns over to the flat ground the page
   opened on — near-black with the warm corner low and to the left — and the
   product name lands on it.

   The ground and the type are on SEPARATE windows, overlapping but offset.
   Run them together and the name fades up through a photograph that is
   still dissolving behind it, which reads as two things happening at once
   in the same place; letting the ground get most of the way over first
   gives the type something settled to arrive on.

   Both finish by 0.92 rather than 1.0. The clock does reach 1 now, but it
   reaches it at the exact scroll position where the footer starts entering
   the viewport — so an end card keyed to 1.0 would be complete only for the
   instant before the footer covers it. Finishing at 0.92 leaves roughly
   320px of scroll holding the finished card, and the footer then rises over
   a composition that has already arrived.

   END_FROM is 0.82 and not earlier because of the FOOTNOTE, which is the
   real constraint on this whole window. It arrives over 0.70-0.76; start
   the exit at 0.78 and it is at full strength for about 82px of scroll,
   which is not a beat, it is a flash. 0.82 gives it 245px to be read in.
   Every number after it is downstream of that one. */
const END_FROM = 0.82;
const END_TO = 0.90;
const END_TYPE_FROM = 0.85;
const END_TYPE_TO = 0.92;



export type FieldBenchHandle = {
  /** t is 0..1 across act three — the panels and the parallax. */
  setProgress: (t: number) => void;
  /** z is 0..1 across ZOOM_WINDOW — the doorway opening out of the gate. */
  setZoom: (z: number) => void;
  /** Show at card size before the doorway opens, so the gallery's empty
   *  slot has something behind it the moment it starts entering the gate. */
  setArmed: (on: boolean) => void;
  /** Hard gate on the READER's position, independent of the timeline's. */
  setEnabled: (on: boolean) => void;
  /** 1 while act three owns the frame, falling to 0 as act four takes it.
   *  Fades the WHOLE section, not just the end card — see setOutro. */
  setOutro: (v: number) => void;
};

type Vars = React.CSSProperties & Record<`--${string}`, string>;

export const FieldBench: React.FC<{
  ref?: React.Ref<FieldBenchHandle>;
  /* NonNullable: the field is optional on ProductPage because a page can
     omit the act entirely, but this component only ever mounts when the
     act and its data are both present — see the guard in FieldHero. */
  bench: NonNullable<ProductPage['bench']>;
}> = ({ ref, bench }) => {
  /* Aliased to the names the body already uses. Renaming every reference
     would be a larger diff than the change deserves, and these two are the
     seam — everything below is unchanged. */
  const PLATES = bench.plates;
  const BENCH_PANELS = bench.panels;
  const N = BENCH_PANELS.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const plateRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(HTMLSpanElement | null)[][]>([]);
  const ruleRefs = useRef<(HTMLSpanElement | null)[]>([]);

  /* Two inputs, one render.

     This section is driven by two independent scalars — the doorway opening
     at the end of act two, and act three's own clock — and either can
     arrive without the other. Storing each in a ref and rendering from both
     is what keeps that honest: two setters each writing the whole element
     would race, and whichever fired second would undo the first. */
  const zoomRef = useRef(0);
  const tRef = useRef(0);
  /* Armed BEFORE the doorway opens.

     The gallery's last slot is empty and this section is what shows through
     it, so it has to already be behind that hole as the hole travels into
     the gate — otherwise the strip's final card arrives as a black gap and
     fills in afterwards. Gating visibility on the zoom alone was exactly
     that bug: the doorway starts on the frame the travel ENDS, which is a
     full card-width too late. */
  const armedRef = useRef(false);
  /* The reader-position gate. AND-ed, never OR-ed — see `live` below. */
  const enabledRef = useRef(true);

  const render = () => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const z = zoomRef.current;
    const t = tRef.current;

    /* Off the compositor AND out of the way until the doorway starts to
       open. Five full-bleed layers are not free to composite, and a
       hit-testing full-screen layer would swallow pointer events from
       everything beneath it for two thirds of the page.

       Hit testing waits for the doorway to be fully open — while this is
       still a card, the gallery underneath owns the frame. */
    /* AND, not OR, and that distinction is the whole fix.

       The three terms after it all ask the TIMELINE whether this section is
       in play, and the timeline trails the scroll — so after a jump from the
       bottom to the top it answers yes for a second or more while the reader
       is looking at the hero. Any one of them being true was enough to paint
       act three over act one.

       `enabled` asks where the reader actually is, so it can veto all of
       them. Ordered first so the cheap authoritative test short-circuits
       the rest. */
    const live = enabledRef.current && (armedRef.current || z > 0.0005 || t > 0.0005);
    root.style.visibility = live ? 'visible' : 'hidden';
    root.style.pointerEvents = z > 0.995 ? 'auto' : 'none';
    if (!live) return;

    /* ---- The doorway ---------------------------------------------------
       The clip box grows from the gate's exact rect to the whole viewport.
       Both are centred on the viewport, so only the size has to be
       interpolated and the centring takes care of itself.

       Deliberately NO fade. The section is revealed by its frame opening,
       and cross-fading as well would announce that two things are being
       swapped — which is precisely what the mechanic exists to hide. */
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    /* The SAME unit the gallery sizes its gate with, not raw vh.
    
       These two numbers describe one rectangle seen from two sides: the
       gallery draws the card, this grows out of it, and the handoff only
       reads as one object if both agree to the pixel. gateUnit caps 1vh by
       what the viewport width can carry, so on a phone raw vh is 30-40%
       too large — the doorway would start from a box bigger than the card
       the reader was just looking at, and the section would jump open. */
    const gu = gateUnit();
    const gw = GATE_W * gu;
    const gh = GATE_H * gu;

    /* The box does NOT start growing on the first frame of the doorway.

       It holds at card size while the side strips slide away, and only then
       opens. That pause is the whole beat: it leaves the last card sitting
       alone inside the dashed frame — the state the section is designed
       around — for a moment before the frame becomes the page. Growing from
       the instant the doorway starts runs the two moves together and the
       card never gets seen on its own.

       HOLD is a fraction of the doorway, not of the page, so widening
       ZOOM_WINDOW lengthens the pause and the opening in proportion. */
    const open = clamp01((z - ZOOM_HOLD) / (1 - ZOOM_HOLD));

    const w = lerp(gw, vw, open);
    const h = lerp(gh, vh, open);
    root.style.width = `${w.toFixed(2)}px`;
    root.style.height = `${h.toFixed(2)}px`;
    root.style.left = `${((vw - w) / 2).toFixed(2)}px`;
    root.style.top = `${((vh - h) / 2).toFixed(2)}px`;

    /* The stage is always laid out at full viewport size and scaled to
       COVER the clip box — never to fit it, or a landscape composition
       inside a portrait gate would letterbox.

       Cover is what sets the floor on the scale: the gate is 80vh tall, so
       the stage can never go below 0.8 and the whole travel is about 1.25x.
       That is why this needs none of oryzo's em-scaling — they magnify card
       contents 3.5x and would watch the type go soft, where 1.25x is
       invisible. The drama here is the clip opening 3.5x horizontally. */
    const cover = Math.max(gw / vw, gh / vh);
    const s = lerp(cover, 1, open);
    stage.style.transform = `translate(-50%, -50%) scale(${s.toFixed(4)})`;

    /* ---- Act three's own content ------------------------------------- */
    const wipes: number[] = [];
    for (let p = 0; p < PLATES.length; p++) {
      /* The flip is centred on the boundary BETWEEN two panels — the gap,
         not the end of a panel — so the picture changes while the column is
         empty rather than under copy that is still being read. The last
         plate never turns; there is nothing behind it. */
      const boundary = p * (PANEL_SPAN + PANEL_GAP) + PANEL_SPAN + PANEL_GAP / 2;
      const wipe =
        p === PLATES.length - 1
          ? 0
          : smoothstep(boundary - WIPE_SPAN / 2, boundary + WIPE_SPAN / 2, t);

      const plate = plateRefs.current[p];
      if (!plate) continue;

      /* The travelling stop pair, in gradient-axis percent.
         Overshot by WIPE_EDGE at BOTH ends, which is load-bearing rather
         than tidy: run it 0%->100% instead and at rest the soft half of
         the line still sits inside the picture, so plate 0 starts the
         section already half-erased along its bottom-left edge and plate 1
         shows through as a wash nobody asked for. Starting at -EDGE puts
         the whole gradient off the near corner, ending at 100+EDGE puts it
         off the far one, and only then is each end state truly clean. */
      const line = -WIPE_EDGE + wipe * (100 + 2 * WIPE_EDGE);
      const mask =
        `linear-gradient(to top right, transparent ${(line - WIPE_EDGE).toFixed(1)}%, ` +
        `#000 ${(line + WIPE_EDGE).toFixed(1)}%)`;
      plate.style.maskImage = mask;
      plate.style.webkitMaskImage = mask;
      // Off the compositor once it is fully out of the way.
      plate.style.visibility = wipe >= 1 ? 'hidden' : 'visible';

      wipes[p] = wipe;
    }

    /* Playback, decided in a SECOND pass because visibility is a property of
       the whole stack rather than of any one plate.

       Pausing only the plates that have been wiped AWAY is the obvious rule
       and it is wrong: it leaves every plate further down the stack running
       too, and those are behind an opaque sheet with nothing to show. It
       measured as two 1080p streams decoding to display one.

       What is actually on screen is the topmost plate that has not finished
       wiping — plus, while that one is mid-wipe, the plate directly beneath
       it, which is being revealed through the mask. Everything else is
       either gone or covered. So: find the first unfinished plate, and play
       exactly it and its successor.

       Paused rather than unmounted. Unmounting would make a scroll back up
       restart each clip from frame one, so the reader would see the video
       snap to its beginning every time they reversed. */
    const top = wipes.findIndex((w) => w < 1);
    for (let p = 0; p < PLATES.length; p++) {
      const vid = videoRefs.current[p];
      if (!vid) continue;
      const revealing = top >= 0 && wipes[top] > 0;
      const wanted = enabledRef.current && top >= 0 && (p === top || (revealing && p === top + 1));
      if (wanted && vid.paused) {
        /* play() rejects if the autoplay policy is unhappy, and a still
           poster is a perfectly good outcome — swallow it rather than
           throwing on every frame of the scroll. */
        void vid.play().catch(() => {});
      } else if (!wanted && !vid.paused) {
        vid.pause();
      }
    }

    /* The copy column is held back until the doorway is most of the way
       open. It sits at 3.15% of the stage, which while this is a card is
       outside the crop entirely — so the column is not merely hidden, it is
       off-frame, and bringing it up as the frame reaches it is what makes
       the reveal read as space opening rather than as text arriving. */
    const copyIn = smoothstep(0.62, 0.95, open);

    /* Panels. Hard ownership of the column — one panel at a time, with a
       short fade at each edge rather than a crossfade. Two sets of body
       copy dissolving through each other is unreadable, and oryzo does not
       do it either. */
    {
      for (let i = 0; i < N; i++) {
        const start = i * (PANEL_SPAN + PANEL_GAP);
        const end = start + PANEL_SPAN;
        const inFade = smoothstep(start, start + 0.05, t);
        const outFade = 1 - smoothstep(end - 0.04, end, t);
        const live = Math.min(inFade, outFade) * copyIn;

        const panel = panelRefs.current[i];
        if (panel) {
          panel.style.opacity = live.toFixed(3);
          // Kept out of the a11y tree and off the compositor when not in play.
          panel.style.visibility = live < 0.002 ? 'hidden' : 'visible';
        }

        /* Body copy writes itself in line by line, each line rising out of
           its own clip. Local progress, so every panel reveals at the same
           rate regardless of where it sits in the section. */
        const local = clamp01((t - start) / PANEL_SPAN);
        const lines = lineRefs.current[i] || [];
        for (let l = 0; l < lines.length; l++) {
          const el = lines[l];
          if (!el) continue;
          const from = 0.08 + l * 0.045;
          const k = smoothstep(from, from + 0.14, local);
          el.style.transform = `translate3d(0, ${((1 - k) * 100).toFixed(2)}%, 0)`;
          el.style.opacity = k.toFixed(3);
        }

        /* The rule draws once and stays. Latched on the maximum rather than
           bound to `local`, so scrolling back up does not unwrite it —
           oryzo's stay drawn too, and a rule that retracts reads as an
           undo rather than as a section you have already read. */
        const rule = ruleRefs.current[i];
        if (rule) {
          const drawn = smoothstep(0.1, 0.42, local);
          const held = Math.max(parseFloat(rule.dataset.drawn || '0'), drawn);
          rule.dataset.drawn = String(held);
          rule.style.transform = `scaleX(${held.toFixed(3)})`;
        }
      }

    }

    /* Act three's own clock, published. Nothing reads it in the page — it
       is here so the reachable tail can be MEASURED rather than guessed at,
       which is what the OUTRO comment above had to do. */
    root.style.setProperty('--t', t.toFixed(4));

    /* The end card, and the exit that clears the way for it. */
    const end = smoothstep(END_FROM, END_TO, t);
    root.style.setProperty('--end', (end * copyIn).toFixed(3));
    root.style.setProperty(
      '--end-type',
      (smoothstep(END_TYPE_FROM, END_TYPE_TO, t) * copyIn).toFixed(3)
    );

    /* The wash only makes sense once there is a column for it to protect —
       and it is the first thing to go when there stops being one. Faded on
       `end` rather than left for the end card to cover, because it is
       backdrop-filter: a pane of glass that vanished under a black scrim
       would still be blurring the ground behind it right up to the moment
       it was hidden, and the blur reads through. */
    root.style.setProperty('--wash', (copyIn * (1 - end)).toFixed(3));
    /* The footnote arrives once the panels are done, and leaves with the
       rest of the copy. */
    root.style.setProperty(
      '--outro',
      (smoothstep(OUTRO, OUTRO + 0.06, t) * copyIn * (1 - end)).toFixed(3)
    );
  };

  useImperativeHandle(ref, () => ({
    setProgress: (t: number) => {
      tRef.current = t;
      render();
    },
    setZoom: (z: number) => {
      zoomRef.current = z;
      render();
    },
    setArmed: (on: boolean) => {
      if (armedRef.current === on) return;
      armedRef.current = on;
      render();
    },
    /* Fades the entire section out, root and all.
   
       Fading only the end card would be the obvious reading of "the card
       leaves" and would be wrong: the card is an opaque ground laid OVER
       the plates, and taking it away uncovers the last bench photograph
       rather than revealing what is behind the section. Act four needs the
       hero's own layers, twenty screens down the z-order — so the section
       itself has to go, in one piece, with the card still on top of its own
       photographs the whole way down. */
    setOutro: (v: number) => {
      const root = rootRef.current;
      if (root) root.style.opacity = v.toFixed(3);
    },
    setEnabled: (on: boolean) => {
      if (enabledRef.current === on) return;
      enabledRef.current = on;
      /* display, NOT visibility.

         visibility is the one inherited property a descendant can turn back
         ON: a child with `visibility: visible` re-appears even though its
         parent is hidden. This section's plates set exactly that, every
         frame, to manage the flip — so a root-level `visibility: hidden`
         was being overridden from inside and the picture kept painting.
         display has no such escape hatch. */
      const root = rootRef.current;
      if (root) root.style.display = on ? '' : 'none';
      render();
    },
  }));

  return (
    <div
      ref={rootRef}
      /* A CLIP BOX, not a full-bleed layer. Its rect is written every frame
         and grows from the gallery's gate to the whole viewport, and the
         overflow:hidden on it is the crop that turns that growth into a
         frame opening rather than an object inflating. */
      className="pointer-events-none invisible fixed z-[9] overflow-hidden"
      style={{ '--outro': '0', '--wash': '0', '--end': '0', '--end-type': '0' } as Vars}
    >
      {/* The stage. Always laid out at full viewport size regardless of the
          clip box around it, and scaled to cover it. Everything below is
          therefore composed once, for the finished section, and never
          reflows as the doorway opens — only the window onto it changes. */}
      <div
        ref={stageRef}
        className="absolute left-1/2 top-1/2 h-screen w-screen will-change-transform"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
      {/* The plates. First on top, so each one hides those behind it until
          it has been wiped — see WIPE_SPAN.

          `isolate` is load-bearing, not decoration. The plates carry
          z-index 3/2/1 to order themselves, and those numbers must mean
          something only IN HERE — the wash and the copy column are
          siblings below this div at z-index auto, so without a stacking
          context of its own the plates win against them and paint over
          the text. This used to be supplied accidentally by
          `perspective`, which creates a stacking context as a side
          effect; when the page turn was replaced by the wipe the
          perspective went with it and took the containment along. Stating
          it outright is what stops the same thing happening again. */}
      <div className="absolute inset-0 isolate overflow-hidden bg-[#0d1009]" aria-hidden>
        {PLATES.map((plate, p) => (
          <div
            key={plate.key}
            ref={(el) => {
              plateRefs.current[p] = el;
            }}
            className="absolute inset-0"
            style={{
              // First plate on top — see WIPE_SPAN. Not DOM order's default.
              zIndex: PLATES.length - p,
              willChange: 'mask-image',
            }}
          >
            {/* No overscan and no transform of its own. Nothing
                translates, so the picture is exactly the frame and cannot
                slide out of it.

                The video path is the same box with the same object-cover —
                the mask, the z-index and the timing above do not know or
                care which one is mounted, which is what makes the flag a
                real comparison rather than a second implementation.

                muted + playsInline are not optional: without both, autoplay
                is refused outright on iOS and by Chrome's policy, and the
                panel silently shows its poster forever. preload="none"
                keeps three 1080p files off the wire until the section is
                actually reached — this is the third act, nineteen screens
                down, and eating 16MB during the hero's load would undo the
                work that went into that curtain. */}
            {USE_VIDEO_PLATES && plate.video ? (
              <video
                ref={(el) => {
                  videoRefs.current[p] = el;
                }}
                src={plate.video}
                poster={plate.src}
                muted
                loop
                playsInline
                preload="none"
                aria-label={plate.alt}
                /* Inset to the right 68.5%, NOT full-bleed — these clips
                   are cropped to exactly that region, so stretching them
                   across the whole stage would squash them horizontally.
                   The still fallback below stays full-bleed because it is
                   uncropped, and the panel simply covers its left third.

                   Sized with an explicit w-[68.5%], NOT left+right and
                   w-auto. A <video> is a replaced element: `width: auto`
                   resolves to its INTRINSIC size, not to the box its left
                   and right offsets describe, so before the metadata loads
                   videoWidth is 0 and the element collapses — measured at
                   left: -237px with a zero-width box. Stating the width
                   makes the layout independent of load order. */
                /* Full width on narrow: the panel is a bottom band there,
                   so the clip has the whole stage and object-cover crops it
                   to the portrait frame. The 68.5% inset only means
                   something once the panel is a left column again. */
                className="absolute inset-x-0 top-0 h-[48%] w-full object-cover md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[68.5%]"
              />
            ) : (
              <Image
                src={plate.src}
                alt={plate.alt}
                fill
                sizes="100vw"
                className="object-cover"
                /* Pulled toward the top on narrow so the subject sits in the
                   half the panel leaves rather than behind the copy. */
                style={{ objectPosition: '50% 30%' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* The wash under the copy column.

          This is the one thing the layer stack cannot give us. Oryzo's left
          edge is soft because their scene is genuinely out of focus there;
          flat photographs are sharp everywhere, so the separation has to be
          manufactured. */}
      <div className={styles.benchWash} aria-hidden />

      {/* Copy column. 60/1920 = 3.15% left, matching the axis the kicker and
          the lockup already use earlier in the page. */}
      {/* Copy column. Bottom half on narrow, left column from md up.
      
          Its children are positioned in PERCENTAGES of this box — icon at
          15%, body at 32.2%, rule at 73.6%, title at 78.7% — so the whole
          arrangement rescales with it and none of those numbers need a
          breakpoint of their own. That is the payoff for having measured
          them as fractions rather than in px. */}
      <div className="absolute inset-x-[6%] bottom-[4%] top-[52%] md:inset-x-auto md:inset-y-0 md:left-[3.15%] md:w-[min(82vw,max(22.5vw,240px))]">
        {BENCH_PANELS.map((p, i) => (
          <div
            key={p.key}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            className="absolute inset-0 opacity-0"
          >
            {/* Icon, at 133/889 = 15% down. */}
            <span
              className="absolute top-[15%] flex size-[clamp(38px,3.1vw,60px)] items-center justify-center rounded-full border border-[#f2ecd9]/35 text-[clamp(14px,1.1vw,21px)]"
              aria-hidden
            >
              {p.icon}
            </span>

            {/* Kicker at 241/889 = 27.1%. */}
            <p className="absolute top-[27.1%] font-display text-[clamp(13px,1.15vw,22px)] uppercase tracking-[0.06em]">
              {p.kicker}
            </p>

            {/* Body from 286/889 = 32.2%, in 32px lines = 3.6vh.

                Each line is a clip with a span inside it. The clip is what
                makes the line rise out of nothing instead of fading in
                place, and it has to be a separate element from the thing
                that moves — a single element cannot both mask and travel. */}
            <div className="absolute top-[32.2%] text-[clamp(14px,1.12vw,21px)] leading-[1.55]">
              {p.desc.map((line, l) => (
                <span key={l} className="block overflow-hidden">
                  <span
                    ref={(el) => {
                      (lineRefs.current[i] ||= [])[l] = el;
                    }}
                    className="block will-change-transform"
                  >
                    {line}
                  </span>
                </span>
              ))}
            </div>

            {/* The rule at 654/889 = 73.6%. A repeating gradient, not an
                SVG or a border — oryzo's is the same, and it is the only
                way to get an evenly-dashed line that can be scaled on one
                axis without the dashes stretching with it. */}
            <span
              ref={(el) => {
                ruleRefs.current[i] = el;
              }}
              className={styles.benchRule}
              aria-hidden
            />

            {/* Title from 700/889 = 78.7%. */}
            <h3 className="absolute top-[78.7%] font-display text-[clamp(26px,2.55vw,49px)] normal-case leading-[1.05] tracking-[-0.02em]">
              {p.title.map((line, l) => (
                <span key={l} className="block">
                  {line}
                </span>
              ))}
            </h3>
          </div>
        ))}
      </div>

      {/* Footnote and its equation, bottom right — oryzo's "Constant lift
          via geometry / Δh ≈ t". Arrives last, on the empty bench. */}
      <div
        className="absolute bottom-[7%] right-[3.15%] flex items-end gap-[clamp(14px,1.6vw,32px)]"
        style={{ opacity: 'var(--outro, 0)' }}
      >
        <span className="pb-[0.35em] font-display text-[clamp(10px,0.78vw,15px)] font-bold uppercase tracking-[0.1em] opacity-70">
          Swap time per module
        </span>
        <span className="font-display text-[clamp(24px,2.2vw,42px)] leading-none tracking-[-0.01em]">
          t&nbsp;&asymp;&nbsp;90s
        </span>
        </div>

      {/* The end card's ground. Last in the stage, so it paints over the
          plates, the wash and the copy without needing a z-index of its
          own — the one place in this component where DOM order is doing
          the stacking on purpose. */}
      <div className={styles.benchEnd} aria-hidden />

      {/* The name. Rises a couple of vh as it arrives rather than fading
          in place: a static fade at this size reads as an image loading.
          The travel is expressed against --end-type in calc so the type
          and its own opacity cannot drift apart — one variable drives
          both, and there is no second timeline to keep in step. */}
      <div
        className="absolute inset-0 grid place-items-center"
        style={{
          opacity: 'var(--end-type, 0)',
          transform: 'translate3d(0, calc((1 - var(--end-type, 0)) * 2.4vh), 0)',
        }}
      >
        <p className="font-display text-[clamp(56px,10.5vw,200px)] uppercase leading-[0.9] tracking-[-0.035em]">
          P10&nbsp;Pro
        </p>
      </div>
      </div>
    </div>
  );
};
