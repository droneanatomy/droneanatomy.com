'use client';

/* ============================================================
   FieldHero — the scroll timeline and the DOM half of the field hero.

   Layout follows oryzo's hero: corners are load-bearing. The content
   is pinned over a fixed canvas while a tall spacer scrolls beneath
   it, which is what gives the timeline its length.

     beat 0  wordmark + corner copy on grass
     beat 1  field dissolves, copy crossfades to the statement
     beat 2  aircraft rises in the void, warm haze comes up

   One GSAP tween scrubs a single 0..1 proxy. Everything else is a
   pure function of it: the beat weights go to CSS as custom
   properties, and FieldScene reads the same number for the 3D. There
   is deliberately no second source of truth.

   NOTE — this route does NOT use ScrollSmoother. Smoother transforms
   #smooth-content, which creates a containing block and breaks every
   position:fixed layer this hero is built from. ScrollTrigger's own
   scrub already supplies the damping Smoother would have; adding
   Smoother would mean rebuilding the fixed layers as pins for no
   visible gain.
   ============================================================ */

import type { CodaSize, ProductPage } from './product';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FieldBenchMobile, FieldClosingMobile } from './FieldMobileSections';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/components/motion/gsap-setup';
import styles from './Field.module.css';

import { doorwayEntry, EXIT_DUR, FieldGallery, type FieldGalleryHandle } from './FieldGallery';
import { FieldBench, type FieldBenchHandle } from './FieldBench';
import { FieldMenu } from './FieldMenu';
import { FieldNav } from './FieldNav';
import { useBootGate, useBootProgress } from '@/components/Chrome/BootCurtain';
import { FieldVideo } from './FieldVideo';
import { FIRST_FIT, FIRST_W, FieldSequence, type FieldSequenceHandle } from './FieldSequence';

import {
  DEFAULT_ACTS,
  deriveActs,
  scrubVhForFrames,
  returnClock,
  BLACK_WINDOW,
  clamp01,
  EXIT_WINDOW,
  GALLERY_WINDOW,
  LOCKUP_HEAD_MAX,
  LOCKUP_HEAD_VH,
  LOCKUP_TOP,
  LOCKUP_WINDOW,
  DIM_FLOOR,
  DIM_WINDOW,
  MORPH_TARGET_PX,
  MORPH_WINDOW,
  PLATE_OVERSCAN,
  PLATE_PAN_END,
  PLATE_PAN_Y_PCT,
  PLATE_ZOOM,
  PLATE_ZOOM_WINDOW,
  smoothstep,
  BLOOM_WINDOW,
  STATEMENT_HOLD,
  CARD_WINDOW,
  INTRO_WINDOW,
  KICKER_WINDOW,
  PARA_WINDOW,
  STATEMENT_CHAR_FADE,
  STATEMENT_WINDOW,
  CODA_WINDOW,
  SLIDE_WINDOW,
  TAB_WINDOW,
  ZOOM_WINDOW,
} from './beats';

/* Which airframe the hero flies.

   p10agri.glb (tank / pump / nozzles) is the sprayer, and is what this
   prototype has always shown — the camera path and seating below were
   authored against its proportions.

   p10.glb (four discrete arms / gear / nose) is the survey quad and is
   also in public/models. Swapping to it is a one-line change here, but
   expect to retune TILT/FIT in FieldScene: it is a different airframe,
   not another export of the same one. */

/* What sits behind the type.

   false — the WebGL scene over a photographic plate. The plate is the world,
           the render is only the aircraft and the shadow it drops into it,
           and the plate fades out on the same beat that used to dissolve the
           procedural turf. 2.5D, the way oryzo actually did it.
   true  — a single flat still with the drone already in it. Inert: nothing
           dissolves and the camera never rises. For judging type only. */

/* Whether the aircraft stands on a PHOTOGRAPH.

   false — a graded ground instead (see .ground). The sequence is lit in a
           studio on transparency, and a photographic location brings its
           own sun; the two never agree, and the mismatch reads as the
           subject being pasted on rather than as either being wrong. With
           no location there is nothing to disagree with.
   true  — the plate returns, and it then wants a matched shadow pass and a
           key light rendered to suit that specific photograph. */

/* HERO LAYOUT VARIANT.
 
   false — the masthead composition: wordmark and kicker in the top-left
   corner, body copy right, credit card bottom-left.
 
   true — the SPLIT: the wordmark drops to the vertical centre of the left
   third and the body copy sits opposite it, with the aircraft between them.
   It is the same arrangement the void statement uses later in act one, which
   is the point — the page states its name the way it later states its claim.
 
   Nothing about the exits changes. The wordmark still morphs into the corner
   logo across MORPH_WINDOW and the paragraph still does its per-line blur
   and drift; only where they start moving from is different. The morph is
   measured at rest with getBoundingClientRect corner-to-corner and
   re-measured on resize, so it follows the wordmark wherever this puts it.
 
   The credit card is dropped in this variant rather than repositioned. The
   split is a three-part composition — name, machine, sentence — and a fourth
   block in the lower left turns it back into a page with things arranged on
   it.

   'centred' — CHOSEN. The wordmark goes BEHIND the aircraft, oversized and
   centred, with the copy under it. This is the direction the page ships
   with, decided against the other two on /preview/p10.

   The other two are kept rather than deleted, and that is a judgement worth
   stating: they cost nothing but a branch in the class strings, and the
   comparison is the only reason the choice can be defended later. Delete
   them the day the page is signed off and not before — a variant you cannot
   put back is a decision you cannot revisit.

   Taken as a PROP rather than a constant so routes can differ; every beat,
   every window and every ref is shared, and only the arrangement changes.
   DEFAULT_LAYOUT stays 'split' so /preview/field keeps showing something
   different — the moment both routes render the same thing, the comparison
   page stops earning its URL. */
export type HeroLayout = 'masthead' | 'split' | 'centred';
const DEFAULT_LAYOUT: HeroLayout = 'split';

/* Where "it's compact" sits before its travel begins.

   Shared by the slide tween's from-state and the reset in apply(), because
   the two have to agree exactly and there is no way to notice at review
   time that they have drifted — the symptom is a line half a page early.

   x AND y ARE ZEROED HERE, and must stay. When the scroll machine is
   rebuilt (revertOnUpdate, at the bottom of this component), GSAP restores
   the line's inline transform and the new run re-reads it as a matrix — and
   a matrix can only give back PIXELS. So this very start state, 40% / -50%,
   came back as a permanent x 572px, y -126px, added under every later
   xPercent/yPercent: the lockup aimed at the kicker's column and landed
   572px to the right of it, top-centre behind the gallery. Measured, not
   inferred: 572.36 = 0.40 x the line's 1431px width. */
const SLIDE_FROM = { xPercent: 40, yPercent: -50, x: 0, y: 0, opacity: 0, scale: 1, color: '#6f6a58' } as const;

/* Rendered frames instead of WebGL for act one's aircraft.

   Same slot, same progress, no Three.js — the sequence is scrubbed off the
   identical act-one scalar the scene reads, so every beat around it keeps
   its timing. What changes is the CHOREOGRAPHY: the render is a camera
   push-in, not a turntable, so the lift, the two turns and the centring in
   FieldScene have no counterpart here. Those beats are baked into the
   frames now, and beats.ts no longer controls them.

   Worth knowing before switching: 66 frames over act one is about 9.4
   viewports per frame, which is generous for a move this smooth, and 2.3MB
   against the model's 22MB. What it costs is every window in FieldScene
   that used to be tunable. */

/* WHICH BUILD OF THE SEQUENCE. Both are the same 160-frame V4 render at a
   different point on the quality/payload curve; switch and reload.

     name       source        payload   at a 1920 canvas
     ---------  ------------  --------  ----------------------------
     'hero4k'   3840, q96      29.6 MB  0.50x — downsampled
     'hero2k'   2560, q96      17.7 MB  0.75x — downsampled

   Anything at or above 1920 is DOWNSAMPLED into the canvas rather than
   stretched, which is why both still look sharp: four source pixels
   averaging into one cleans the propeller edges and the matte in a way
   encoder quality cannot buy back. The build this replaced was 1500 wide
   and therefore ENLARGED before it was ever seen, which was the whole of
   the softness — not the compression.

   There was a third entry here, 'hero' — the render copied byte for byte,
   no resize and no encoder, to settle whether softness was ours or the
   render's. It answered the question (ours) and has been deleted: 132MB of
   frames from a superseded render, in a directory that ships whole because
   this project is output:'export'. Regenerate in one command if the
   question ever comes up again:

     node scripts/build-sequence.mjs <folder> hero raw

   and point SEQUENCE_EXT at 'png' to view it.

   Verify a build has all its frames before pointing at it. The loader
   counts onerror as progress, so a short folder comes up looking healthy
   and simply stops advancing partway through the scrub — which is also
   what happens if SEQUENCE_FRAMES disagrees with what is on disk. */
/* WHICH SEQUENCE BUILD THIS DEVICE GETS.
 
   The canvas is sized innerWidth x min(dpr, 2), so what a device can
   actually resolve is that number and nothing more. A phone's canvas is
   about 780px; feeding it the 3840 build means downsampling 4.9x and paying
   24MB over cellular for detail the screen cannot show.
 
   So: pick the SMALLEST build that is still at least as wide as the canvas.
   Always downsampling, never enlarging — enlarging is what made the
   sequence look soft in the first place, and that lesson is the reason
   these tiers exist rather than one middle-sized compromise.
 
     canvas <= 1280   ->  1k     4.9MB   phones
     canvas <= 2560   ->  2k    14.2MB   tablets, laptops
     otherwise        ->  4k    22.8MB   desktops at 2x
 
   saveData overrides everything. A reader who has asked their browser to
   use less data has told us the answer already, and a hero is exactly the
   kind of thing they meant.
 
   Chosen in a lazy useState initialiser, which is safe here for a specific
   reason: FieldSequence renders ONLY a <canvas> and loads its frames in an
   effect via new Image(). There is no src in the server markup, so the
   server and client can disagree about the tier without any hydration
   mismatch to reconcile. Reading window during render would not be safe in
   a component that put the choice into its HTML. */
const TIERS = [
  { tier: '1k', w: 1280, h: 720 },
  { tier: '2k', w: 2560, h: 1440 },
  { tier: '4k', w: 3840, h: 2160 },
] as const;

const pickTier = (): '1k' | '2k' | '4k' => {
  if (typeof window === 'undefined') return '4k';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth * dpr;
  const ch = window.innerHeight * dpr;

  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

  /* Pick the smallest build the PAINTER will not have to enlarge.
  
     This used to compare the canvas width against the source width, which is
     the right test for cover-fit and the wrong one here. FieldSequence draws
     at min(cover, baseline), and on a narrow screen the baseline wins and
     MAGNIFIES: sizing frame 0 to 60% of a 780px canvas needs 468 device
     pixels of aircraft, and the 1280 build only has 243 — a 1.92x
     enlargement. Phones were being handed the small build precisely because
     the rule thought their canvas was small, when the baseline meant they
     needed the LARGEST source of any device. That is what looked noisy; the
     codec was never the problem.
  
     So the rule mirrors the painter exactly rather than approximating it.
     1.15 rather than 1.0 because a 15% enlargement is not visible and
     holding the line at 1.0 pushes ordinary phones onto the 4k build for
     nothing.

     THE COST IS DELIBERATE. A phone now downloads the 2k build — 14.2MB,
     not the 4.9MB the 1k build would have been — and that was chosen with
     the trade on the table: sharpness over payload. There is no compression
     setting that produces detail the source does not have, so the only
     lever that would bring the 1k build back is FIRST_FIT, and dropping the
     opening frame from 60% to about 45% is the price. Do not "optimise"
     this back to the smaller tier without moving that number too, or the
     softness returns and nothing here will explain why. */
  for (const { tier, w, h } of TIERS) {
    if (conn?.saveData && tier !== '1k') break;
    const cover = Math.max(cw / w, ch / h);
    const baseline = (cw * FIRST_FIT) / (FIRST_W * w);
    if (Math.min(cover, baseline) <= 1.15) return tier;
  }
  return conn?.saveData ? '1k' : '4k';
};

/* The return sequence, act four. Its own build and its own frame count —
   40 against the opening render's 120 — so it cannot share SEQUENCE_FRAMES,
   and it runs on act four's clock, not act one's.

   Both come out of the SAME 160-frame export, sliced by the build script:
   frames 0-119 are the opening, 120-159 the return. That is why the loop
   closes cleanly now — source frame 159 lands on frame 0's exact bounding
   box and within one unit per channel of its colour, because they are one
   continuous camera path rather than two renders matched by hand. */






/* THE CODA'S SIZE STEPS — whole class strings, not numbers.

   They have to be written out in full: Tailwind reads the source as text
   and generates only the classes it can SEE, so a size built by splicing a
   value into `text-[clamp(28px,${n}vw,170px)]` would compile and then
   render at the browser's default size.

   `lg` is the original pair, untouched, and is what every page without a
   `codaSize` still gets. The two smaller steps change breakpoint as well as
   size, and that is the point rather than an oversight: the line goes
   nowrap at sm (640px) while `lg` does not shrink until md (768px), so
   between those two widths a long line is set at the PHONE size with no
   wrapping left to save it. At 700px that is 9.5vw = 66.5px, and P10 Pro's
   fifteen ems of it run 997px across a 700px screen. The steps that exist
   for long lines therefore land their smaller size at sm, where the
   nowrap starts, instead of at md. `lg` keeps md because nothing short
   enough to use it has that problem, and its 9.5vw phone size was tuned
   deliberately (see the note on the element). */
const CODA_SIZE: Record<CodaSize, string> = {
  lg: 'text-[clamp(28px,9.5vw,170px)] md:text-[clamp(24px,6.8vw,132px)]',
  md: 'text-[clamp(26px,8.2vw,150px)] sm:text-[clamp(22px,5.6vw,110px)]',
  sm: 'text-[clamp(24px,7.2vw,132px)] sm:text-[clamp(20px,4.6vw,90px)]',
};

