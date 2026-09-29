'use client';

/* ============================================================
   FlightPreview — the scrolling shell around FlightScene.

   The canvas is fixed and never moves; this provides the scroll distance
   and the text. Copy is real DOM over the canvas, not drawn into it, for
   the same reason the ink hero's is: a hero that looks like one rendered
   image should still be readable to a crawler and a screen reader.

   Scroll is read straight from window.scrollY into a ref, and the scene
   reads that ref inside its own rAF. Deliberately NOT React state —
   putting scroll in state re-renders the tree at 60fps for no reason, and
   the reference site sidesteps the same trap by reading its store with
   getState() inside useFrame rather than subscribing to it.
   ============================================================ */

import React, { useEffect, useRef, useState } from 'react';
import { FlightScene } from './FlightScene';
import { ClipStage } from './ClipStage';
import { FLIGHT, SCENES, TRANSITION_SEC, clamp01 } from './flightBeats';
import styles from './FlightPreview.module.css';

export interface FlightPreviewProps {
  /* Forwarded to FlightScene. Off everywhere except /preview/trees, which
     is the only route that turns it on — see the note on the prop there. */
  photoreal?: boolean;
  /* Plays the approach beat as a LOOPED VIDEO instead of rendering it.

     Same isolation as `photoreal`: default off, and only /preview/trees
     turns it on, so the homepage keeps the real-time scene while this is
     being judged. The video is a 120-frame Blender loop — verified
     seamless, the 120→1 wrap measuring 29.22/255 against a 27.6–28.5
     one-frame baseline — so it is autoplayed and left to run rather than
     scrubbed. Scroll does not drive it; scroll only hands off to the
     scene behind it at the approach/transit boundary. */
  videoFirst?: boolean;
}

/* Anchors are fractions of THE PLATE, not of the stage — see the Plate type
   below, which now carries a set per picture.

   THE THERMAL VIEW COMES UP INSIDE THE BOX, not in a separate panel: once
   the frame has drawn, what the sensor sees fills it, cover-fitted and
   centred. */

/* How long the camera takes to reach the survey station — read from the
   beat rather than written down again.

   The plate has to be opaque on the frame that move ends, or the shot
   shows the framing it exists to hide. That was two copies of the same
   number in two files; deriving it means retiming the transition retimes
   the cover automatically. */
const COVER_SEC = SCENES.find((sc) => sc.id === 'survey')?.enterSec ?? TRANSITION_SEC;

/* TWO PLATES, because one composition cannot serve both stages.

   The stills box is the whole viewport, so its shape is the window's: 1.78
   on a laptop, 0.46 on a phone. Cover-fitting the 1.78 landscape plate onto
   a 0.46 stage throws away three quarters of its width, and what it throws
   away first is the sides — where this composition keeps its aircraft.

   Each plate therefore carries its own pixel size AND its own anchors,
   because the anchors are measurements of a particular picture and mean
   nothing applied to another one. */
type Plate = {
  src: string;
  /* The still's own pixel size, which the cover maths is undone against. */
  w: number;
  h: number;
  /* Where cover's horizontal overflow is taken from. 'center' splits it,
     which is the browser default and right for a plate whose subject is
     inboard. 'left' pins the left edge, for one whose subject is ON it. */
  originX: 'center' | 'left';
  /* THE SENSOR OVERLAY, AND IT IS OPTIONAL — because the lines have to
     leave from an aircraft, and a plate without one has nowhere to start
     them. Absent means the whole overlay stays dark: no lines, no frame,
     no thermal view. Present, and all three anchors are fractions of THIS
     plate, which is the only space they mean anything in. */
  sensor?: {
    /* The sensor on top of the Mini — the lines leave from the sensor, not
       from the middle of the airframe. */
    drone: [number, number];
    /* What the sensor frames. A LANDSCAPE rectangle at the thermal image's
       own 1.61:1, so the view inside it crops nothing. */
    lock: { x0: number; y0: number; x1: number; y1: number };
    /* Whether the thermal view comes up inside the frame. */
    thermal: boolean;
  };
};