const NAV = [
  { label: 'Intro', href: '/preview/field' },
  { label: 'Modules', href: '/products' },
  { label: 'Payload', href: '/products/p10-pro' },
  { label: 'Contact', href: '/contact' },
];

export const FieldHero: React.FC<{
  /** Everything this page renders that is not choreography. */
  product: ProductPage;
  layout?: HeroLayout;
  /** 'inline' is the corner nav this page has always had. The other two are
   *  trials on /preview/p10 only, which is why this is a prop rather than a
   *  rewrite: 'overlay' is FieldMenu's three sliding panels, 'mega' is
   *  FieldNav's bar-and-panel. Both stay mounted-by-flag so they can be
   *  compared against each other rather than one replacing the other. */
  menu?: 'inline' | 'overlay' | 'mega';
}> = ({ product, layout = DEFAULT_LAYOUT, menu = 'inline' }) => {
  /* One decision per mount, never re-read. A tier that changed on resize
     would swap the `name` prop, and FieldSequence keys its loading effect on
     that — the whole sequence would re-download mid-scroll. */
  /* The page's own act clocks, derived from what this product declares
     rather than read off module constants. A product with no gallery simply
     has no `gallery` entry here, and every consumer below is written to
     handle that rather than to fall back to zero — a missing act whose
     clock reads 0 would run its beats at the top of the page instead of not
     at all, which is a far harder failure to see. */
  /* Below 768px the page stops being a timeline after the hero. Acts two,
     three and four become ordinary sections in normal flow — see
     FieldMobileSections. Tracked live so a rotation re-lays it out. */
  const [videoOpen, setVideoOpen] = useState(false);
  const [narrow, setNarrow] = useState(
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 767px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /* Act one's length is solved against the frame count so one scroll notch
     advances one frame — see scrubVhForFrames.

     Solved AFTER mount, deliberately, and the main useGSAP below takes
     `clock` as a dependency so it rebuilds once when this arrives. The two
     obvious alternatives both failed, and the failures are worth keeping:

       - solving in an effect while useGSAP had NO dependencies left the
         spacer at the solved height and the timeline on the previous
         fractions. Measured: spacer 3051vh, apply() still dividing by
         0.3405, the 950-based span. Longer page, unchanged density.

       - solving during first render instead fixed the clock but made the
         markup differ from the static build, and suppressHydrationWarning
         does not repair a mismatch — it tells React to LEAVE it. The DOM
         kept the build's 2790vh while the clock used 1211.

     Re-solving on resize is still refused: it would change the spacer
     mid-scroll and jerk the timeline out from under the reader. */
  const [heroVh, setHeroVh] = useState<number | null>(null);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- This is
       the point of the effect, and the comment above says why: the value
       needs window.innerHeight, so solving it during render produced
       markup that differed from the static build. After mount is the only
       place it can be measured without a hydration mismatch. */
    setHeroVh(scrubVhForFrames(product.sequence.heroFrames, window.innerHeight));
  }, [product.sequence.heroFrames]);

  /* Act four's return sequence, solved the same way and for the same
     reason — see returnClock. Its length sets the act's length, so the
     windows inside it are computed rather than declared. */
  const [endSeqVh, setEndSeqVh] = useState<number | null>(null);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- Same
       measurement, same reason as heroVh above. */
    setEndSeqVh(scrubVhForFrames(product.sequence.endFrames, window.innerHeight));
  }, [product.sequence.endFrames]);

  const { spacerVh, clock, ret } = useMemo(() => {
    const declared = product.acts ?? DEFAULT_ACTS;
    /* 316 is what the tuned 500vh act gave the sequence, so before the
       solve arrives the clock matches the declared act exactly and nothing
       jumps when it does. */
    const ret = returnClock(endSeqVh ?? 316);
    /* Until the effect has run there is nothing to solve against, so the
       product's declared length stands — that is also what renders on the
       server, which keeps the first paint free of a hydration mismatch. */
    const acts = declared.map((a) =>
      a.kind === 'hero' && heroVh
        ? { ...a, vh: heroVh }
        : a.kind === 'closing' && endSeqVh
          ? { ...a, vh: ret.actVh }
          : a
    );
    /* On a phone only the hero is scrubbed. Dropping the other acts from
       the list is not a visual tweak — it shortens the spacer, so the page
       is no longer 2910vh of empty scroll with three fixed layers pinned
       over it, and the sections below can simply be as tall as they are. */
    /* On a phone the hero AND the gallery stay scrubbed; only the bench
       and the closing card become ordinary sections. The gallery used to be
       filtered out here too and replaced by a stacked list, which meant the
       page had two galleries with different behaviour. It is one component
       at every width now — see the note on the track transform in
       FieldGallery. */
    const kept = narrow
      ? acts.filter((a) => a.kind === 'hero' || a.kind === 'gallery')
      : acts;
    return { ...deriveActs(kept), ret };
  }, [product.acts, narrow, heroVh, endSeqVh]);

  const [tier] = useState(pickTier);
  const SEQUENCE_NAME = product.sequence.hero[tier];
  const END_NAME = product.sequence.end[tier];
  const SEQUENCE_FRAMES = product.sequence.heroFrames;
  const END_FRAMES = product.sequence.endFrames;

  const HERO_SPLIT = layout === 'split';
  const HERO_CENTRED = layout === 'centred';
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const paraRef = useRef<HTMLParagraphElement>(null);
  const kickerRef = useRef<HTMLParagraphElement>(null);
  const wordmarkRef = useRef<HTMLHeadingElement>(null);
  const bigWordRef = useRef<HTMLParagraphElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const stmtHeadRef = useRef<HTMLHeadingElement>(null);
  const stmtParaRef = useRef<HTMLParagraphElement>(null);
  const codaHeadRef = useRef<HTMLHeadingElement>(null);
  const codaTagRef = useRef<HTMLParagraphElement>(null);
  const codaNoteRef = useRef<HTMLParagraphElement>(null);
  const slideHeadRef = useRef<HTMLHeadingElement>(null);
  const slideLabelRef = useRef<HTMLParagraphElement>(null);
  const reticleRef = useRef<SVGSVGElement>(null);
  const galleryRef = useRef<FieldGalleryHandle>(null);
  const benchRef = useRef<FieldBenchHandle>(null);
  const seqRef = useRef<FieldSequenceHandle>(null);
  const endSeqRef = useRef<FieldSequenceHandle>(null);

  /* Act-one time goes into `progress` because that is what FieldScene
     reads. The raw page scalar has to be kept separately or remeasure()
     would feed act-one time back in as though it were raw. */
  const rawP = useRef(0);

  /* THE CURTAIN IS NOT THIS COMPONENT'S ANY MORE.

     It used to own the whole loading screen — the state, the animated
     counter, the travel, the scroll lock and the markup. All of that now
     lives in BootCurtain, mounted once in the root layout, because the
     counting curtain was the first thing anyone saw of this company and
     it existed on this one route and nowhere else.

     What is left here is the part that was always specific to this page:
     knowing when ITS asset has arrived. The sequence holds the shared
     curtain open through useBootGate and reports its bytes into the
     shared counter; everything else is the shell's problem.

     Note the hazard this arrangement removes. The comment that used to
     sit here warned that if the flag being waited on never flipped, the
     page would sit on its loading screen forever. BootCurtain lifts on a
     timeout regardless, so a gate that never releases now costs a few
     seconds rather than the route. */
  const [sceneOn, setSceneOn] = useState(false);
  useBootGate(!sceneOn);
  const reportBoot = useBootProgress();

  const onSceneProgress = useCallback((f: number) => reportBoot(f), [reportBoot]);
  const onSceneReady = useCallback(() => setSceneOn(true), []);





  /* Hide the scrollbar for as long as this route is mounted. Removing the
     gutter widens the viewport, so ScrollTrigger has to re-measure — without
     the refresh every trigger stays anchored to the narrower layout. */
  useEffect(() => {
    document.documentElement.classList.add('field-route');
    ScrollTrigger.refresh();
    return () => {
      document.documentElement.classList.remove('field-route');
      ScrollTrigger.refresh();
    };
  }, []);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      /* The credit card's line retraction. Held as a paused timeline whose
         progress is SET from the beat scalar below rather than given its own
         ScrollTrigger — the card is inside a position:fixed layer and is
         already on screen at scroll 0, so it has no enter-viewport moment to
         trigger from, and a second trigger would drift from the beat clock. */
      let retract: gsap.core.Timeline | null = null;
      let retractP = 0;

      /* The right-hand paragraph's exit: each line blurs, fades and drifts
         right, one after another from the top down. Same paused-timeline
         treatment as the card, and for the same reason. */
      let drift: gsap.core.Timeline | null = null;
      let driftP = 0;

      /* The kicker above the wordmark: same masked retraction as the card,
         but word by word and upward. */
      let kick: gsap.core.Timeline | null = null;
      let kickP = 0;

      /* The void statement. One timeline carrying the whole arc — letters
         lighting up, a hold, then the same sweep taking them back out — so
         scrubbing its progress plays it forwards or backwards without any
         separate in/out bookkeeping. */
      let story: gsap.core.Timeline | null = null;
      let storyP = 0;


      /* The closing panel. One-way: it arrives and stays, so unlike the
         statement there is no hold-then-reverse, just an entrance scrubbed
         across its window. */
      let coda: gsap.core.Timeline | null = null;
      let codaP = 0;
      let noteSplit: SplitText | null = null;

      /* The slide: label, reticle and the travelling line, on one timeline. */
      let slide: gsap.core.Timeline | null = null;
      let slideP = 0;

      /* The lockup. Deliberately NOT appended to the slide timeline, which
         is where the light-up went: this one runs on the raw clock, past
         the end of act one, and folding it in would have meant stretching
         SLIDE_WINDOW and squeezing the travel the slide was tuned around.

         Two timelines writing the same four properties on the same element
         is safe here only because the ordering is fixed and the handoff is
         explicit — `lock` is applied after `slide` in apply(), and its
         from-state below is written out in full rather than inferred, so
         at lockP 0 it re-states exactly what slide just wrote. */
      let lock: gsap.core.Timeline | null = null;
      let lockP = 0;

      /* Wordmark -> corner logo. Measured rather than hard-coded: the travel
         depends on the kicker's rendered height and the clamped type size,
         both of which move with the viewport. Re-measured on resize. */
      let morph = { dx: 0, dy: 0, scale: 0.08 };
      const measureMorph = () => {
        const h = wordmarkRef.current;
        const d = dotRef.current;
        if (!h || !d) return;
        /* Measure the rest state, so the numbers are absolute rather than
           relative to whatever transform is currently applied. */
        const prev = h.style.transform;
        h.style.transform = 'none';
        const hb = h.getBoundingClientRect();
        const db = d.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(h).fontSize) || 1;
        /* transform-origin is top-left, so scaling pins the box's top-left
           corner — which means the translation is simply corner to corner. */
        morph = { dx: db.left - hb.left, dy: db.top - hb.top, scale: MORPH_TARGET_PX / fs };
        h.style.transform = prev;
      };

      /* Where the travelling line ends up once it stops being a headline.
         Same measured-not-hardcoded reasoning as the wordmark morph above,
         and the same failure if it is skipped: the line's size is 19.5vw
         and the target is a fraction of vh, so the travel between them is
         a function of the window's aspect ratio and cannot be a constant.

         Measured off offsetLeft/offsetTop/offsetWidth/offsetHeight rather
         than getBoundingClientRect. Those four are LAYOUT values and are
         not affected by transforms, so the line can be measured while GSAP
         is mid-scrub on it — no clearing the transform and putting it back,
         and no hidden duplicate element to measure instead. A duplicate was
         the first attempt and it was quietly wrong: a <span> copy of an
         <h2> inherits a different weight and came out 8px wider, which put
         the landing 4px off its mark.

         Expressed purely as xPercent/yPercent/scale, no x/y. GSAP folds
         percentage translation into the transform as a fraction of the
         element's UNSCALED size, and the browser applies the scale about
         transform-origin afterwards, so the two compose as:

           rendered left = offsetLeft + (w/2)(1 - scale) + xPercent% * w

         which inverts for xPercent without the scale factor entangling. */
      let lockTo = { xPercent: -50, yPercent: -50, scale: 1, labelY: 0 };
      const boxOf = (el: HTMLElement) => {
        /* offsetLeft/Top are relative to the offsetParent's padding box.
           Neither ancestor here carries a border, so adding the parent's
           own rect gives viewport coordinates. */
        const p = el.offsetParent as HTMLElement | null;
        const pr = p ? p.getBoundingClientRect() : { left: 0, top: 0 };
        return {
          left: pr.left + el.offsetLeft,
          top: pr.top + el.offsetTop,
          w: el.offsetWidth,
          h: el.offsetHeight,
        };
      };
      const measureLockup = () => {
        const head = slideHeadRef.current;
        const label = slideLabelRef.current;
        if (!head || !label) return;

        const hb = boxOf(head);
        const lb = boxOf(label);
        const fs = parseFloat(getComputedStyle(head).fontSize) || 1;
        const vh = window.innerHeight;
        const scale = Math.min(LOCKUP_HEAD_VH * vh, LOCKUP_HEAD_MAX) / fs;

        /* The line aligns to the KICKER's measured left edge, not to a
           fraction of the viewport. The two elements live in different
           containing blocks — the kicker is inside the inset header, the
           line is in the full-bleed stage layer — so the same authored
           percentage resolves to two different pixel columns and the pair
           would sit 20px out of alignment. The shared left axis is the
           whole point of a lockup, so it is measured, not declared. */
        const left = lb.left;
        /* The kicker takes the top of the lockup and the line hangs
           directly under it. Read rather than assumed — the kicker's
           leading moves with its clamped size. */
        const top = LOCKUP_TOP * vh + lb.h;

        lockTo = {
          xPercent: ((left - hb.left - (hb.w / 2) * (1 - scale)) / hb.w) * 100,
          yPercent: ((top - hb.top - (hb.h / 2) * (1 - scale)) / hb.h) * 100,
          scale,
          labelY: LOCKUP_TOP * vh - lb.top,
        };
      };

      /* The page's own scroll extent, cached.

         Read on refresh rather than every frame: scrollHeight forces layout
         and this runs sixty times a second. */
      let maxScroll = 1;
      const measureScroll = () => {
        maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      };
      measureScroll();

      /* Beat weights -> CSS. Kept here rather than in each element so the
         choreography reads as one timeline instead of five. */
      const apply = (raw: number) => {
        rawP.current = raw;

        /* Act one on its own clock — see ACT_ONE_SPAN in beats.ts. Every
           window below except the four at the bottom of this function is a
           fraction of the aircraft sequence, not of the page, and clamping
           is what makes act one hold its last frame while the gallery
           runs rather than continuing to be scrubbed past its own end. */
        const p = clock.hero ? clamp01(raw / clock.hero.span) : 0;
        // The frames read the same act-one clock FieldScene does.
        seqRef.current?.setProgress(p);
        root.style.setProperty('--intro', String(1 - smoothstep(INTRO_WINDOW[0], INTRO_WINDOW[1], p)));
        /* The model tab leaves along its own axis.

           Written as the RAW 0..1 progress of the exit rather than as the
           1-minus form --intro uses, because this one drives a distance and
           not an opacity: at 0 the tab is home, at 1 it is a full width off
           the right edge. Inverting it here would mean inverting it again in
           the transform, and the sign of a translate is exactly the kind of
           thing that is wrong once and then never noticed. */
        root.style.setProperty('--tab-out', String(smoothstep(TAB_WINDOW[0], TAB_WINDOW[1], p)));
        /* The oversized wordmark, act one only.

           It leaves by RECEDING rather than by fading: scaled down and
           lifted while its opacity goes, so it reads as the name falling
           back behind the aircraft that is climbing out of it. A straight
           fade would make it a title card being switched off, and the whole
           point of putting it behind the canvas is that it belongs to the
           scene.

           Keyed to INTRO_WINDOW so it leaves with the rest of the opening
           furniture rather than on a clock of its own. */
        if (bigWordRef.current) {
          const g = smoothstep(INTRO_WINDOW[0], INTRO_WINDOW[1], p);
          bigWordRef.current.style.opacity = (1 - g).toFixed(3);
          bigWordRef.current.style.transform =
            `translate3d(0, ${(-g * 7).toFixed(2)}vh, 0) scale(${(1 - g * 0.12).toFixed(4)})`;
        }

        const m = smoothstep(MORPH_WINDOW[0], MORPH_WINDOW[1], p);
        root.style.setProperty('--morph', String(m));
        if (wordmarkRef.current) {
          const s = 1 + (morph.scale - 1) * m;
          wordmarkRef.current.style.transform =
            `translate3d(${(morph.dx * m).toFixed(2)}px, ${(morph.dy * m).toFixed(2)}px, 0)` +
            ` scale(${s.toFixed(5)})`;
        }
        /* Linear, not eased — this is a scrub. The timeline's own internal
           pacing supplies the shaping; easing the input as well would make
           the sweep accelerate away from the thumb. */
        storyP = clamp01(
          (p - STATEMENT_WINDOW[0]) / (STATEMENT_WINDOW[1] - STATEMENT_WINDOW[0])
        );
        story?.progress(storyP);

        slideP = clamp01((p - SLIDE_WINDOW[0]) / (SLIDE_WINDOW[1] - SLIDE_WINDOW[0]));
        slide?.progress(slideP);

        codaP = clamp01((p - CODA_WINDOW[0]) / (CODA_WINDOW[1] - CODA_WINDOW[0]));
        coda?.progress(codaP);

        /* The clocks, published. Nothing reads these in the page — they are
           here so a beat can be MEASURED rather than inferred from scroll
           position, which is what turned a one-line bug into three rounds
           of contradictory probing: act one's span differs between desktop
           and mobile because the act list is filtered, so the same scrollY
           means different things on each. --coda-built says whether the
           timeline exists at all, which distinguishes "not driven" from
           "driven to zero". */
        root.style.setProperty('--dbg-raw', raw.toFixed(4));
        root.style.setProperty('--dbg-p', p.toFixed(4));
        root.style.setProperty('--dbg-coda', codaP.toFixed(4));
        root.style.setProperty('--dbg-coda-built', coda ? '1' : '0');
        /* Starts where the field has finished dissolving, so the haze only
           arrives once there is a void for it to arrive in. Tops out at
           0.94 so it is fully up before the scroll bottoms out rather than
           still climbing when the page runs out of travel. */
        root.style.setProperty('--bloom', String(smoothstep(BLOOM_WINDOW[0], BLOOM_WINDOW[1], p)));
        /* Stage one: the courtyard loses light but stays legible. */
        const dim = smoothstep(DIM_WINDOW[0], DIM_WINDOW[1], p);
        root.style.setProperty('--plate-dim', (1 - dim * (1 - DIM_FLOOR)).toFixed(4));

        /* Stage two: the short switch out to black. FieldScene crosses its
           own lighting across VOID_WINDOW, which spans both stages, so the
           render never stays lit after the photograph has darkened. */
        root.style.setProperty(
          '--field',
          String(1 - smoothstep(BLACK_WINDOW[0], BLACK_WINDOW[1], p))
        );


        /* Plate parallax. Linear, so it tracks the thumb rather than easing
           like the beats around it. The crane stops when the plate does; the
           push-in runs on its own later, slower window and is still moving
           when the image goes. */
        const pan = clamp01(p / PLATE_PAN_END);
        const zoom = clamp01(
          (p - PLATE_ZOOM_WINDOW[0]) / (PLATE_ZOOM_WINDOW[1] - PLATE_ZOOM_WINDOW[0])
        );
        root.style.setProperty('--plate-y', (pan * PLATE_PAN_Y_PCT).toFixed(3) + '%');
        root.style.setProperty('--plate-scale', (PLATE_OVERSCAN + zoom * PLATE_ZOOM).toFixed(4));

        /* Finishes at 0.16, just ahead of the card's own fade at 0.20, so the
           lines are already gone rather than fading out mid-retraction. */
        retractP = smoothstep(CARD_WINDOW[0], CARD_WINDOW[1], p);
        retract?.progress(retractP);

        /* Deliberately a slightly wider window than the card's, so the two
           blocks do not leave in lockstep — offsetting them is what makes
           the frame feel like it is emptying rather than cutting. */
        driftP = smoothstep(PARA_WINDOW[0], PARA_WINDOW[1], p);
        drift?.progress(driftP);

        /* Earliest of the three. It is the smallest piece of type on screen,
           so it can leave before the eye has finished the wordmark without
           anything appearing to vanish. */
        kickP = smoothstep(KICKER_WINDOW[0], KICKER_WINDOW[1], p);
        kick?.progress(kickP);

        /* ---- Act two, on its own clock. ------------------------------ */
        const a2 = clock.gallery
          ? clamp01((raw - clock.gallery.start) / clock.gallery.span)
          : 0;

        /* The render steps aside. Eased, not linear: a fixed layer leaving
           at a constant rate reads as a dimmer being turned, where this
           should read as the frame being handed over. */
        root.style.setProperty(
          '--stage',
          String(1 - smoothstep(EXIT_WINDOW[0], EXIT_WINDOW[1], a2))
        );

        /* Applied after `slide`, never before — both write xPercent,
           yPercent, scale and color on the same heading, and this one has
           to be the last writer for the handoff to hold. */
        lockP = clamp01((a2 - LOCKUP_WINDOW[0]) / (LOCKUP_WINDOW[1] - LOCKUP_WINDOW[0]));
        /* ONE writer at a time, and the one that is not writing has to be
           forced to write.

           Both timelines set xPercent, yPercent, scale and opacity on this
           heading, so whichever runs last in a frame owns it. That much the
           handoff comment above already assumed. What it missed is that a
           PAUSED GSAP timeline whose progress has not changed does not
           re-render — so when `slide` sits at progress 0 through act one it
           writes nothing at all, and whatever wrote last keeps the element.

           Measured on a clean pass from scroll 0: through act one p = 0.718
           to 0.797 the line sat at the lockup's END state, x -90.3 and scale
           0.129, at FULL OPACITY — the finished corner lockup, on screen a
           fifth of an act before the travel that is meant to produce it. At
           p = 0.827 it vanished and restarted the slide from x 26.7. That is
           the discontinuity: the end of the move playing before the move.

           So act two writes only while it is running, and outside it the
           slide is re-rendered by force. render(time, suppressEvents, force)
           is what defeats the skip — progress() alone would be ignored,
           because the time it is being set to is the time it is already at. */
        if (a2 > 0) {
          lock?.progress(lockP);
        } else if (slideP === 0 && slideHeadRef.current) {
          /* Reset, rather than trusting a timeline to do it.

             Rendering `slide` at time 0 does not touch this heading: its
             tween starts at 0.1 on that timeline, so a time-0 render has
             nothing to write, and the element keeps whatever wrote to it
             last. What wrote last is `lock` — ScrollTrigger evaluates the
             scrub near its end during refresh, which puts lock at progress
             1 and stamps the corner lockup onto the line before the reader
             has scrolled anywhere.

             Measured on a clean pass from scroll 0: from act one p = 0.68
             to 0.79 the line sat at x -90.3, scale 0.129, opacity 1 — the
             finished lockup, on screen for a tenth of the page before the
             travel that produces it, then vanishing to restart from the
             right. Guarded on slideP === 0 so this only ever writes before
             the travel begins and never fights it. */
          gsap.set(slideHeadRef.current, SLIDE_FROM);
        }

        galleryRef.current?.setProgress(
          clamp01((a2 - GALLERY_WINDOW[0]) / (GALLERY_WINDOW[1] - GALLERY_WINDOW[0]))
        );

        /* The doorway. Still act two's clock — the gate belongs to the
           gallery right up until it has finished opening, and act three's
           own clock does not start until it has. */
        /* Put act three behind the gallery before its empty slot gets to
           the gate.

           The strip's last slot has no photograph in it — act three IS the
           last card — so the section has to be standing there already as
           that hole slides in, or the filmstrip ends on a black rectangle
           that fills in afterwards. Gating this on the doorway alone was
           exactly that bug: the doorway starts on the frame the travel
           ENDS, a full card-width too late.

           The moment is imported rather than typed. FieldGallery derives it
           from its own slot count and aperture split, so adding or removing
           a photograph moves this automatically instead of silently
           leaving it a card behind. */
        const entry =
          GALLERY_WINDOW[0] +
          doorwayEntry(product.gallery?.length ?? 0) * (GALLERY_WINDOW[1] - GALLERY_WINDOW[0]);
        const doorway = clamp01((a2 - ZOOM_WINDOW[0]) / (ZOOM_WINDOW[1] - ZOOM_WINDOW[0]));
        galleryRef.current?.setZoom(doorway);
        benchRef.current?.setZoom(doorway);

        /* The lockup leaves WITH the thumbnails.

           "So serviceable, / it's compact" and the side strips are the same
           thing at this point — the furniture around a card that has landed
           — so they clear together and the frame is left holding only the
           picture. Keyed to the gallery's own EXIT_DUR rather than a number
           of its own: the two are meant to be one move, and a second
           literal here would let them drift the moment either is retuned.

           Written directly rather than through a timeline because two
           already own this pair — `slide` writes the head's opacity and
           `lock` writes its transform. A third would have to be ordered
           against both. This runs after both in the same function, so it is
           the last writer and neither can undo it.

           GUARDED ON THE ACT, not on the doorway.

           It used to be `if (doorway > 0)`, which is a one-way write: the
           only time it runs is while the gate is opening, so the fade to
           zero happens and then nothing ever writes again. Scroll back up
           and the line stays invisible, because neither timeline restores
           it — `slide` sits at progress 1 and does not re-render, and
           `lock` never touches opacity at all. Measured: inline opacity
           stuck at "0" across the whole of act two after the doorway had
           once been open.

           Keyed to the act instead, the expression is total: at doorway 0
           it evaluates to 1, which is exactly what `slide` left behind, so
           the handoff is continuous — and it stays correct scrolling in
           either direction because every position has a defined value
           rather than a remembered one.

           The original guard existed to stop this pinning the line visible
           over the opening frame, and that reason is still real. `a2 > 0`
           answers it properly: above act two this writes nothing and the
           slide keeps its say, which is what the top of the page needs. */
        if (a2 > 0) {
          const lockOut = String(1 - smoothstep(0, EXIT_DUR, doorway));
          if (slideHeadRef.current) slideHeadRef.current.style.opacity = lockOut;
          if (slideLabelRef.current) slideLabelRef.current.style.opacity = lockOut;
        }

        /* ---- Act three, on its own clock. ---------------------------- */
        benchRef.current?.setProgress(
          clock.bench ? clamp01((raw - clock.bench.start) / clock.bench.span) : 0
        );

        /* ---- Act four: the return ------------------------------------ */
        const a4 = clock.closing
          ? clamp01((raw - clock.closing.start) / clock.closing.span)
          : 0;
        /* The frames run on their OWN window inside the act, not on the act
           itself — see RETURN_SEQ. The act is longer than the sequence on
           purpose, so the last stretch is holding room for a scrub tail
           that can only be reached at rest. Driving the frames off `a4`
           directly would spread 31 of them over all 420vh and quadruple the
           scroll between neighbours. */
        endSeqRef.current?.setProgress(
          clamp01((a4 - ret.SEQ[0]) / (ret.SEQ[1] - ret.SEQ[0]))
        );

        /* The plate comes back — see RETURN_PLATE. Written to the same
           --field the opening act fades out, so one variable controls
           whether the photograph is present rather than two fighting over
           it. Act one only ever drives it down, this only ever drives it up,
           and two whole acts separate them.

           It comes back CLEAN. --field is only its presence; act one also
           spent the photograph's brightness down to DIM_FLOOR and raised the
           bloom over it, and neither of those unwinds on its own. Restore
           only --field and the ground returns at a third brightness under a
           yellow haze — present, and wrong. The end frame has to match the
           opening frame, and at the opening frame both of these are at their
           untouched values.

           Reset rather than faded, because the plate is invisible while this
           happens: --field does not start moving until RETURN_PLATE at 0.46,
           so there is nothing on screen to see the brightness snap on. */
        if (a4 > 0) {
          root.style.setProperty('--field', String(smoothstep(ret.PLATE[0], ret.PLATE[1], a4)));
          root.style.setProperty('--plate-dim', '1');
        }

        /* The bloom, on the CARD's window rather than the plate's.

           It is a fixed layer at z-1 and the bench sits at z-9 over it, so
           act three hides it by covering it, not by turning it off. The
           moment the bench fades the bloom is uncovered — so it has to be
           gone by the time that finishes, which is RETURN_CARD, well before
           the plate arrives. Tie it to RETURN_PLATE instead and a yellow
           corner appears out of nothing as the card leaves. */
        if (a4 > 0) {
          root.style.setProperty(
            '--bloom',
            String(1 - smoothstep(ret.CARD[0], ret.CARD[1], a4))
          );
        }
        /* The returning aircraft's own layer. Up for the whole act, since
           the sequence's first frame is already the aircraft in shot. */
        root.style.setProperty('--end-stage', a4 > 0 ? '1' : '0');

        /* The closing card, over the returned hero. Held at 0 until act four
           so it cannot appear during the opening — a4 is 0 for the whole
           page above this, and smoothstep of a window starting at 0.56
           would be 0 anyway, but writing it unconditionally means the
           variable always has a value and never inherits a stale one. */
        root.style.setProperty(
          '--cta',
          String(smoothstep(ret.CTA[0], ret.CTA[1], a4))
        );

        /* The P10 Pro card leaves ahead of everything else. */
        benchRef.current?.setOutro(
          1 - smoothstep(ret.CARD[0], ret.CARD[1], a4)
        );

        /* ---- The guard ----------------------------------------------- */

        /* Where the READER is, which is not always where the timeline is.

           `raw` is the scrub's position and it trails the wheel by design.
           After a long jump — bottom to top, or one hard flick — it is
           still genuinely in act two for a second or more while the reader
           is already looking at the hero, and acts two and three go on
           painting their frame over act one's the whole time. Measured at
           2.5 seconds of a gallery photograph sitting on the opening shot.

           Scroll position never lags, so it is what decides whether a
           section may be on screen at all. Used ONLY to hide: every value
           in the choreography still comes from `raw`, so this stays a guard
           and does not become the second source of truth this page is
           otherwise careful not to have.

           The margins are one-sided on purpose. Generous ahead of each
           section, so a fast scroll DOWN never hides something that is
           about to be needed; tight behind, because that is the direction
           the fault appears in. */
        const here = clamp01(window.scrollY / maxScroll);

        /* Each section is gated to ITS OWN stretch of the page, not to a
           shared one. Gating both from the start of act two was too loose
           by half: it left the bench permitted across the whole of act two,
           so coming back up and stopping anywhere in there still let it
           paint a full-screen photograph over a frame it has no business
           in — which is the state that reads as an image stuck in the
           middle of the screen.

           The bench's gate is the same derived point as its arming, so the
           two cannot drift apart: it may be on screen from just before the
           moment it is needed behind the gallery's last card, and not one
           screen earlier. */
        const g = clock.gallery;
        const armPoint = g ? g.start + (entry - 0.03) * g.span : 1;
        galleryRef.current?.setEnabled(!!g && here > g.start - 0.02);
        benchRef.current?.setEnabled(here > armPoint - 0.02);
        benchRef.current?.setArmed(a2 > entry - 0.03);
      };
      measureMorph();
      measureLockup();
      apply(0);

      /* The clamped type size and the kicker's height both move with the
         viewport, and D-DIN lands after first paint — so the corner-to-corner
         travel has to be re-solved on both, then re-applied at the current
         scroll position rather than snapping back to rest. */
      const remeasure = () => {
        measureScroll();
        measureMorph();
        measureLockup();
        /* Both sets of targets are function-based, so they are only re-read
           once the recorded ones have been thrown away. */
        lock?.invalidate();
        /* rawP, not progress.current.p — the latter holds act-one time,
           and feeding it back in would replay the page from half way. */
        apply(rawP.current);
      };
      window.addEventListener('resize', remeasure);
      if (document.fonts?.ready) void document.fonts.ready.then(remeasure);

      /* fonts.ready is not sufficient on its own for the lockup.
         It resolves once the face has loaded, which is not the same frame
         the swapped metrics reach layout — and the lockup's landing
         position is a function of the LINE'S WIDTH, so measuring one frame
         early bakes in the fallback's width. The symptom was specific and
         quiet: the line came to rest 4px right of the kicker it is
         supposed to align with, because Satoshi renders that string 8.5px
         narrower than the fallback did.

         A ResizeObserver keys on the thing that actually matters — the
         box changing — so it covers the font swap, the viewport, and any
         later copy edit without any of them being anticipated. It cannot
         loop: remeasure only writes transforms, and transforms do not
         change the border-box size an observer reports. */
      const ro = new ResizeObserver(remeasure);
      if (slideHeadRef.current) ro.observe(slideHeadRef.current);
      if (slideLabelRef.current) ro.observe(slideLabelRef.current);
      if (stmtHeadRef.current) ro.observe(stmtHeadRef.current);
      if (codaTagRef.current) ro.observe(codaTagRef.current);

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const proxy = { p: 0 };

        /* Split only the paragraphs, not the card: the dashed rule between
           them is an <hr> and must not end up inside a line wrapper. */
        const split = cardRef.current
          ? SplitText.create(cardRef.current.querySelectorAll('p'), {
              type: 'lines',
              /* Wraps each line in its own overflow:hidden box. Without this
                 the lines would simply slide over the card's neighbours
                 instead of disappearing into their own edge. */
              mask: 'lines',
              /* Line boxes are measured at split time. D-DIN arrives after
                 first paint, so without autoSplit the wraps stay measured
                 against the fallback face and the mask cuts in the wrong
                 places. */
              autoSplit: true,
              aria: 'auto',
              onSplit: (self) => {
                retract = gsap.timeline({ paused: true }).to(self.lines, {
                  yPercent: 110,
                  ease: 'none',
                  /* Downward, so the lines drop out of the bottom of their
                     masks. from 'end' keeps the bottom-most line leaving
                     first, so the card empties from the bottom up rather
                     than the whole block sliding as one. */
                  stagger: { each: 0.22, from: 'end' },
                });
                /* A re-split can land mid-scroll; restore where we were so
                   the lines do not pop back down. */
                retract.progress(retractP);
                return retract;
              },
            })
          : null;

        /* Right-hand paragraph. No mask here — a mask would clip the blur
           back to a hard edge, which is the one thing that gives a blurred
           exit away as a filter rather than as depth. The lines are free to
           drift past their own box. */
        const paraSplit = paraRef.current
          ? SplitText.create(paraRef.current, {
              type: 'lines',
              autoSplit: true,
              aria: 'auto',
              onSplit: (self) => {
                drift = gsap.timeline({ paused: true }).to(self.lines, {
                  xPercent: 14,
                  opacity: 0,
                  filter: 'blur(10px)',
                  ease: 'none',
                  /* Default stagger order: top line goes first, so the block
                     empties in reading order. */
                  stagger: { each: 0.18 },
                });
                drift.progress(driftP);
                return drift;
              },
            })
          : null;

        /* Kicker. Masked like the card, but split on words and travelling
           up. wordDelimiter stays the default space, so "fields." keeps its
           full stop rather than orphaning punctuation in its own mask. */
        const kickSplit = kickerRef.current
          ? SplitText.create(kickerRef.current, {
              type: 'words',
              mask: 'words',
              autoSplit: true,
              aria: 'auto',
              onSplit: (self) => {
                kick = gsap.timeline({ paused: true }).to(self.words, {
                  yPercent: -110,
                  ease: 'none',
                  /* from 'start': the leftmost word goes first, so the line
                     empties in reading order, out from the page margin. */
                  stagger: { each: 0.06, from: 'start' },
                });
                kick.progress(kickP);
                return kick;
              },
            })
          : null;

        /* Void statement. Still ONE SplitText across both blocks — a single
           instance means one autoSplit lifecycle and one timeline to rebuild
           on re-split. The chars are partitioned by ownership afterwards,
           because the two blocks sweep in opposite directions and cannot
           share a stagger. */
        const stmtHead = stmtHeadRef.current;
        const stmtPara = stmtParaRef.current;
        const stmtEls = [stmtHead, stmtPara].filter(Boolean) as HTMLElement[];
        const stmtSplit = stmtEls.length
          ? SplitText.create(stmtEls, {
              type: 'chars,words',
              autoSplit: true,
              aria: 'auto',
              /* Named so the sweep is inspectable from the console and in
                 tests — SplitText adds no class of its own. */
              charsClass: 'da-char',
              onSplit: (self) => {
                const headChars = self.chars.filter((c) => stmtHead?.contains(c));
                const paraChars = self.chars.filter((c) => stmtPara?.contains(c));
                const FADE = STATEMENT_CHAR_FADE;
                const EACH = 0.012;

                story = gsap.timeline({ paused: true });
                story
                  /* The two blocks travel in opposite directions and keep
                     going on the way out — the headline drops in from above
                     and continues down, the paragraph rises from below and
                     continues up. Each exit is a continuation of its own
                     entrance rather than a rewind of it. */
                  .fromTo(stmtHead, { y: -26 }, { y: 0, duration: 0.7, ease: 'power2.out' }, 0)
                  .fromTo(stmtPara, { y: 26 }, { y: 0, duration: 0.7, ease: 'power2.out' }, 0)
                  /* Headline reads backwards — last glyph of the sentence
                     lights first, running back to the first. */
                  .fromTo(
                    headChars,
                    { opacity: 0 },
                    { opacity: 1, duration: FADE, ease: 'none', stagger: { each: EACH, from: 'end' } },
                    0
                  )
                  .fromTo(
                    paraChars,
                    { opacity: 0 },
                    { opacity: 1, duration: FADE, ease: 'none', stagger: { each: EACH } },
                    0
                  )
                  // Held lit, so it can actually be read mid-scroll.
                  .to({}, { duration: STATEMENT_HOLD })
                  /* Both blocks leave the way they arrived — per character,
                     the headline running backwards from its last glyph. It
                     briefly did not: the headline was held back so it could
                     morph into the coda's label, which meant this sweep was
                     removed and the sentence ended by travelling instead of
                     by unwriting. */
                  .to(headChars, {
                    opacity: 0,
                    duration: FADE,
                    ease: 'none',
                    stagger: { each: EACH, from: 'end' },
                  })
                  .to(
                    paraChars,
                    { opacity: 0, duration: FADE, ease: 'none', stagger: { each: EACH } },
                    '<'
                  )
                  .to(stmtHead, { y: 26, duration: 0.7, ease: 'power2.in' }, '<')
                  .to(stmtPara, { y: -26, duration: 0.7, ease: 'power2.in' }, '<');
                story.progress(storyP);
                return story;
              },
            })
          : null;

        /* Slide. The label writes in first, the reticle draws around the
           aircraft, and the oversized line travels across behind it. Linear on
           the line — it is a physical pass, and easing it would make it look
           like it is being placed rather than moving through. */
        const slideLabel = slideLabelRef.current;
        const slideHead = slideHeadRef.current;
        const reticle = reticleRef.current;
        const slideSplit = slideLabel
          ? SplitText.create(slideLabel, {
              type: 'chars,words',
              autoSplit: true,
              aria: 'auto',
              charsClass: 'da-slide-char',
              onSplit: (self) => {
                slide = gsap.timeline({ paused: true });
                slide
                  .fromTo(
                    self.chars,
                    { opacity: 0 },
                    { opacity: 1, duration: 0.15, ease: 'none', stagger: { each: 0.02 } },
                    0
                  )
                  .fromTo(
                    reticle,
                    { opacity: 0, scale: 1.25 },
                    { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' },
                    0.15
                  )
                  /* xPercent -50 IS the centring — it is not a stylistic
                     offset. GSAP folds Tailwind's separate `translate`
                     property into its own transform and then clears it, so
                     `-translate-x-1/2` cannot survive an explicit xPercent:
                     the value is absolute, and writing 0 discards the -50%
                     that was centring the element. Anything GSAP moves on X
                     has to carry its own centring here rather than in a
                     utility class. */
                  .fromTo(
                    slideHead,
                    { ...SLIDE_FROM },
                    // Comes to rest dead centre, spanning the full width.
                    { xPercent: -50, yPercent: -50, opacity: 1, duration: 2.2, ease: 'none' },
                    0.1
                  )
                  /* Once it has landed it comes UP IN VALUE and swells.

                     Value, not a halo. Checked against oryzo directly: their
                     display type carries textShadow none, filter none and
                     mixBlendMode normal — there is no glow on it anywhere.
                     What reads as luminance is a warm cream sitting on a dark
                     warm ground, with the actual light rendered in the WebGL
                     layer behind. A text-shadow halo is a different effect
                     that only resembles it in description.

                     Appended to THIS timeline rather than given a window of
                     its own: the internal proportions already phase it, so
                     travel takes ~72% of the scroll window and this the rest,
                     with no second mapping to keep in sync. Same tween target
                     too, so scale composes with the xPercent centring rather
                     than fighting it. */
                  .to(
                    slideHead,
                    {
                      scale: 1.14,
                      color: '#f2ecd9',
                      duration: 0.9,
                      ease: 'power1.inOut',
                      transformOrigin: '50% 50%',
                    },
                    2.3
                  );
                slide.progress(slideP);
                return slide;
              },
            })
          : null;

        /* The lockup. The line stops being a headline and becomes a label:
           it shrinks out of the middle of the frame and comes to rest under
           its own kicker at the top left, which is the move that makes the
           gallery read as the same sentence continuing rather than as a new
           section starting.

           Function-based values, because every one of them is measured and
           the measurements move with the window. remeasure() invalidates
           this timeline so they are re-derived rather than staying at
           whatever the first layout happened to produce.

           The reticle leaves here too rather than on --stage with the
           render: GSAP already owns its opacity from the slide timeline
           above, and a CSS variable writing the same property would be a
           second author for one value. */
        if (slideHead) {
          lock = gsap.timeline({ paused: true });
          lock
            .fromTo(
              slideHead,
              { xPercent: -50, yPercent: -50, scale: 1.14 },
              {
                xPercent: () => lockTo.xPercent,
                yPercent: () => lockTo.yPercent,
                scale: () => lockTo.scale,
                duration: 1,
                ease: 'power2.inOut',
                transformOrigin: '50% 50%',
                /* Without this the fromTo writes its start values the
                   moment it is built and snaps the line to its slide-end
                   state on first paint, half a page early. */
                immediateRender: false,
              },
              0
            )
            /* Starts fractionally later and lands together — the kicker has
               a fraction of the distance to cover, so leaving at the same
               moment would have it arrive early and wait. */
            .fromTo(
              slideLabel ? [slideLabel] : [],
              { y: 0 },
              {
                y: () => lockTo.labelY,
                duration: 0.86,
                ease: 'power2.inOut',
                immediateRender: false,
              },
              0.14
            )
            .to(
              reticle ? [reticle] : [],
              { opacity: 0, scale: 1.1, duration: 0.5, ease: 'power2.in' },
              0
            );
          lock.progress(lockP);
        }

        /* Coda. The headline splits to chars so it writes in; the three-liner
           arrives as a block behind it, hung off the same right-hand axis.

           The label slot above the note is NOT animated here any more. It is
           filled by the statement's headline arriving under its own timeline,
           so the element that used to sit there is now only a measuring
           target — animating it would fade in a label the handoff is about to
           land on top of. */
        const codaHead = codaHeadRef.current;
        const codaTag = codaTagRef.current;
        const codaNote = codaNoteRef.current;
        /* The three-line note arrives LINE BY LINE, each rising out of its
           own clip.

           `mask: 'lines'` is what makes it rise out of nothing rather than
           drift up from below: SplitText wraps every line in an
           overflow-hidden parent, so a line translated 100% down is not
           merely off-position, it is outside its own box and invisible. A
           plain y-offset with opacity — which is what this block used to
           do, as one lump — reads as a card sliding in. Clipped, it reads
           as the words being written.

           Split separately from the headline because the two want different
           units: the headline is per-CHARACTER, which is right for four
           words at display size, and per-character on three sentences of
           small caps is noise. Lines here, characters there. */
        /* Split INSIDE the headline's onSplit, and never with autoSplit.

           It was a sibling call with autoSplit: true, and that is a stale
           reference waiting to happen. autoSplit re-splits on font load and
           on resize, which DESTROYS the line elements and builds new ones —
           but the timeline below was built once, holding the originals. It
           then animated detached nodes while the fresh ones rendered at
           rest, so the copy sat fully visible for the whole act instead of
           rising into place. Measured on mobile: offset 0.00 at every
           scroll position, with the lines correctly masked and correctly
           parented, which is why it looked like the animation had simply
           been ignored.

           Desktop hid it. Nothing there triggers a re-split after the
           timeline is built; a phone does it constantly — images landing in
           the flow sections below, the address bar collapsing, the layout
           settling.

           The fix is autoSplit: false, not moving the call. These lines are
           created ONCE and never replaced, so the references the timeline
           captures stay valid for as long as it does — which is what makes
           it safe to build the timeline from a split declared outside its
           callback, the thing autoSplit made unsafe.

           autoSplit buys nothing here anyway: the note's breaks come from
           its own <br> tags, not from wrapping, so re-measuring cannot
           change them. The headline above still uses it, and must — its
           characters DO re-flow, which is why its timeline is rebuilt from
           inside onSplit every time.

           revert() first so a re-run cannot stack mask wrappers. */
        noteSplit?.revert();
        noteSplit = codaNote
          ? SplitText.create(codaNote, {
              type: 'lines',
              mask: 'lines',
              aria: 'auto',
              linesClass: 'da-coda-line',
            })
          : null;

        const codaSplit = codaHead
          ? SplitText.create(codaHead, {
              type: 'chars,words',
              autoSplit: true,
              aria: 'auto',
              charsClass: 'da-coda-char',
              onSplit: (self) => {
                /* The note is back in codaSide, so the BLOCK carries an
                   opacity in and out alongside the tag.

                   Belt and braces, deliberately. The line masks are what
                   make it rise, but they only hide anything while the
                   timeline is actually driving them — and when a stale
                   split silently broke that link, the copy sat on screen
                   for the entire act with nothing to switch it off. An
                   opacity on the parent cannot be defeated that way: if the
                   timeline runs at all, the block is hidden outside its
                   window, whatever the lines inside are doing. */
                const codaSide = [codaTag, codaNote].filter(Boolean);
                const noteLines = noteSplit?.lines ?? [];
                coda = gsap.timeline({ paused: true });
                coda
                  .fromTo(
                    self.chars,
                    { opacity: 0, y: 18 },
                    { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: { each: 0.012 } },
                    0
                  )
                  .fromTo(
                    codaSide,
                    { opacity: 0, y: 16 },
                    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.12 },
                    0.35
                  )
                  /* yPercent, not y: the travel is one line-height whatever
                     the clamped type size resolves to, so it stays a clean
                     rise from the mask edge at every viewport instead of a
                     fixed pixel distance that overshoots on small screens
                     and barely moves on large ones.

                     0.14 between lines — slow enough to read as three
                     separate statements, which is what the copy is. */
                  .fromTo(
                    noteLines,
                    { yPercent: 100 },
                    {
                      yPercent: 0,
                      duration: 0.55,
                      ease: 'power3.out',
                      stagger: { each: 0.14 },
                    },
                    0.4
                  )
                  /* Held long enough to be read before it is taken away,
                     and then longer still.

                     Doubled from 1.4, and CODA_WINDOW widened in the same
                     proportion rather than left alone. That pairing is the
                     point: a longer hold inside an UNCHANGED window does
                     not buy reading time, it just makes the entrance and
                     the exit quicker to make room for it. Widening the
                     window as well is what turns the extra duration into
                     extra scroll spent on a panel that has fully arrived
                     and has not begun to leave. */
                  .to({}, { duration: 2.8 })
                  /* Leaves as a block, not per character. It wrote itself in
                     letter by letter; unwriting it the same way would read as
                     a rewind rather than as making room for what follows. */
                  .to(codaSide, { opacity: 0, y: -14, duration: 0.45, ease: 'power2.in' })
                  /* No separate exit for the lines. They leave inside the
                     block fade above — lifting them through their masks as
                     well would be two departures at once, and the rise is
                     the entrance's gesture, not the exit's. */
                  .to(codaHead, { opacity: 0, y: -18, duration: 0.5, ease: 'power2.in' }, '<0.08');
                coda.progress(codaP);

                        return coda;
              },
            })
          : null;
        const tween = gsap.to(proxy, {
          p: 1,
          ease: 'none',
          onUpdate: () => apply(proxy.p),
          scrollTrigger: {
            trigger: '#field-spacer',
            start: 'top top',
            end: 'bottom bottom',
            /* scrub is the damping. It replaces the hand-rolled
               `smooth += (target - smooth) * 0.06` the prototype used. */
            scrub: 1,
          },
        });

        const setPointer = (x: number, y: number) => {
          root.style.setProperty('--mx', x.toFixed(4));
          root.style.setProperty('--my', y.toFixed(4));
        };
        const onPointer = (e: PointerEvent) =>
          setPointer(
            (e.clientX / window.innerWidth) * 2 - 1,
            (e.clientY / window.innerHeight) * 2 - 1
          );
        // Recentre on leave so the warm layer never holds an offset.
        const onLeave = () => setPointer(0, 0);
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
          window.addEventListener('pointermove', onPointer, { passive: true });
          window.addEventListener('pointerleave', onLeave, { passive: true });
        }

        /* The canvas is a dynamic ssr:false import and the model loads
           async, so the document height settles well after the trigger is
           first measured. Without this the timeline stays anchored to the
           shorter initial layout. */
        const refresh = () => ScrollTrigger.refresh();
        window.addEventListener('load', refresh);
        if (document.fonts?.ready) void document.fonts.ready.then(refresh);

        return () => {
          window.removeEventListener('pointermove', onPointer);
          window.removeEventListener('pointerleave', onLeave);
          window.removeEventListener('load', refresh);
          tween.scrollTrigger?.kill();
          tween.kill();
          split?.revert();
          paraSplit?.revert();
          kickSplit?.revert();
          noteSplit?.revert();
          stmtSplit?.revert();
          codaSplit?.revert();
          slideSplit?.revert();
          retract = null;
          drift = null;
          kick = null;
          story = null;
          coda = null;
          slide = null;
          lock?.kill();
          lock = null;
        };
      });

      /* Reduced motion: no scrub, no idle orbit. The beats still happen,
         but stepped off scroll position directly. */
      mm.add('(prefers-reduced-motion: reduce)', () => {
        const st = ScrollTrigger.create({
          trigger: '#field-spacer',
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => apply(self.progress),
        });
        return () => st.kill();
      });

      return () => {
        window.removeEventListener('resize', remeasure);
        ro.disconnect();
        mm.revert();
      };
    },
    /* Rebuilt when the act clock changes — which happens exactly once,
       when the solved hero length arrives just after mount, and again on a
       rotation that flips `narrow`. Without this the hook runs a single
       time and closes over the first render's fractions forever. */
    /* revertOnUpdate IS LOAD-BEARING. useGSAP does NOT tear down the
       previous run when its dependencies change unless told to — the
       default is false. So the rebuild above ADDED a second copy of this
       whole scroll machine instead of replacing the first: two scrub
       tweens, two apply()s, both writing the same elements every frame,
       one on the declared act lengths and one on the solved ones. On the
       P10 that made "it's compact" jump between two positions mid-pass.
       Mini, Noxr and Cyclops had the same two copies, invisibly: with a
       single act, both compute nearly the same values. */
    { scope: rootRef, dependencies: [clock, spacerVh], revertOnUpdate: true }
  );

  const introStyle = { opacity: 'var(--intro, 1)' } as React.CSSProperties;

  return (
    <div ref={rootRef} className="relative bg-[#090b07] text-[#f2ecd9]">
      <>
          {/* The plate. Sits below the canvas by DOM order rather than by a
              higher z-index on the canvas, so both stay at z-0 and the warm
              and bloom layers above them keep working unchanged. */}


          {/* Instead of the plate, never as well as. Both are fixed at
              z-0 and this one comes second in DOM order, so with the
              photograph on it would paint over it — and its upper wash is
              opaque enough to grey out the top half of the picture. */}
          <div className={styles.ground} aria-hidden />
          <div className={styles.grain} aria-hidden />

          {/* Stage graphics. Deliberately placed BETWEEN the plate and the
              canvas: all three layers are z-0, so DOM order decides, and
              anything here paints behind the aircraft. That is the whole
              point — the drone occludes the line as it passes, which is what
              puts it *in* the scene rather than on top of it. A higher
              z-index on the canvas would work too, but this keeps every
              backdrop layer on one plane and the order readable. */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
            {/* The name, oversized, BEHIND the aircraft.

                This is why it lives in this layer rather than with the rest
                of the copy: everything here is z-0 and painted before the
                canvas, so the drone occludes the letters it passes over.
                That occlusion is the whole effect — the same type at z-10
                would sit on top of the machine and read as a caption.

                Clipped to the text with background-clip so the letters carry
                a gradient rather than a flat fill: bright at the crown,
                falling away toward the baseline, which is what stops a
                wordmark this size becoming a solid slab.

                whitespace-nowrap with a vw size, like the footer's — the
                string is 7 characters and 17vw fills the frame at that
                count. Changing the words means re-measuring it. */}
            {HERO_CENTRED && (
              <p
                ref={bigWordRef}
                /* Higher up AND larger on narrow.

                   17vw is solved for a wide screen, where the frame is far
                   wider than it is tall and 17% of that is a lot of type.
                   On a phone the same number gives a wordmark spanning only
                   61% of the width — it reads as a caption rather than as
                   the name of the thing. 24vw takes it to 86%, measured
                   against this face at 0.514em per character over seven
                   characters.

                   86% and not more because the string is nowrap: it cannot
                   reflow if it outgrows the frame, it simply runs off both
                   edges. The remaining 14% is the gutter that keeps that
                   from being one bad font-swap away.

                   Re-measure if the product NAME changes length — this is
                   solved against seven characters, and 'Cyclops Mini' is
                   twelve.

                   27% so the baseline just meets the aircraft rather than
                   floating above it. Measured at 260x563: the wordmark is
                   51px tall (24vw x 0.82 leading) and the aircraft's first
                   frame starts at y 201, so a 16% anchor left a 59px gap
                   that read as two unrelated objects. 27% puts the bottom
                   at 203 — two pixels into the propeller line, which is
                   what makes the name look like it is resting on the
                   machine.

                   It holds across phones because they share an aspect
                   ratio: 260x563 and 390x844 are both 0.462, so the
                   wordmark's height as a fraction of the VIEWPORT HEIGHT is
                   the same 9.1% at either size. A tablet in portrait is a
                   different ratio and would want its own number, which is
                   what the md: breakpoint below is for. */
                className={
                  'absolute left-1/2 top-[27%] w-max -translate-x-1/2 whitespace-nowrap ' +
                  'font-display uppercase leading-[0.82] tracking-[-0.03em] ' +
                  'will-change-transform md:top-[26%] ' +
                  styles.bigWord
                }
                style={{
                  /* Read by .bigWord to solve the size — see its note. */
                  ['--chars' as string]: product.name.length,
                  backgroundImage:
                    'linear-gradient(180deg, rgba(226,190,190,0.92) 0%, rgba(150,116,116,0.55) 42%, rgba(72,58,58,0.16) 82%, rgba(60,50,50,0.04) 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {product.name}
              </p>
            )}

            {/* Reticle. Drawn, not an image, so the dashes stay crisp at any
                size and the whole thing costs nothing to animate. */}
            <svg
              ref={reticleRef}
              className="absolute left-1/2 top-1/2 size-[min(46vw,62vh)] -translate-x-1/2 -translate-y-1/2 opacity-0"
              viewBox="0 0 200 200"
              fill="none"
              stroke="rgba(242,236,217,0.45)"
              strokeWidth="0.6"
            >
              <circle cx="100" cy="100" r="72" strokeDasharray="2 5" />
              <path d="M20 20h34M20 20v34M180 20h-34M180 20v34M20 180h34M20 180v-34M180 180h-34M180 180v-34" />
              <path d="M100 20v9M100 180v-9M20 100h9M180 100h-9" />
              <circle cx="176" cy="24" r="2.6" fill="rgba(242,236,217,0.9)" stroke="none" />
            </svg>

            {/* The travelling line. Sits on the vertical centre so the
                aircraft crosses it, and runs off both edges — it is a pass,
                not a placed headline. */}
            {/* Sized so the string spans the viewport at rest, and tied to vw
                rather than a clamp ceiling so it keeps filling the frame on
                wide screens instead of stranding margins.

                normal-case is load-bearing, not cosmetic: globals.css sets
                text-transform: uppercase directly on h1-h6, and the .home
                reset that neutralises it does not cover this route. Without
                this the line renders in caps regardless of the copy.

                The size is specific to THIS string. Lowercase glyphs are
                narrower and there are fewer of them, so it needs ~19.5vw where
                the previous uppercase phrase needed 13. Change the words and
                this has to be re-measured. */}
            <h2
              ref={slideHeadRef}
              className="absolute left-1/2 top-1/2 whitespace-nowrap font-display text-[19.5vw] normal-case leading-[0.9] tracking-[-0.045em] opacity-0"
            >
              {product.slide}
            </h2>

          </div>

          {/* The closing card, centred.

              Worth knowing what it is centred OVER: the returned
              composition has the aircraft back in its opening pose in the
              middle of frame, so the headline and the subject share the
              centre. That is the intent — it reads as a title card laid on
              the shot rather than as copy arranged around it — but it does
              mean the type's legibility now depends on the plate behind it
              rather than on empty space. If a future plate is busier or
              lighter, this needs a scrim behind the text, not a nudge
              downward; moving it back to the lower frame would put it over
              the landing gear and the ground, which is the busiest part of
              the picture.

              z-[11] puts it over the plate and the returning render at z-0,
              and over the bench at z-[9] which is gone by now anyway. It
              stays BELOW the footer, which is z-20 and in flow, so the
              footer rises over a finished card rather than colliding with
              it.

              pointer-events are off on the wrapper and back on for the
              buttons alone — the card covers the whole viewport to
              position itself, and a full-screen transparent layer that
              swallows clicks is how a page ends up feeling broken. */}
          {/* AND THE DATA, not just the clock. The whole card below was
              typed in — kicker, headline, body, label and the mailto — so a
              second product declaring a closing act would have invited the
              reader to book a demo of the P10. It never leaked only because
              the P10 is the one page that declares this act. The rule the
              file already states is that an act you declare must bring its
              data; this is that rule finally applied here. */}
          {clock.closing && product.closing && (
          <div
            className="pointer-events-none fixed inset-0 z-[11] flex items-center justify-center"
            style={{
              opacity: 'var(--cta, 0)',
              transform: 'translate3d(0, calc((1 - var(--cta, 0)) * 3vh), 0)',
            }}
          >
            {/* No max-width on the block — the headline is sized to SPAN,
                and a 900px cap is what was folding it onto two lines. The
                body copy keeps its own measure below instead, so the two
                are constrained by different things: the headline by the
                viewport, the paragraph by readability. */}
            <div className="w-full px-[var(--pad-x,5vw)] text-center">
              <p className="font-display text-[clamp(10px,0.82vw,15px)] font-bold uppercase tracking-[0.14em] opacity-70">
                {product.closing.kicker}
              </p>

              {/* One line, and sized to the STRING rather than picked.

                  "BRING IT TO YOUR FIELD" is 22 characters, and MEASURED at
                  this face, weight and tracking they run 0.514em each — not
                  the ~0.62 I first assumed, which is why 5.4vw only spanned
                  61% of the viewport and looked timid. The largest size the
                  string still fits at, inside the 5vw gutters, is 7.97vw;
                  7.4 takes most of that and keeps a margin for the font
                  loading at slightly different metrics.

                  Re-measure if the words change. Twenty-two characters is
                  the whole basis of this number, and a longer line will
                  silently overflow rather than wrap — see below. The footer
                  wordmark carries the same warning for the same reason.

                  nowrap is load-bearing with a vw size: without it a narrow
                  window wraps mid-phrase, and with it the line simply scales
                  down, which is what a display line should do. It also means
                  there is no safety net if the string outgrows the size —
                  the text runs past the gutter instead of folding. Checked
                  at both clamp ends: at the 150px cap the line is 1696px
                  against an 1824px container, and at the 22px floor it is
                  249px against 267px. Both hold. */}
              <h2 className="mt-[clamp(12px,1.4vw,26px)] font-display text-[clamp(26px,7.4vw,150px)] uppercase leading-[0.95] tracking-[-0.03em] sm:whitespace-nowrap">
                {product.closing.headline}
              </h2>

              {/* The gap here is a HOLE, not spacing.

                  The card is centred on the returned composition and so is
                  the aircraft, so headline and body would otherwise close
                  over the middle of the shot and hide the subject the whole
                  page has been about. Pushing them apart opens a band
                  through the centre for it to sit in — the type frames the
                  machine rather than covering it.

                  Measured in vh, not vw or px, because what it has to clear
                  is the aircraft's height ON SCREEN. In px it would collapse
                  on a short window; in vw it would track the wrong axis
                  entirely.

                  42vh is solved, not chosen. The aircraft's last-frame box
                  is 612px tall in a 2160 render, cover-fitted, and the gap
                  has to span from its top to its bottom while the block
                  stays centred. Working that through at four common windows:

                    1280x593   aircraft 204px tall   needs 42vh
                    1440x800   aircraft 230px        needs 33vh
                    1920x900   aircraft 306px        needs 36vh
                    1920x1080  aircraft 306px        needs 30vh

                  The SHORT window is the demanding one, not the tall one —
                  a 16:9 render cover-fitted into a letterbox viewport is
                  cropped horizontally, so the aircraft occupies more of the
                  height, not less. Taking the worst case at 42vh clears it
                  everywhere; the taller windows simply get more air. The
                  block still fits with room at all four (worst top offset
                  44px), so nothing is pushed off screen to buy it. */}
              <p className="mx-auto mt-[clamp(56px,42vh,420px)] max-w-[46ch] text-[clamp(14px,1.15vw,20px)] leading-[1.5] opacity-75">
                {product.closing.body}
              </p>

              <div className="mt-[clamp(24px,2.8vw,48px)] flex flex-wrap items-center justify-center gap-[clamp(10px,1vw,18px)]">
                {/* Outlined, dashed — the same language as the gallery's gate
                    and the reticle, so the closing frame is recognisably the
                    same page as the opening one. */}
                <span className="pointer-events-auto rounded-[3px] border border-dashed border-[#f2ecd9]/40 px-[clamp(18px,2vw,34px)] py-[clamp(9px,1vw,15px)] font-display text-[clamp(10px,0.82vw,15px)] font-bold uppercase tracking-[0.12em]">
                  {product.closing.label}
                </span>
                {/* The button this page used to draw itself. Its styling now
                    lives in PrimaryButton and is the site's only filled CTA;
                    all that is left here is where it sits. */}
                <PrimaryButton href={product.closing.cta.href} className="pointer-events-auto">
                  {product.closing.cta.label}
                </PrimaryButton>
              </div>
            </div>
          </div>
          )}

          {/* The return, act four. Its own layer with its own fade, NOT
              stacked inside the hero render's wrapper.

              Sharing that wrapper looked tidier and was wrong: --stage means
              "the opening render is on stage", act two drives it to 0 as the
              aircraft hands over to the gallery, and act four would have had
              to drive it back to 1 — which restores the HERO canvas too,
              still painting its own last frame under the returning one. Two
              exports, two clocks, two fades.

              Same fixed inset-0 discipline as the wrapper below: opacity
              under 1 makes an element a containing block for fixed
              descendants, so matching the viewport exactly keeps the
              canvas's own fixed positioning a no-op.

              Deliberately NOT counted into the loader — onProgress and
              onReady are omitted. The curtain exists so act one cannot start
              mid-decode; act four is twenty screens away, and holding the
              reader at the door for frames they will not reach for minutes
              is the wrong trade. It streams in behind them. */}
          {clock.closing && (
            <div className="fixed inset-0 z-0" style={{ opacity: 'var(--end-stage, 0)' }}>
              <FieldSequence ref={endSeqRef} name={END_NAME} frames={END_FRAMES} ext="webp" />
            </div>
          )}

          {/* The render, in a wrapper that can be faded as one.

              The wrapper is itself fixed and full-bleed, which matters:
              opacity below 1 makes an element a containing block for fixed
              descendants, so a static wrapper would re-anchor the scene's
              own fixed layer to the wrapper's box. Matching the viewport
              exactly makes that reparenting a no-op. */}
          <div className="fixed inset-0 z-0" style={{ opacity: 'var(--stage, 1)' }}>
              <FieldSequence
                ref={seqRef}
                name={SEQUENCE_NAME}
                frames={SEQUENCE_FRAMES}
                onProgress={onSceneProgress}
                onReady={onSceneReady}
              />

          </div>

          {/* Mounted only if the page declares the act. Not merely hidden:
              the gallery preloads its photographs and the bench decodes
              video, and a page that has chosen not to have them should not
              be paying for them off screen. */}
          {clock.gallery && product.gallery && (
            <FieldGallery ref={galleryRef} items={product.gallery} />
          )}

          {/* Act three. Sits at z-9, below the z-10 content layer but
              above the gallery's own stack, so the page's persistent
              furniture — nav, corner logo, model tab — stays on top of
              it exactly as it does over every earlier beat. */}
          {clock.bench && product.bench && (
            <FieldBench ref={benchRef} bench={product.bench} />
          )}
      </>

      {/* The boot curtain used to be here. It is BootCurtain now, in the
          root layout, covering every route instead of this one. The
          sequence still holds it open and still feeds its counter — see
          useBootGate above. */}
      <div className={styles.warm} aria-hidden />
      <div className={styles.bloom} aria-hidden />

      {/* Pinned content. Fixed rather than ScrollTrigger-pinned because the
          canvas beneath it is fixed too — one positioning model, not two.

          Anchors are measured off the oryzo hero at 1919x890 and expressed
          as fractions of the viewport, so the composition holds its shape
          rather than drifting apart on other sizes:

            page pad      68 / 1919  ->  3.55vw      37 / 890  -> pad-y
            wordmark      cap 162px  ->  ~11.7vw type
            left card     top 470/890 -> 52.8%,  width 347/1919 -> 18.1vw
            right para    top 393/890 -> 44.2%,  width 597/1919 -> 31.1vw
            scroll cue    centre 1339/1919 -> 69.8%
      */}
      <div className="pointer-events-none fixed inset-0 z-10">
        <header
          className="relative h-dvh [&_a]:pointer-events-auto"
          style={
            {
              '--pad-x': 'clamp(20px, 3.55vw, 68px)',
              '--pad-y': 'clamp(16px, 2.1vw, 40px)',
              /* Height of the top chrome row. The logo and the menu toggle
                 are anchored to the same pad-y but are different heights, so
                 without a shared box their optical centres do not agree —
                 measured 14px apart, which is exactly half the difference
                 between a 16px logo and the toggle's 44px hit area. Both
                 now fill this and centre their contents in it. */
              '--chrome-h': '2.75rem',
            } as React.CSSProperties
          }
        >
          {/* Top-left logo. Was a 9px dot, and it is still the wordmark's
              LANDING MARK — see MORPH_WINDOW: the oversized P10 PRO shrinks
              into this corner and stays as the page's logo, and measureMorph
              reads this element's rect to know where to send it.

              The morph maths is unchanged by the swap because it measures
              corner to corner with a top-left transform-origin, so only this
              element's left/top matter and both are still pinned to
              pad-x / pad-y. The size is free to change; the anchor is not.

              Height is matched to MORPH_TARGET_PX (18) rather than picked,
              so the logo and the wordmark that replaces it sit on the same
              optical line as the nav opposite.

              introStyle is applied ONLY where something replaces it.

              On masthead and split the oversized wordmark morphs into this
              corner and stays as the logo, so this has to fade over
              INTRO_WINDOW or the two occupy the same spot at once — that
              handover is what the dot was for.

              On centred there is no handover. That layout renders its own
              wordmark elsewhere and hides the morphing one outright
              (HERO_CENTRED ? 'hidden' : 'inline-block'), so nothing ever
              arrives here — measured: the corner sat empty from p = 0.09 to
              the end of the page. Fading a logo out into a corner that then
              stays blank is just losing the logo, so on this layout it
              stays put. */}
          <span
            ref={dotRef}
            className="absolute left-[var(--pad-x)] top-[var(--pad-y)] flex h-[var(--chrome-h)] items-center"
            style={HERO_CENTRED ? undefined : introStyle}
          >
            {/* The mega nav draws its own logo INSIDE the bar, so that it
                travels with the bar when it hides on scroll. This element
                still has to exist though: it is the wordmark's landing mark,
                and measureMorph reads its rect. With the image gone it is a
                zero-width anchor at the same left/top, which is all the
                morph actually uses — see the note above. */}
            {menu !== 'mega' && (
              <Image
                src="/images/logo.png"
                alt="DroneAnatomy"
                width={686}
                height={225}
                priority
                className="h-[clamp(24px,2.8vw,36px)] w-auto"
              />
            )}
          </span>

          {/* Masthead. The block hugs the wordmark's width so the kicker can
              right-align to the wordmark's right edge — in oryzo the kicker
              and the O of ORYZO end on exactly the same x, which is the whole
              reason it reads as one lockup rather than two stacked lines. */}
          {/* --intro sits on the wordmark alone, not the lockup: the kicker
              carries its own masked word retraction and would otherwise be
              fading and retracting at the same time. */}
          <div
            className={
              'absolute left-[var(--pad-x)] w-fit ' +
              (HERO_SPLIT
                /* Narrow: back to the top, because a vertically centred
                   wordmark and a vertically centred paragraph cannot both
                   own the middle of a portrait screen — they would sit on
                   each other and on the aircraft between them. Stacked, the
                   name takes the top third and the sentence the bottom. */
                ? 'top-[calc(var(--pad-y)+16px)] md:top-1/2 md:-translate-y-1/2 '
                : 'top-[calc(var(--pad-y)+18px)] ') +
              /* Hidden, not unmounted — measureMorph and the kicker's
                 SplitText both read these nodes on mount.
              
                 The display utility is SWAPPED, never appended. `hidden` and
                 `inline-block` are both display rules at equal specificity,
                 so which one wins comes down to Tailwind's source order, and
                 appending `hidden` to a class list that already carries
                 `inline-block` loses silently — measured: the class was
                 present and computed display was still `block`. Emitting one
                 or the other removes the question. */
              (HERO_CENTRED ? 'hidden' : 'inline-block')
            }
          >
            <p
              ref={kickerRef}
              className="block text-right font-display text-[clamp(11px,0.95vw,18px)] font-bold uppercase tracking-[0.02em]"
            >
              {product.kicker}
            </p>
            {/* No --intro fade: this one does not leave, it becomes the
                corner logo. transform-origin top-left so the scale pins the
                corner the translation is aiming at. */}
            <h1
              ref={wordmarkRef}
              className={
                'mt-[0.06em] origin-top-left font-display uppercase leading-[0.8] ' +
                'tracking-[-0.025em] will-change-transform ' +
                /* Smaller in the split, and it has to be: at 11.7vw the
                   wordmark spans most of the frame, which is right when it
                   is the only thing in it and wrong the moment an aircraft
                   and a paragraph have to share the width. 7vw keeps it
                   inside the left third. */
                (HERO_SPLIT
                  ? 'text-[clamp(34px,12vw,138px)] md:text-[clamp(44px,7vw,138px)] '
                  : 'text-[clamp(40px,11.7vw,232px)] ') +
                styles.wordmark
              }
            >
              {product.name}
            </h1>
          </div>

          {/* Right-hand body copy, mid-height, ragged-right off the page pad.
              No --intro opacity here: its lines carry their own blur-and-drift
              exit, and stacking a block fade on top would double-fade it. */}
          <p
            ref={paraRef}
            className={
              /* THE TYPE SIZE TRAVELS WITH THE LAYOUT, rather than sitting in
                 the shared prefix with a per-layout override after it. Two
                 arbitrary `text-[…]` utilities both apply and resolve by
                 stylesheet order, not by the order they appear in this
                 string — so an override here would work or not depending on
                 which rule Tailwind happened to emit last. Declaring one size
                 per branch means there is only ever one. */
              'absolute leading-[1.42] ' +
              (HERO_CENTRED
                ? /* Flat 16px. The clamp the other layouts use grows the
                     paragraph with the viewport, which is right when it is
                     ragged-right against a page edge and wrong for a centred
                     measure — there the line LENGTH is already doing that
                     job, and letting both grow gives a block that gets wider
                     and heavier at once. */
                  'text-[16px] '
                : 'text-[clamp(16px,1.56vw,30px)] ' +
                  'right-[var(--pad-x)] left-[var(--pad-x)] w-auto ' +
                  'md:left-auto md:w-[min(86vw,clamp(240px,31.1vw,600px))] ') +
              /* Centred against the wordmark in the split so the two read as
                 one line across the frame. Left where it was otherwise —
                 44.2% is measured off the masthead composition and means
                 nothing once the wordmark moves. */
              (HERO_CENTRED
                ? /* 70% AT EVERY WIDTH. There was an md:top-[64%] here that
                     lifted the paragraph on desktop only, so the block sat at
                     two different heights either side of the breakpoint for
                     no reason the composition asked for. One number now.

                     The measure came down with the type: 44vw/760px was set
                     against a paragraph that grew to 30px, and holding that
                     width at a flat 16px would have run to about 80
                     characters a line.

                     28vw/440px is roughly 50 characters — deliberately
                     tighter than the 60-odd a body column would take, because
                     this one is CENTRED and short. A centred block is read as
                     a shape before it is read as text, and at this length the
                     shape wants to be narrower than comfort alone would ask
                     for. The 260px floor is untouched: it is what keeps the
                     paragraph off both page pads on a phone. */
                  'left-1/2 top-[70%] w-[min(88vw,clamp(260px,28vw,440px))] -translate-x-1/2 text-center'
                : HERO_SPLIT
                  ? 'bottom-[18%] top-auto md:bottom-auto md:top-1/2 md:-translate-y-1/2'
                  : 'top-[44.2%]')
            }
          >
            {HERO_SPLIT ? product.lede : product.statement.body}
          </p>

          {/* Left credit card. Runs off the bottom edge rather than sitting
              above it — the bleed is what stops it reading as a floating box. */}
          <div
            ref={cardRef}
            className={
              'absolute bottom-4 left-[var(--pad-x)] top-[52.8%] ' +
              (HERO_SPLIT || HERO_CENTRED ? 'hidden ' : 'flex ') +
              'w-[clamp(240px,18.1vw,348px)] flex-col bg-[#f2ecd9]/10 ' +
              'p-[clamp(14px,1.15vw,22px)] pt-[clamp(20px,1.9vw,36px)] ' +
              'backdrop-blur-[6px]'
              /* Hidden, not unmounted. Its SplitText masks and their timeline
                 are built from this ref on mount, and removing the node would
                 mean guarding every one of those call sites for a layout
                 flag. The display utility is swapped above rather than
                 appended, for the same reason as the masthead. */
            }
            style={introStyle}
          >
            <p className="font-display text-[clamp(15px,1.35vw,26px)] uppercase leading-[1.22] tracking-[0.01em]">
              Designed and assembled
              <br />
              in India, by people who
              <br />
              fly what they build.
            </p>
            <hr className="mt-auto mb-[clamp(14px,1.4vw,26px)] border-0 border-t border-dashed border-[#f2ecd9]/35" />
            <p className="pb-[clamp(10px,1.4vw,26px)] text-right text-[clamp(13px,1vw,19px)] leading-[1.35] opacity-90">
              The most field-serviceable
              <br />
              airframe in its class.
            </p>
          </div>

          {/* The void statement. Anchors measured off the oryzo frame at
              1919x890: headline left edge 172 -> 9%, vertically centred;
              paragraph right edge 1765 -> 8% gap, 360px wide, top 375 -> 42%.
              No block-level opacity on either — the per-character sweep is
              what brings them in and takes them out. */}
          <h2
            ref={stmtHeadRef}
            /* Top-left on a phone, vertically centred from md up.

               Both halves of this statement were anchored near the middle —
               the headline at top-1/2 and the paragraph at 42% — which reads
               as two columns flanking the aircraft on a wide screen and as
               one pile on a narrow one. There is no width at which a
               centred pair stops colliding on a 390px screen; they have to
               go to opposite corners, which is also the only arrangement
               that leaves the machine the middle of the frame.

               translate-y-0 explicitly: the desktop rule carries
               -translate-y-1/2 to centre against its own height, and a
               top-anchored element inheriting that would sit half its
               height off the top of the screen.

               10.7vw on mobile, and the 3.75vw desktop value never applied
               there anyway — 3.75vw is 9.8px on a 260px screen, so the
               24px FLOOR was what actually rendered, at 9.2vw. The
               headline was effectively pinned to a fixed size that happened
               to be close to right, which is not the same as being sized.

               Solved against the reference: oryzo's phone layout runs its
               longest line to about 55% of the viewport width. Ours is ten
               characters at 0.514em each, so 0.55 / (10 x 0.514) = 10.7vw.
               That now beats the floor at every phone size, which means the
               line scales with the screen instead of sitting still.

               top moved 22% -> 18% to pay for it. A larger type size makes
               a taller two-line block, and at 22% the bottom landed at 175
               against an aircraft starting at 161 — the size change quietly
               bought an overlap. The anchor and the size are one decision
               here, not two. */
            className="absolute left-[8%] top-[18%] w-[84vw] translate-y-0 font-display text-[clamp(26px,10.7vw,72px)] uppercase leading-[0.93] tracking-[-0.02em] md:left-[9%] md:top-1/2 md:w-auto md:-translate-y-1/2 md:text-[clamp(26px,3.75vw,72px)]"
          >
            {product.statement.head[0]}
            <br />
            {product.statement.head[1]}
          </h2>

          {/* DECLARED, NOT TYPED IN. This paragraph carried the P10's own
              sentence as a literal, so every product's hero asserted it was
              the P10 — visible on the Noxr page, which is where it was
              caught. A page with nothing to say here now renders nothing,
              the same rule the acts already follow.

              stmtParaRef tolerates the absence: the split filters its
              elements with Boolean before it builds anything. */}
          {product.statement.aside && (
          <p
            ref={stmtParaRef}
            /* CENTRED at the bottom on mobile, not in a corner.

               The BOX is centred and full width; the TEXT inside it is
               ranged right. Those are two decisions and it is worth being
               clear which is which.

               Centring the box keeps the block spanning the frame under a
               centred object, which is what stops it reading as a fourth
               corner competing with the headline. Ranging the text right
               sets its ragged edge on the opposite side to the headline's,
               so the two blocks lean away from each other across the
               aircraft instead of both hanging off the same edge.

               translate-x-0 explicitly on md — the mobile rule uses
               left-1/2 with -translate-x-1/2 to centre, and the desktop
               anchor is right-[8%], which would be shifted half its own
               width if the transform survived. Same trap as translate-y on
               the headline above.

               CENTRED ON THE SAME LINE AS THE HEADLINE. This was
               top-[42%], a top-EDGE anchor, which holds the first line at
               a fixed height and lets the block grow downwards — so the
               two sides only looked level at whatever length the copy
               happened to be. At 1440 the paragraph's centre sat at 603
               against the headline's 450.

               NOT BY -translate-y-1/2, though, which is how the headline
               does it. GSAP animates this element's y, and on first touch
               it flattens the independent `translate` property into its
               own inline `transform` — so a centring that lives in
               `translate` survives only if GSAP happens to read it before
               it writes. Measured, it does not do so reliably here: the
               same build centred correctly at 1280 and left the block a
               full half-height low at 1440, 1600 and 1920, with the
               inline transform showing the -50% simply missing.

               inset-y-0 + h-fit + my-auto centres it with no transform at
               all — the two opposite offsets leave free space, fit-content
               stops the box stretching to fill it, and auto margins split
               what is left. GSAP then owns `transform` outright and there
               is nothing for it to lose. The headline is left alone: it
               declares translate-y-0 at base, so its variable is always
               set, and it measures level at every width.

               THE DESKTOP MEASURE AND SIZE ARE ONE DECISION, and both were
               wrong on a wide screen. 18.8vw capped at 360px while 1.77vw
               ran on to 34px, so the two clamps saturated at different
               widths: past ~1360px the column stopped growing and the type
               did not. At 1920 that is 360px of box holding 34px type —
               about ten characters a line, fourteen lines, 676px tall, and
               the last of it below the fold. It had stopped being a
               paragraph and become a ticker tape.

               So the type is capped at 24px and the box grows to 480px.
               Nothing changes below 1356px, where 1.77vw is still under the
               new ceiling — this only bites where it was broken. At 1920 it
               is seven lines at 239px tall, and the box's left edge lands
               at 1286, clear of the aircraft's outermost propeller tip at
               ~1280; that clearance is what sets the 480px ceiling rather
               than any round number. */
            className="absolute bottom-[10%] left-1/2 w-[84vw] -translate-x-1/2 text-right text-[clamp(15px,1.77vw,24px)] leading-[1.42] md:inset-y-0 md:left-auto md:right-[8%] md:my-auto md:h-fit md:w-[clamp(230px,25vw,480px)] md:translate-x-0 md:text-left"
          >
            {product.statement.aside}
          </p>
          )}

          {/* Slide label — stacked directly above the line rather than beside
              it, so the two read as one statement broken across two sizes.

              Offset in vw, not px: the line's height scales with the viewport
              (its font-size is 13vw), so a fixed pixel gap would collide with
              the ascenders on a wide screen and float away on a narrow one.

              Kept in FRONT of the canvas, unlike the line it belongs to. It
              sits above the aircraft's centre, but at large sizes the drone
              reaches high enough to clip it, and this is the one line that has
              to stay readable. */}
          {/* Sized against the line it ends up above, not against the page.
              Once the lockup lands, the line is LOCKUP_HEAD_VH tall — 4.8vh
              — and this has to hold a readable ratio to it, so it is in vh
              too. 3.6vh over 4.8vh is oryzo's own 32-over-48 at 889 tall.

              In vh so the pair scales together on short windows, with the
              SAME KIND of ceiling the line carries in LOCKUP_HEAD_MAX — 32px
              against its 48. Capping only one of them is exactly what makes
              the two drift apart at the ends of the range, so both are
              capped or neither is. */}
          {/* The vertical anchor differs by width, and it has to.

              calc(50% - 9.5vw) places this just above the headline it will
              sit over — an offset solved against that line's 19.5vw height,
              which is the right relationship on a wide screen. On a phone
              9.5vw is about 25px, so the offset all but vanishes and the
              label lands on the vertical centre. Measured at 260x563: the
              label at y 257-289 with the aircraft occupying 177-382 — text
              straight across the middle of the machine.

              A percentage cannot fix this by being tuned, because the two
              cases are anchored to different things: to the HEADLINE on
              desktop, and to the AIRCRAFT on mobile, where the headline is
              not what it is competing with. 15% clears the top of the
              subject with room to spare at every phone size checked. */}
          <p
            ref={slideLabelRef}
            className="absolute left-[3.15%] top-[15%] font-display text-[min(3.6vh,32px)] uppercase tracking-[0.02em] text-[#bbac97] md:top-[calc(50%-9.5vw)]"
          >
            {product.slideLabel}
          </p>

          {/* Coda. Anchors from the oryzo frame at 1919x890: headline centred
              horizontally with its cap line at ~15%, and BOTH the tag and the
              three-liner right-aligned to the same axis, 25% in from the right
              edge. That shared alignment is what holds the panel together —
              the headline floats centred, everything else hangs off one line.

              Sentence case, not the uppercase used elsewhere: this is the one
              moment the page speaks rather than labels. */}
          <h2
            ref={codaHeadRef}
            /* THE SIZE IS NO LONGER WRITTEN HERE — see CODA_SIZE, which
              holds the steps, and `codaSize` on the product, which picks
              one. A size hard-coded on the element assumed every page's
              closing sentence was about the same length, and P10 Pro's is
              two and a half times the one it was tuned against.

              `lg` is that original pair, unchanged, so a page that names no
              step renders exactly as it did. What follows is why those
              numbers are what they are, and it still applies to `lg`:

              Bigger on a phone only. Under md, 6.8vw ran the line to 56% of
              the frame, which is a headline sitting in a lot of space
              rather than one filling it. 9.5vw takes it to 78% (measured at
              360, 390 and 767): eighteen characters at 0.454em each —
              narrower than the 0.514 the uppercase display lines use,
              because this one is normal-case.

              15% -> 13% for the same reason, and only under md: the taller
              line grows downward from its anchor, so raising it is what pays
              for the height rather than spending it on the tag below.

              The 170px ceiling is dead weight in this range — 9.5vw peaks at
              72.9px at the 767px breakpoint — and is kept only so the
              declaration still reads as bounded. The 28px floor does bind,
              below 295px. */
            className={`absolute left-1/2 top-[13%] w-[92vw] -translate-x-1/2 text-center font-display normal-case leading-[0.95] tracking-[-0.03em] sm:w-auto sm:whitespace-nowrap md:top-[15%] ${CODA_SIZE[product.codaSize ?? 'lg']}`}
          >
            {product.coda}
            <sup className="align-super text-[0.42em] tracking-normal">*</sup>
          </h2>

          <p
            ref={codaTagRef}
            /* Under md, anchored to the HEADLINE's box rather than to the
               viewport. 30% from md up is the original and is left alone.

               A % top is a fraction of viewport HEIGHT, while the headline
               above is sized in vw and so its height tracks WIDTH. The two
               are measured on different axes, which means any single
               percentage is only correct at one aspect ratio — at 30%, a
               108px hole on a 390x844 phone and a 10px OVERLAP at 844x390,
               where the line is 76px tall in a 390px-high frame. That is not
               a number that wants tuning; it is the wrong axis.

               So under md the top is composed from the same terms the
               headline is: its 13% anchor, plus its own line height, plus a
               gap. 9.025vw is 0.95 (the h2's leading) times its 9.5vw
               font-size, so the term IS the rendered line height — checked
               against 32px at 360, 35px at 390.

               Both of the headline's clamp bounds are dropped here because
               neither binds below 767px, which is what keeps this a single
               calc with no nested clamp — and therefore an ordinary utility
               that md:top-[30%] can override. A nested clamp would have had
               to be inline, where no media query can reach it.

               The gap is a flat 14px for the same reason: it was
               clamp(14px,1.6vw,40px), and 1.6vw only passes 14px at 875px
               wide, well outside this range.

               KEEP 13% IN SYNC with the h2's top above.

               right follows the three-liner below onto the 8% axis on a
               phone, for the reason given there. Both are right-aligned to
               ONE line by design — see the block comment on the coda — so
               moving one without the other would leave them 17vw out of
               register, which on two right-aligned elements reads as a
               mistake rather than as a margin. */
            className="absolute right-[8%] top-[calc(13%_+_9.025vw_+_14px)] font-display text-[clamp(12px,1.35vw,26px)] uppercase tracking-[0.02em] text-[var(--color-flare)] md:right-[25%] md:top-[30%]"
          >
            {/* The product's own name. It read "P10-Pro" as a literal, in
                the accent colour, on every hero — the loudest of the four
                leaks and the easiest to miss, because on the P10's page it
                was right. The hyphen goes with it: `name` is what the
                wordmark and the metadata already use, and one spelling per
                product beats a second one that only this tag knows. */}
            {product.name}
          </p>

          {/* Same fix as the statement's aside: these three lines were typed
              into the JSX and are a specification of the P10 and of nothing
              else. codaNoteRef tolerates the absence — its split is written
              as `codaNote ? … : …`. */}
          {product.codaNote && (
          <p
            ref={codaNoteRef}
            /* 8% on a phone, the desktop 25% from md up.

               25% is a quarter of the VIEWPORT, so it reads as a margin on a
               wide frame and as a hole on a narrow one — 98px in from the
               edge of a 390px screen, which leaves the block stranded near
               the middle rather than anchored to a side. 8% is the same axis
               the hero's statement paragraph hangs off: its mobile box is
               w-[84vw] centred, so its right-aligned ink lands at 8vw from
               the edge. Sharing that line is what makes the two read as the
               same page. */
            className="absolute right-[8%] top-[78%] text-right font-display text-[clamp(11px,1vw,19px)] uppercase leading-[1.5] tracking-[0.01em] md:right-[25%]"
          >
            {product.codaNote?.map((line, i) => (
              <React.Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </p>
          )}

          {menu === 'inline' && (
          <nav
            /* Gap and type both floor lower than the desktop values, and
               the whole row is allowed to wrap. Four labels at the old
               floors measured 255px inside a 260px window — the nav ran off
               the left edge, which on a right-anchored element is the tell
               that its content is wider than the space it was given. */
            className="absolute right-[var(--pad-x)] top-[var(--pad-y)] flex max-w-[calc(100vw-2*var(--pad-x,5vw))] flex-wrap justify-end gap-x-[clamp(10px,1.9vw,36px)] gap-y-1"
            aria-label="Primary"
          >
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="whitespace-nowrap font-display text-[clamp(9px,0.83vw,16px)] font-bold uppercase tracking-[0.04em] transition-opacity hover:opacity-70"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          )}

          {menu === 'overlay' && (
            <FieldMenu nav={product.nav} productName={product.name} />
          )}
          {menu === 'mega' && <FieldNav />}

          {/* Vertical model tab, flush to the top-right corner. Light panel,
              dark type — the one inverted element on the page.

              Shorter under md. 21.5vh is a fine proportion on a wide frame
              but it does not know how long the label is, and a phone is
              tall: at 390x844 it gave a 181px tab holding a label that runs
              98px, so 46% of the panel was empty and it read as a blank
              slab with type parked in the middle.

              15vh with a 112px floor lands ~127px on that phone — the label
              plus a margin at each end. The floor is what matters on short
              phones, where a pure vh would collapse under the label itself;
              the label is pinned at 9px there (its clamp bottoms out), so
              98px is a fixed quantity to design against rather than a
              moving one.

              It leaves by sliding out through the right edge as act one
              opens, on TAB_WINDOW — last of the corner furniture, for the
              reason given there.

              102%, not 100%. The travel is a fraction of its own width, and
              at 100% the panel's left edge lands exactly on the viewport
              edge, where sub-pixel rounding at fractional widths (the width
              is a vw clamp, so it is fractional at most window sizes) can
              leave a hairline of #f2ecd9 against black. Two percent of a
              ~40px panel is under a pixel of extra travel and costs nothing.

              Nothing fades. The slide alone does the hiding, which is the
              point of using one — see TAB_WINDOW. */}

          {/* Scroll cue. Its corner depends on the layout, because the lower
              left is only free in one of them.

              SPLIT — bottom left, on var(--pad-x), sharing the wordmark's
              gutter so it reads as part of the composition rather than as
              something positioned near it. No -translate-x-1/2 here: that
              exists to centre a block on a percentage anchor, and against a
              left edge it would pull the arrow half its width off-pad.

              MASTHEAD — back to 69.8% across, which is oryzo's placement,
              under the right-hand column. It has to go back: that layout
              keeps the credit card in the lower left, and a cue on the same
              gutter would sit on top of it. */}
          <div
            className={
              'absolute bottom-[var(--pad-y)] flex items-center ' +
              'gap-[clamp(8px,0.8vw,15px)] ' +
              (HERO_SPLIT || HERO_CENTRED
                ? 'left-[var(--pad-x)]'
                : 'left-[69.8%] -translate-x-1/2')
            }
            style={introStyle}
          >
            <span
              className="flex size-[clamp(18px,1.35vw,26px)] items-center justify-center rounded-full border border-[#f2ecd9]/45 text-[10px]"
              aria-hidden
            >
              &darr;
            </span>
            <span className="font-display text-[clamp(10px,0.73vw,14px)] font-bold uppercase tracking-[0.08em]">
              Scroll to continue
            </span>
          </div>

          {/* Media card, bottom-right. Opens the lightbox — see FieldVideo
              for why the embed is not mounted until this is pressed.

              aspect-video rather than a height clamp of its own. The card
              was sized on two independent axes — width in vw, height in vh —
              which on a short-wide window drove it to 108x66, a 1.64 box
              holding a 1.78 image, so the poster was being cropped by the
              frame rather than filling it. Tying height to width means the
              card is always the shape of what it is showing, and there is
              one number to tune instead of two that can disagree.

              The 118px floor is held deliberately low. 13vw is the growth
              that was asked for and it lands on wide screens; on a phone the
              floor is what applies, and at 118 the card is 118x66 — the same
              height as the 108x66 box it replaces. There is already visible
              copy under this corner on a phone (the lede's last line runs to
              x=359 against a card starting at x=262), so growing the floor
              would deepen a collision that is not this card's to fix. */}
          {/* DECLARED, NOT ASSUMED. The id and the poster used to be
              literals here while the title was built from product.name, so
              a page with no film of its own still rendered the card — the
              Mini's hero showed the P10 Pro's film captioned "Mini — film".
              Gated on the data the same way the acts are: no `film`, no
              card, and nothing to borrow. */}
          {product.film && (
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            aria-haspopup="dialog"
            className="group pointer-events-auto absolute bottom-[var(--pad-y)] right-[var(--pad-x)] flex aspect-video w-[clamp(118px,13vw,260px)] items-center justify-center overflow-hidden rounded-[4px] border border-[#f2ecd9]/25 transition-colors hover:border-[#f2ecd9]/50"
            style={introStyle}
          >
            {/* A LOCAL copy of the video's frame, not a hotlink to
                i.ytimg.com. This is a static export with images.unoptimized,
                so a remote host would need remotePatterns configured, and it
                would put a third-party request back on page load — which is
                the exact cost FieldVideo defers by not mounting the embed
                until asked. 480px wide at 9.8KB covers the card's 170px
                maximum on a 2x display.

                bg-[#10140b]/55 and backdrop-blur went with it: the card is
                opaque now, so blurring what is behind it buys nothing and
                costs a compositing pass on a page that is already scrubbing
                a decoded PNG sequence. */}
            <Image
              src={product.film.poster}
              alt=""
              fill
              sizes="170px"
              className="object-cover"
              aria-hidden
            />
            {/* The scrim. The frame behind it is a bright sunlit field, so
                the label cannot rely on contrast it does not control —
                without this it sat on near-white sky. Lifts on hover so the
                card acknowledges the pointer. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-[#0e100f]/60 transition-colors group-hover:bg-[#0e100f]/45"
            />
            <span className="relative font-display text-[clamp(9px,0.68vw,13px)] font-bold uppercase tracking-[0.14em]">
              Play
            </span>
          </button>
          )}
        </header>
      </div>

      {/* Outside <header> on purpose. The hero's layers carry transforms,
          and a transformed ancestor becomes the containing block for a
          position:fixed descendant — the lightbox would then be fixed to
          the header rather than to the viewport. */}
      {product.film && (
        <FieldVideo
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          id={product.film.id}
          title={`${product.name} — film`}
        />
      )}

      {/* Scroll length for the timeline. The pin above stays put while
          this passes.

          Derived from the acts rather than typed, so the two can never
          disagree: beats.ts declares each act in viewport heights and this
          is their sum. Adding a section changes one number there and this
          follows, with every earlier act keeping its absolute length. */}
      <div id="field-spacer" style={{ height: `${spacerVh}vh` }} aria-hidden />

      {/* The mobile page, in normal flow under the scrubbed acts. The
          gallery is NOT here any more — it is scrubbed at every width, so
          this is the bench and the closing card only.

          GATED ON THE ACTS, which it was not before. Every scrubbed act
          checks its clock, but this branch checked only the width — so a
          page that declared no bench and no closing act still rendered both
          of them on any narrow viewport, in normal flow, below a timeline
          that had never mentioned them. On a desktop it looked correct and
          on a phone it was a different page. Nothing exercised it until a
          hero-only product existed; now one does. */}
      {narrow &&
        ((clock.bench && product.bench) || (clock.closing && product.closing)) && (
          <div className="relative z-20 bg-[#090b07]">
            {clock.bench && product.bench && <FieldBenchMobile bench={product.bench} />}
            {clock.closing && product.closing && (
              <FieldClosingMobile closing={product.closing} />
            )}
          </div>
        )}

      {/* The footer is NOT rendered here. It is the site's, mounted once in
          the root layout — see FooterGate. It used to live here, which is
          why /preview/p10 shipped two of them: this one, plus the shared
          Footer that FooterGate adds to every route it does not gate out.

          It still has to scroll up OVER the pinned layers rather than be
          another one of them, and it still does: everything above is fixed
          and scrubbed, and the footer is the first thing on the page that
          simply moves when you move. That now depends on the footer's z-20
          beating this component's fixed layers from outside <main>, which
          is verified rather than assumed. */}
    </div>
  );
};

export default FieldHero;