/* THE WIDE PLATE, survey-base.webp, 1672x941: the Mini low on the left
   looking up a stream valley at a small settlement at its head. Anchors
   read off a 20px grid laid over that image, not eyeballed:

     drone  the white dome on top of the Mini, at (377, 642).
     lock   the settlement's buildings sit at 870-935 x 330-355 with the red
            roof at (920, 335). The box is 755-1055 x 240-426: 300 x 186 at
            1.61:1, centred where the sketched square was centred. It was
            that near-square 795-1015 x 225-440 first, which cropped the
            sides off the thermal view to fill it. */
const PLATE_WIDE: Plate = {
  src: '/images/survey-base.webp',
  w: 1672,
  h: 941,
  originX: 'center',
  sensor: {
    drone: [377 / 1672, 642 / 941],
    lock: { x0: 755 / 1672, y0: 240 / 941, x1: 1055 / 1672, y1: 426 / 941 },
    thermal: true,
  },
};

/* THE TALL PLATE, survey-base-mob.webp, 1440x2960: the site's own terrain,
   not a Blender render.

   Every plate before this was rendered elsewhere and had to be colour-
   matched to the live ground it dissolves in over — that is what
   scripts/build-survey-plate.mjs exists to do. This one was captured from
   the live three.js scene with the camera flattened to 30 degrees below
   horizontal (the survey look's own is 45) and the Mini placed in the
   near corner, so it IS the ground it hands over from and there is
   nothing to match. Master: scripts/source/survey-mob-plate.png.

   SHIPPED AT ITS NATIVE SIZE, deliberately. 0.486 is within a few percent
   of a phone's own 0.462, so cover crops about 5% off one side rather
   than the 19% the earlier 0.75 plates lost — and at 2960 tall it still
   has real pixels at 3x. 148KB, against the desktop plate's 275.

   Anchors read off a 100px grid laid over that image:

     drone  the dome on the airframe's top plate spans 100-128 x 2437-2465,
            so its centre is (114, 2451).
     lock   the valley floor, where two watercourses meet: the stream runs
            from about (700, 1010) through (860, 1080) to (1030, 1180),
            with the braided channel below it. The box is 740-1160 x
            1000-1261 — 420 x 261, the same 1.61:1 the wide plate's is —
            which holds the confluence.

            It sits well above the copy: at 390 the box lands at y 285-359
            of 844, and the survey card's text starts around 600. The card
            is ranged right on this beat while the aircraft is bottom
            LEFT, so the two do not fight either. */
const PLATE_TALL: Plate = {
  src: '/images/survey-base-mob.webp',
  w: 1440,
  h: 2960,
  /* The aircraft is in the leftmost 8% of the picture, so the 5% cover
     takes off the right, where there is only hillside. */
  originX: 'left',
  sensor: {
    drone: [114 / 1440, 2451 / 2960],
    lock: { x0: 740 / 1440, y0: 1000 / 2960, x1: 1160 / 1440, y1: 1261 / 2960 },
    /* THE DESKTOP'S OWN THERMAL VIEW, by request — survey-thermal.webp,
       the same render the wide plate puts inside its frame. */
    thermal: true,
  },
};

/* WHICH STAGE SHAPE THE TALL PLATE IS FOR — an aspect query, not a width
   one, because the crop is decided by shape and nothing else.

   This was (max-width: 860px). Measured, that handed the tall plate to a
   768x1024 tablet, whose stage is 0.75 against the plate's 0.486: cover
   then takes the difference off the TOP AND BOTTOM, and the aircraft —
   which lives in the bottom eighth — resolved to y 1030 in a 1024 stage.
   Off the screen, with the sensor lines leaving from nowhere.

   3/5 sits between a phone's 0.462 and that tablet's 0.75. A phone held
   sideways is 2.16 and also falls through to the wide plate, which is the
   right answer for it as well. */
const TALL_PLATE_MQ = '(max-aspect-ratio: 3/5)';

export const FlightPreview: React.FC<FlightPreviewProps> = ({
  photoreal = false,
  videoFirst = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  /* Where the aircraft and its footprint are on screen, and how far the
     find has closed. Written by the scene every frame; read here by a rAF
     that moves two dashed lines. Never state — see the note at the top of
     this file about scroll. */
  const stageRef = useRef<HTMLDivElement>(null);

  /* Which scene has SETTLED. Driven by the scene's own state machine, not
     by scroll — scroll only fires a transition, and the copy should change
     when the picture has finished changing, not while it is moving.
     Reading it off scroll made the words swap mid-move, which read as the
     text being early rather than as a cut. */
  const [scene, setScene] = useState(0);

  /* WHICH PLATE THE SURVEY BEAT USES. State, because the <img> src is
     rendered; a ref beside it, because the anchor maths runs in the rAF
     below and must not wait for a render to agree with what is on screen.

     Starts WIDE on both server and client, so hydration matches, and
     swaps in the effect. The plate is not on screen until deep into the
     section, so nothing is visible during that one frame. */
  const [plate, setPlate] = useState<Plate>(PLATE_WIDE);
  const plateRef = useRef<Plate>(PLATE_WIDE);

  /* ITS OWN LOOP, not the scroll handler's.

     This was driven from the scroll rAF, which is wrong for the same
     reason the transition is not scroll-driven: the move lands 1.6s after
     the scroll that fired it, and by then there are no more scroll events
     to repaint on. The plate only appeared if you happened to scroll
     again, and a jump to the end never revealed it at all — the section
     finished on the live render with both plates at zero.

     Two style writes a frame, and it early-outs when the section is off
     screen, so running it always costs nothing worth measuring. */
  /* THE SECTION'S LAST BEAT IS A PICTURE.

     Survey no longer plays as a live shot. Scroll fires the transition
     onto its camera, and once that move has landed a still takes the
     frame — first the plain plate, then the thermal one over it.

     The handover is a CROSSFADE rather than a cut, and deliberately:
     the stills were not rendered from this camera, so their framing does
     not match the frame they replace. A dissolve reads as an edit; a cut
     between two near-but-not-equal compositions reads as a glitch.

     Written straight to style, in the scroll rAF that was already here.
     Nothing about this belongs in React state — it changes every frame
     and renders nothing but two opacities. */
  const paintStills = (p: number) => {
    /* FIRED WITH THE TRANSITION, NOT AFTER IT — and then run on a clock.

       This used to wait for FlightScene to report survey settled, which
       meant the camera finished its move, held its final framing, and
       only then was covered. That final framing is the one thing the
       shot should never show: the aircraft ends up jammed into the
       bottom-left corner and clipped, because the still was always going
       to replace it. Waiting for the arrival guaranteed you saw the
       arrival.

       So the trigger is the transition FIRING — the moment progress
       crosses into the beat — and the plate is timed to reach full
       opacity exactly as the move lands. The camera still travels; you
       simply never see where it stopped.

       Everything after that runs on the same clock, once, at its own
       pace. Nothing here is scrubbed: scroll starts it and lets go, the
       way the camera move it covers already worked. */
    if (p < FLIGHT.byId.survey.start) {
      startedAt.current = Number.NaN;
      if (plainRef.current) plainRef.current.style.opacity = '0';
      if (lockImgRef.current) lockImgRef.current.style.opacity = '0';
      if (beamRef.current) beamRef.current.style.opacity = '0';
      return;
    }
    if (Number.isNaN(startedAt.current)) startedAt.current = performance.now();

    /* Seconds since the move landed, and it does NOT wrap. The sequence
       runs once and holds on its last frame; leaving the beat is what
       arms it again. */
    const t = (performance.now() - startedAt.current) / 1000;
    const seg = (a: number, b: number) => clamp01((t - a) / (b - a));

    /* The beat, in seconds from the moment the transition fired.

       PLAIN IS PINNED TO THE MOVE, not chosen: it reaches 1.0 exactly as
       the camera stops, so the plate is opaque on that frame and the
       arrival is never seen. It is derived from the beat's own enterSec,
       so retiming the transition retimes this with it.

       Everything after runs from there and is deliberately tight — the
       whole read-out is 2.9s where it used to be 4.75. An instrument
       reporting a find should feel like it already knew; the earlier
       pacing had it thinking about it. The stages still overlap, because
       a run of discrete pops reads as a slide deck rather than a machine
       working. */
    const plain = seg(COVER_SEC * 0.5, COVER_SEC);
    /* THE LOCK, as sketched: two dashed lines leave the sensor and run out
       to opposite corners of a frame around the settlement — the outer
       edges of what the sensor sees — and the frame then draws itself.
       The thermal view then comes up inside that frame. */
    const beam = seg(1.0, 1.65);
    const frameIn = seg(1.55, 2.05);
    const thermal = seg(2.0, 2.5);

    if (plainRef.current) plainRef.current.style.opacity = String(plain);

    /* NO COOL-DOWN. The plate used to be desaturated to 45% and darkened by
       16% as the thermal view arrived, so the colour drained out of the
       landscape at the moment the sensor locked. The brief is the opposite:
       the plate keeps its own colours throughout, and the thermal view in
       the frame is the only thing that changes. */

    /* THE BEAM, in stage pixels — which is not the space its anchors are
       given in.

       Both ends are fractions of the STILL, and the still is drawn with
       object-fit: cover, so on any stage that is not exactly 16:9 part of
       it is cropped away. Mapping a fraction of the image straight onto a
       fraction of the stage would slide the line off the aircraft the
       moment the window changed shape, so the cover transform is undone
       here: scale by the larger axis ratio, centre the overflow, place. */
    const lineA = lockLineARef.current;
    const lineB = lockLineBRef.current;
    const frame = lockBoxRef.current;
    const stillsBox = stillsBoxRef.current;
    if (stillsBox && lineA && lineB && frame) {
      const pl = plateRef.current;
      /* NOTHING TO DRAW FROM. One opacity covers the lines, the frame and
         the thermal view together, because they are all children of the
         one SVG — so a plate with no aircraft simply never lights it. */
      if (!pl.sensor) {
        if (beamRef.current) beamRef.current.style.opacity = '0';
        return;
      }
      const sen = pl.sensor;
      const w = stillsBox.clientWidth, h = stillsBox.clientHeight;
      const k = Math.max(w / pl.w, h / pl.h);
      const dw = pl.w * k, dh = pl.h * k;
      /* Must match the stylesheet's object-position for this plate, or the
         maths undoes a crop the browser did not perform. */
      const ox = pl.originX === 'left' ? 0 : (w - dw) / 2;
      const oy = (h - dh) / 2;
      const map = (fx: number, fy: number): [number, number] => [ox + fx * dw, oy + fy * dh];
      const [sx, sy] = map(sen.drone[0], sen.drone[1]);
      const [bx0, by0] = map(sen.lock.x0, sen.lock.y0);
      const [bx1, by1] = map(sen.lock.x1, sen.lock.y1);

      /* Top-left and bottom-right: seen from low on the left, those two
         corners are the silhouette of the view cone, so the pair reads as
         a frustum rather than as two unrelated lines.

         Grown by moving the END POINT, not by animating dash offset — a
         dashed stroke revealed with dashoffset crawls instead of
         extending. */
      const grow = (el: SVGLineElement, tx: number, ty: number) => {
        el.setAttribute('x1', String(sx));
        el.setAttribute('y1', String(sy));
        el.setAttribute('x2', String(sx + (tx - sx) * beam));
        el.setAttribute('y2', String(sy + (ty - sy) * beam));
      };
      grow(lineA, bx0, by0);
      grow(lineB, bx1, by1);
      if (beamRef.current) beamRef.current.style.opacity = beam > 0 ? '1' : '0';

      /* The frame draws on from the corner the first line lands on. With
         pathLength=1, dashoffset 1 -> 0 reveals the whole perimeter. */
      frame.setAttribute('x', String(bx0));
      frame.setAttribute('y', String(by0));
      frame.setAttribute('width', String(Math.max(0, bx1 - bx0)));
      frame.setAttribute('height', String(Math.max(0, by1 - by0)));
      frame.style.strokeDashoffset = String(1 - frameIn);
      frame.style.opacity = frameIn > 0 ? '1' : '0';

      /* The thermal view, occupying exactly the frame. slice is SVG's
         object-fit: cover; with the frame now at the image's own aspect it
         crops nothing, and it keeps the view filled if either is changed. */
      const img = lockImgRef.current;
      if (img) {
        img.setAttribute('x', String(bx0));
        img.setAttribute('y', String(by0));
        img.setAttribute('width', String(Math.max(0, bx1 - bx0)));
        img.setAttribute('height', String(Math.max(0, by1 - by0)));
        img.style.opacity = sen.thermal ? String(thermal) : '0';
      }
    }
  };

  useEffect(() => {
    const mq = window.matchMedia(TALL_PLATE_MQ);
    /* BOTH, together. The <img> renders from state; the anchor maths in the
       rAF above reads the ref, because it must not wait for a render to
       agree with what is on screen. Writing the ref HERE rather than during
       render keeps them in step without touching a ref while React is
       rendering, which it is entitled to do twice. */
    const apply = () => {
      const next = mq.matches ? PLATE_TALL : PLATE_WIDE;
      plateRef.current = next;
      setPlate(next);
    };
    apply();
    /* A phone rotated landscape crosses this, so it listens rather than
       reading once. */
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      paintStills(progressRef.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    let queued = false;

    const measure = () => {
      raf = 0;
      queued = false;
      const rect = root.getBoundingClientRect();
      /* Progress across the spacer, not the document: the page may carry
         chrome above and below and neither should steal scroll from the
         flight. */
      /* AGAINST THE STAGE'S HEIGHT, not window.innerHeight.

         These are the same number while the stage is sized in dvh, and
         they were not when it was svh — which is how the timeline came to
         finish before the section unpinned. A sticky element releases when
         its container's bottom edge reaches the element's own height, so
         that height is what progress has to be measured against: divide by
         it and progress reaches exactly 1 at the moment the stage lets go,
         whatever unit anybody sizes it in later.

         Falls back to innerHeight if the ref is not attached yet, which is
         the value this used before and is right at first paint. */
      const stageH = stageRef.current?.offsetHeight || window.innerHeight;
      const travel = Math.max(1, rect.height - stageH);
      progressRef.current = clamp01(-rect.top / travel);
    };

    const schedule = () => { if (!queued) { queued = true; raf = requestAnimationFrame(measure); } };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  /* THE VIDEO'S FADE, driven off the same progress ref the scene reads.

     Not React state, for the reason given at the top of this file: a
     number that changes every frame does not belong in a render. The
     opacity is written straight to the element's style, and the element
     is paused once it is fully hidden so a decoder is not running four
     screens after anyone can see it.

     The ramp is expressed against the approach beat's own clock rather
     than a literal 0.2, so it follows the running order if the beats are
     ever reordered or re-timed. */
  const videoRef = useRef<HTMLVideoElement>(null);
  /* The clip layer's opacity, shared with ClipStage. A ref rather than
     state for the same reason the video's is: it changes every frame. */
  const clipFadeRef = useRef(0);
  const clipBoxRef = useRef<HTMLDivElement>(null);
  /* The two stills that close the section. Opacity only — no state, for
     the reason at the top of this file. */
  const plainRef = useRef<HTMLImageElement>(null);
  const beamRef = useRef<SVGSVGElement>(null);
  const lockLineARef = useRef<SVGLineElement>(null);
  const lockLineBRef = useRef<SVGLineElement>(null);
  const lockBoxRef = useRef<SVGRectElement>(null);
  const lockImgRef = useRef<SVGImageElement>(null);
  const stillsBoxRef = useRef<HTMLDivElement>(null);
  /* performance.now() at the moment survey settled. The whole read-out
     is timed from here — see paintStills. */
  const startedAt = useRef(Number.NaN);
  useEffect(() => {
    if (!videoFirst) return;
    const el = videoRef.current;
    if (!el) return;

    const approach = FLIGHT.byId.approach;
    /* Hold through the beat, then cross to the scene over the last
       quarter of it. Fading earlier would show the render before the
       copy has finished with the video; fading later would cut. */
    const holdTo = approach.start + approach.span * 0.75;
    const gone = approach.start + approach.span;

    let raf = 0;
    let playing = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = progressRef.current;
      const o = p <= holdTo ? 1 : clamp01(1 - (p - holdTo) / (gone - holdTo));
      el.style.opacity = String(o);

      /* THE TRANSIT BEAT, same shape one beat later. It rises as the
         video leaves and falls again at the end of its own beat, so the
         section reads video -> render -> live scene. */
      const transit = FLIGHT.byId.transit;
      const tIn = transit.start;
      const tHold = transit.start + transit.span * 0.75;
      const tOut = transit.start + transit.span;
      const cf =
        p < tIn
          ? 0
          : p <= tHold
            ? clamp01((p - tIn) / (tHold - tIn))
            : clamp01(1 - (p - tHold) / (tOut - tHold));
      clipFadeRef.current = cf;
      if (clipBoxRef.current) clipBoxRef.current.style.opacity = String(cf);

      /* Reduced motion gets the poster and nothing else — the element
         still fades, it just never runs. */
      if (reduced) return;
      const want = o > 0.01;
      if (want !== playing) {
        playing = want;
        if (want) void el.play().catch(() => {}); else el.pause();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.pause();
    };
  }, [videoFirst]);

  return (
    /* NO data-chrome here, by decision: the header is black over the
       homepage hero ONLY and white everywhere else, this section included.

       Know the cost before reversing it. This section's skies run #bcc1b4
       to #d1d6cd, and cream header labels over them were measured at about
       1.5:1 — which is why it once carried data-chrome="ink" (near 10:1).
       The CONTACT pill brings its own cream ground and stays legible; the
       bare labels are what suffer. If they need rescuing, give the header
       a dark halo over pale sections rather than turning it black. */
    <div
      ref={rootRef}
      className={styles.root}
      style={{ height: `${FLIGHT.totalVh}vh` }}
    >
      {/* ONE sticky stage holding the canvas and all the chrome, so they
          pin and unpin together and stay confined to this section. The
          canvas used to be position:fixed, which is right when the flight
          is the entire page and wrong the moment it is one section of
          one — it would cover the hero above it and the footer below. */}
      <div ref={stageRef} className={styles.stage}>
        <FlightScene
          progressRef={progressRef}
          onScene={setScene}
          photoreal={photoreal}
          className={styles.canvas}
        />

        {/* THE APPROACH BEAT AS FOOTAGE. Above the canvas, below the copy,
            so the beat's own words still read over it.

            No `controls`, no `src` on the element itself: the two sources
            let Chrome and Firefox take the VP9 (2.76MB) while Safari falls
            back to h264 (4.57MB). `muted` AND `playsinline` are both
            required for iOS to autoplay at all — either one missing and it
            opens the native fullscreen player instead. */}
        {/* THE CLOSING STILLS AND THE SENSOR BEAM.

            All of it lives in one wrapper so the beam's pixel space and
            the plate's cropped box are the same box — the SVG is sized by
            the wrapper, and the anchor maths below undoes object-fit:
            cover against exactly these dimensions. Splitting them would
            mean measuring two elements that are only coincidentally the
            same size. */}
        <div ref={stillsBoxRef} className={styles.stills}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={plainRef}
            className={styles.still}
            /* object-position travels with the plate rather than living in
               the stylesheet, because the anchor maths above reads the same
               value off the descriptor. Two places, one source. */
            style={{ opacity: 0, objectPosition: plate.originX === 'left' ? 'left center' : 'center' }}
            src={plate.src}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        </div>

        {/* THE LOCK, a sibling of the stills wrapper rather than a child of
            it. It sat outside while that wrapper carried a greying filter,
            and there is no reason to move it back: it is the same inset-0
            box, so the pixel space the anchor maths hands over is
            unchanged. */}
          {/* No viewBox: one SVG user unit is one CSS pixel, which is the
              space the anchor maths hands over. A viewBox would silently
              rescale every coordinate it writes. */}
          <svg ref={beamRef} className={styles.beam} style={{ opacity: 0 }} aria-hidden="true">
            <line ref={lockLineARef} className={styles.lockLine} x1="0" y1="0" x2="0" y2="0" />
            <line ref={lockLineBRef} className={styles.lockLine} x1="0" y1="0" x2="0" y2="0" />
            <defs>
              {/* ONE shadow for the frame and the view inside it, so they
                  lift off the plate as a single card. An SVG filter rather
                  than CSS filter on SVG children, which Safari has been
                  unreliable about. The region is padded well past the box
                  because a blur clipped to the element's own bounds is a
                  hard-edged smudge, not a shadow. */}
              <filter id="flight-lock-shadow" x="-30%" y="-30%" width="160%" height="170%">
                <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#090b07" floodOpacity="0.55" />
              </filter>
            </defs>
            <g filter="url(#flight-lock-shadow)">
              <image
                ref={lockImgRef}
                href="/images/survey-thermal.webp"
                x="0"
                y="0"
                width="0"
                height="0"
                preserveAspectRatio="xMidYMid slice"
                style={{ opacity: 0 }}
              />
              <rect ref={lockBoxRef} className={styles.lockBox} x="0" y="0" width="0" height="0" pathLength={1} style={{ opacity: 0 }} />
            </g>
          </svg>


        {/* The Blender take, real-time. Same slot as the video so the two
            can be compared without either moving. */}
        {videoFirst && (
          <div ref={clipBoxRef} className={styles.clip} style={{ opacity: 0 }}>
            <ClipStage fadeRef={clipFadeRef} className={styles.clipCanvas} />
          </div>
        )}

        {videoFirst && (
          <video
            ref={videoRef}
            className={styles.video}
            poster="/video/approach-poster.jpg"
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src="/video/approach.webm" type="video/webm" />
            <source src="/video/approach.mp4" type="video/mp4" />
          </video>
        )}

      {/* The copy swaps as scenes come and go. Pinning it rather than
          laying the sections out down the page means the type never
          slides against a camera that is already moving — two motions
          competing read as neither. */}
      <div className={styles.pane} aria-hidden={false}>
        {SCENES.map((s, i) => (
          <article
            key={s.id}
            className={styles.card}
            data-scene={s.id}
            style={{ opacity: i === scene ? 1 : 0, visibility: i === scene ? 'visible' : 'hidden' }}
          >
            <p className={styles.kicker}>{s.kicker}</p>
            <h2 className={styles.title}>
              {s.title.split('\n').map((line, k) => (
                <span key={k} className={styles.line}>{line}</span>
              ))}
            </h2>
            <p className={styles.body}>{s.body}</p>
          </article>
        ))}
      </div>
      </div>
    </div>
  );
};

export default FlightPreview;
