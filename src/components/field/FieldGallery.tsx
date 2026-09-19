'use client';

/* ============================================================
   FieldGallery — the filmstrip that closes the page.

   Read off oryzo's #wearable section directly rather than guessed at, and
   the thing worth knowing is that it is NOT a marquee passing behind a
   window. It is three separate tracks that TILE the viewport:

     [ left strip ][ gate ][ right strip ]

   each with its own overflow:hidden, so a small card never actually passes
   behind the big one — it is clipped at the gutter and reappears on the
   other side at 2.6x the size. The illusion is that one strip runs the
   width of the screen and is magnified in the middle. There is no such
   strip.

   What makes it hold together is that all three translate from ONE scalar,
   at a ratio fixed by their pitches rather than by their widths:

     thumbX / mainX == THUMB_PITCH / GATE_W

   so photo N arrives at the gate on the same frame it arrives at the
   equivalent point in the side strips. Oryzo's measured ratio is 0.378;
   the numbers below derive 0.379 from viewport units independently, which
   is the check that the geometry here is theirs and not a lookalike.

   The pitches differ from the widths on purpose: the strips carry a gap so
   the thumbs read as separate cards, and the gate does not so its cards
   butt edge to edge and two of them share the frame mid-transition. That
   shared frame is the whole transition — there is no crossfade anywhere in
   this section.

   Sizing is in vh throughout, including the horizontal. The gate is a
   fixed portrait aspect and its height is what has to fit the screen, so
   driving the width from vh keeps the aspect exact and stops the cards
   reflowing against the type as the window changes shape.

   Driven imperatively: FieldHero owns the one scroll scalar and calls
   setProgress from inside its own apply(). A progress prop would re-render
   this tree every frame for a transform React does not need to know about.
   ============================================================ */

import type { GalleryItem } from './product';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import Image from 'next/image';
import { clamp01, smoothstep, ZOOM_HOLD } from './beats';
import styles from './Field.module.css';

/* Placeholder art. These are the closest portrait-ish frames the project
   already ships; the landscape ones lose about half their width to the
   crop. The section wants seven purpose-shot 11:14 frames — this is the
   one part of the beat that is standing in rather than finished. */
/* The photographs come from the product, not from here.

   The last slot is a LIVE HOLE onto act three rather than an image: the
   strip shows the bench as a card, it passes through the gate, and the
   frame then opens on the same scene at full size. Oryzo splits it the same
   way — live DOM in the gate, a flat still in the strips — because three
   concurrent copies of a composition is not a thing you can afford.

   So N is items.length + 1, and that +1 is the doorway. A product whose
   page has no bench section would need that assumption revisited. */


/* One slot per photograph. The last one LOCKS in the frame.

   There is no empty slot at the end any more. The strip's travel finishes
   with the final photograph — which is act three's own scene, flattened —
   centred in the gate, and it simply stays there while the side strips
   clear out. That locked card is the composition the section has been
   travelling toward, and it is also, deliberately, the picture the next
   section is about to become.

   It hands off to the live section beneath it on the ZOOM_HOLD boundary:
   the card fades out exactly as the box behind it starts to grow, at
   identical geometry, so what crosses is one scene going from baked to
   live rather than two pictures being swapped. */
/* Slot count is per-product now, so it moves inside the component. Every
   travel distance below is a multiple of it, which is exactly why it could
   not stay at module scope once the photographs stopped being fixed. */

/* ---- Geometry, in vh ---------------------------------------------------
   ASPECT and the two heights are oryzo's, converted off a 1920x889 frame:
   gate 550x711 -> 61.9 x 80 vh, thumb 192x249 -> 21.7 x 28 vh, gutter 22px
   -> 2.5vh, thumb gap 16px -> 1.8vh. */
const ASPECT = 550 / 711;
/* Exported because act three has to grow OUT of this exact box. Two
   copies of these numbers would drift and the doorway would open from
   somewhere the gate is not. */
export const GATE_H = 80;
export const GATE_W = GATE_H * ASPECT;
const GUTTER = 2.5;
const THUMB_H = 28;
const THUMB_W = THUMB_H * ASPECT;
const THUMB_GAP = 1.8;
const THUMB_PITCH = THUMB_W + THUMB_GAP;

/* Pixels per gallery unit.
 
   Every dimension in here is authored in "vh" — gate, thumbs, gap, travel —
   which is right on a landscape screen and wrong on a portrait one. The gate
   is GATE_W units wide, so at 80vh tall it comes out 522px across on a 390px
   phone: a third of it off-screen, and the whole strip geometry with it.
 
   So the unit is 1vh CAPPED by what the width can actually carry. Because
   the gate, the thumbs, the gap and the travel are all multiples of it, one
   number keeps the whole composition in proportion — halve the unit and the
   layout is identical, just smaller. Sizing the gate alone would have broken
   the relationship the strips depend on.

   The cap fits the WHOLE composition, not just the gate: the gate, both
   gutters and one thumbnail either side. Capping on the gate alone (it was
   0.86 x width) let the gate take 86% of a phone, which left nothing for
   the strips — no next or previous card, and the oversized "it's compact"
   line behind the gate was covered end to end instead of being partly
   occluded by it the way it is on a wide screen.

   Both of those are the same fault: the frame was too big for the screen.
   Measured at 390 wide, this gives a 219px gate with a full thumbnail on
   each side, against 335px and nothing before.

   It only binds on portrait. On any landscape screen the height term is
   already the smaller of the two — 9 vs 11.6 at 1280x900 — so desktop is
   untouched. */
export const COMPOSITION_W = GATE_W + 2 * GUTTER + 2 * THUMB_W;
export const gateUnit = () =>
  Math.min(window.innerHeight / 100, window.innerWidth / COMPOSITION_W);


/* Both tracks travel (N-1) of their own pitch, which is what locks them:
   the ratio between these two numbers is the ratio between the pitches,
   and neither has to know about the other. */
/* Both depend on the slot count, so they are derived per-render inside the
   component now — see the note where SLOTS is defined. */

/* Peak tilt at the edges of the gate, in degrees. A card is upright only
   when it is dead centre, so the tilt is a readout of how far through the
   frame it is rather than a decoration sitting on top of it. Oryzo's
   sampled value was 1.73 degrees on a card partway across. */
const TILT_MAX = 2.2;

/* How much of the window the aperture takes to open before anything
   travels. The gate rises out of a square — oryzo keeps a 427x427 element
   parked behind theirs for exactly this — so the section arrives by
   opening rather than by fading up. */
const ENTER = 0.12;

/* Where in this section's own progress the final card starts entering the
   gate — the point by which act three must already be standing behind it.

   It is not needed on screen until the card hands over at ZOOM_HOLD, well
   after this; arming here is deliberately early, and safe because the card
   in front is opaque. Early costs nothing and leaves no window in which the
   handoff could find nothing behind it.

   Derived rather than typed so it survives the photo list changing: the
   final slot begins crossing the gate's right edge at (SLOTS-2)/(SLOTS-1)
   of the travel, and the travel is what is left after the aperture has
   finished opening. */
export const doorwayEntry = (slots: number) =>
  ENTER + ((slots - 2) / (slots - 1)) * (1 - ENTER);

const DEG = Math.PI / 180;

/* ---- How the side strips leave ----------------------------------------
   They slide OUT to the left, one after another, rather than fading.

   A fade takes the whole strip away as a single object and reads as a layer
   being switched off. Sliding keeps each thumbnail behaving like the card
   it has been for the whole section — it travels left, the way everything
   in this section travels left — so the strip empties instead of vanishing.

   They go TOGETHER, holding formation — no stagger. The strip has already
   stopped by this point and the last card is locked in the frame, so the
   thumbnails are no longer a queue moving through anything; they are the
   surroundings being cleared away from a thing that has arrived. One move
   clears it. A stagger would keep drawing the eye back to the sides at the
   exact moment the centre is meant to hold it. */
export const EXIT_DUR = 0.34;

export type FieldGalleryHandle = {
  /** t is 0..1 across GALLERY_WINDOW. */
  setProgress: (t: number) => void;
  /** z is 0..1 across ZOOM_WINDOW — the gate stops being a gate. */
  setZoom: (z: number) => void;
  /** Hard gate on the READER's position, independent of the timeline's. */
  setEnabled: (on: boolean) => void;
};

/* The gate is the only element whose height changes, so it is the only one
   that needs a variable; everything else is static CSS. */
type GateVars = React.CSSProperties & { '--gate-h': string; '--gu': string };

export const FieldGallery: React.FC<{
  ref?: React.Ref<FieldGalleryHandle>;
  items: GalleryItem[];
}> = ({ ref, items }) => {
  const GALLERY_ITEMS = items;
  const SLOTS = GALLERY_ITEMS.length;
  const N = SLOTS;
  const MAIN_TRAVEL = (N - 1) * GATE_W;
  const THUMB_TRAVEL = (N - 1) * THUMB_PITCH;
  const DOORWAY_ENTRY = doorwayEntry(SLOTS);
  const rootRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const innersRef = useRef<(HTMLDivElement | null)[]>([]);
  const frameRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setProgress: (t: number) => {
      const root = rootRef.current;
      if (!root) return;

      /* The aperture opens first, then the strip runs. Splitting one
         window rather than taking a second one from beats.ts: the two are
         strictly sequential and the proportion between them is a property
         of this beat, not of the page. */
      const enter = clamp01(t / ENTER);
      const travel = clamp01((t - ENTER) / (1 - ENTER));

      root.style.opacity = enter.toFixed(3);
      /* Square -> portrait. The cards inside stay at full height and are
         clipped, so opening the gate reveals them rather than stretching
         them. */
      root.style.setProperty(
        '--gate-h',
        `${((GATE_W + (GATE_H - GATE_W) * enter) * gateUnit()).toFixed(2)}px`
      );
      /* Published so the cards can size themselves off the same unit the
         transforms above use. In vh they would disagree the moment the
         width cap bit. */
      root.style.setProperty('--gu', `${gateUnit().toFixed(4)}px`);

      const vh = gateUnit();
      const mainX = -travel * MAIN_TRAVEL * vh;
      const thumbX = -travel * THUMB_TRAVEL * vh;

      /* -50% on Y is the vertical centring, not an offset — these tracks
         sit at top:50% and carry their own centring in the transform
         because JS is writing the whole property. */
      /* One behaviour, every width.

         This used to freeze the track on a phone and cross-fade the cards
         in place, on the argument that scrolling down while content moves
         sideways is an axis mismatch. The travel is the section, though —
         without it the gate is a slideshow — and the gate already fits a
         phone by construction: gateUnit() caps its unit by width, so the
         frame is 86vw at any size. */
      if (mainRef.current)
        mainRef.current.style.transform = `translate3d(${mainX.toFixed(2)}px, -50%, 0)`;
      const thumbT = `translate3d(${thumbX.toFixed(2)}px, -50%, 0)`;
      if (leftRef.current) leftRef.current.style.transform = thumbT;
      if (rightRef.current) rightRef.current.style.transform = thumbT;

      /* Per-card tilt, as a function of how far the card is through the
         gate. The overscale is derived from the angle rather than picked:
         a w x h rectangle rotated by theta needs cos(theta) + (h/w)
         sin(theta) to still cover its own frame, and anything less shows
         the gate's background in the corners. */
      const gateW = GATE_W * vh;
      for (let i = 0; i < N; i++) {
        const inner = innersRef.current[i];
        if (!inner) continue;
        const centre = i * gateW + gateW / 2 + mainX;
        const d = Math.max(-1, Math.min(1, (centre - gateW / 2) / gateW));
        const deg = TILT_MAX * d;
        const rad = Math.abs(deg) * DEG;
        const cover = Math.cos(rad) + (1 / ASPECT) * Math.sin(rad);
        inner.style.transform = `rotate(${deg.toFixed(3)}deg) scale(${cover.toFixed(4)})`;
      }
    },

    /* The gate stops being a gate.

       Act three grows out of this exact rect, so everything that made it
       read as a WINDOW has to go before it can read as a SCREEN: the two
       side strips, which would otherwise sit either side of a full-bleed
       section, and the dashed outline, which would end up framing the whole
       viewport.

       Both leave early — done by a third of the way — so the frame is
       already gone while the opening still has most of its travel left. A
       dashed rule still visible at half-open reads as a box being resized;
       gone by then, the same motion reads as a view widening. */
    setZoom: (z: number) => {
      /* The strips empty first, and the frame holds while they do.

         That order is the beat: thumbnails slide away, leaving the last
         card alone inside the dashed frame — and only THEN does the frame
         open. Fading everything together instead collapses two moves into
         one and the card never gets its moment. */
      const vh = gateUnit();
      const thumbW = THUMB_W * vh;

      /* The thumbnails are read off the tracks rather than held in a ref
         array. They are children of an element this component already has a
         handle on, so a second bookkeeping structure would only be another
         thing to keep in step with the markup. */
      for (const track of [leftRef.current, rightRef.current]) {
        if (!track) continue;
        // Far enough to clear the wrapper's left edge from anywhere in it.
        const dist =
          (track.parentElement?.getBoundingClientRect().width ?? 0) + thumbW * 2;
        const gone = smoothstep(0, EXIT_DUR, z);
        for (let i = 0; i < track.children.length; i++) {
          const el = track.children[i] as HTMLElement;
          el.style.transform = `translate3d(${(-gone * dist).toFixed(1)}px, 0, 0)`;
        }
      }

      /* The locked card hands over.

         It holds at full opacity for the whole of ZOOM_HOLD — that is the
         locked beat — and then goes as the box behind it starts to grow.
         The two are at identical geometry at that instant, and both show
         the same scene, so what the reader sees is one picture coming to
         life rather than a swap. Short, because the longer it takes the
         more chance there is to notice that the baked still and the live
         layers are not pixel-identical. */
      const last = mainRef.current?.lastElementChild as HTMLElement | undefined;
      if (last) {
        last.style.opacity = (1 - smoothstep(ZOOM_HOLD, ZOOM_HOLD + 0.14, z)).toFixed(3);
      }

      /* The frame goes last, and only once the box has started growing —
         a dashed rule still drawn around a full-viewport section reads as a
         border on the page rather than as the window it used to be. */
      if (frameRef.current) {
        frameRef.current.style.opacity = (1 - smoothstep(0.42, 0.72, z)).toFixed(3);
      }
    },

    /* Hard gate, driven by where the READER is rather than by where this
       section's own progress has got to.

       Opacity is not enough, and neither is a gate on the timeline. The
       scrub trails the wheel by design, so after a long jump — bottom to
       top, or one hard flick — the timeline is still genuinely in act two
       for a second or more while the reader is already looking at the hero.
       Every value in here is faithful to that timeline; the timeline is
       just somewhere the reader is not, and this section paints act two's
       frame over act one's until it catches up.

       So the question has to change. Not "where is the animation" but
       "where is the person" — and the answer to that is the scroll
       position, which never lags. Used ONLY to hide; nothing about the
       choreography is driven from it, so this stays a guard rather than
       becoming the second source of truth this page is careful not to
       have. */
    setEnabled: (on: boolean) => {
      /* display, NOT visibility.

         visibility is the one inherited property a descendant can turn back
         ON: a child with `visibility: visible` re-appears even though its
         parent is hidden. This section's plates set exactly that, every
         frame, to manage the flip — so a root-level `visibility: hidden`
         was being overridden from inside and the picture kept painting.
         display has no such escape hatch. */
      const root = rootRef.current;
      if (root) root.style.display = on ? '' : 'none';
    },
  }));

  const card = (i: number, w: number, h: number) => (
    <div
      key={i}
      className="relative shrink-0 overflow-hidden will-change-transform"
      style={{ width: `calc(${w} * var(--gu, 1vh))`, height: `calc(${h} * var(--gu, 1vh))` }}
    >
      <Image
        src={GALLERY_ITEMS[i].src}
        alt={GALLERY_ITEMS[i].alt}
        fill
        sizes="62vh"
        className="object-cover"
      />
    </div>
  );

  /* Half the viewport, less half the gate, less the gutter. Written as a
     calc rather than a percentage because the gate is measured in vh and
     the viewport in vw — there is no single unit both are in. */
  const sideEdge = `calc(50% + ${(GATE_W / 2 + GUTTER).toFixed(3)} * var(--gu, 1vh))`;

  return (
    <div
      ref={rootRef}
      /* Starts hidden as well as transparent — before the first frame runs
         there is nothing to say this belongs on screen, and the hero is
         what should be under the reader's eye. */
      /* opacity-0 only, NOT `invisible`.

         This carried an `invisible` class back when setEnabled hid the
         section with visibility. That guard moved to `display` — because a
         descendant can turn visibility back on and the plates were doing
         exactly that — and the class was left behind with nothing to clear
         it, which hid the whole carousel permanently.

         The display gate is the complete answer on its own: it takes the
         subtree out of paint and hit-testing entirely, and unlike
         visibility nothing inside can override it. A second mechanism here
         only adds a way for the two to disagree. */
      className="pointer-events-none fixed inset-0 z-10 opacity-0"
      style={{ '--gate-h': `${GATE_W}vh`, '--gu': '1vh' } as GateVars}
    >
      {/* The side strips are the same seven photographs as the gate, so
          they are hidden from assistive tech — the gate's copies carry the
          alt text and reading all three would be reading the section three
          times. */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ right: sideEdge }}
        aria-hidden
      >
        {/* left-full parks this track just past the strip's right edge, so
            at rest the left side is empty and fills as the strip runs —
            the mirror of the right side, which starts full and empties.

            Items 0..N-2: the LAST photograph is dropped. See the note on
            the right-hand strip for why the two are offset by one. */}
        <div
          ref={leftRef}
          className="absolute left-full top-1/2 flex"
          style={{ gap: `calc(${THUMB_GAP} * var(--gu, 1vh))`, opacity: 0.5 }}
        >
          {GALLERY_ITEMS.map((_, i) => card(i, THUMB_W, THUMB_H))}
        </div>
      </div>

      <div
        className="absolute inset-y-0 right-0 overflow-hidden"
        style={{ left: sideEdge }}
        aria-hidden
      >
        {/* Items 1..N-1: the FIRST photograph is dropped, so the two strips
            are offset from each other by exactly one index.

            This is what stops a photograph being on screen twice at once.
            Both strips share the gate's translation, so without the offset
            the card filling the gate also sits at the head of the right
            strip — the same image, at two sizes, side by side.

            With the offset the arithmetic works out exactly: when item k
            fills the gate, it lands one pitch outside BOTH strips, item k+1
            sits at the right strip's leading edge and item k-1 at the left
            strip's trailing edge. So the right strip is what is coming, the
            left is what has been, and the gate's own card is in neither —
            it travels right, through the frame, and out to the left exactly
            once. Oryzo does the same thing by giving the dropped item in
            each track a zero-size box. */}
        <div
          ref={rightRef}
          className="absolute left-0 top-1/2 flex"
          style={{ gap: `calc(${THUMB_GAP} * var(--gu, 1vh))`, opacity: 0.5 }}
        >
          {GALLERY_ITEMS.slice(1).map((_, i) => card(i + 1, THUMB_W, THUMB_H))}
        </div>
      </div>

      {/* The gate. Tailwind's -translate-* utilities are safe here because
          nothing animates this element's transform — only its height. */}
      <div
        ref={gateRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: `calc(${GATE_W} * var(--gu, 1vh))`, height: 'var(--gate-h)' }}
      >
        <div className="absolute inset-0 overflow-hidden">
          {/* No gap: the cards butt, so two of them share the frame while
              one is leaving. */}
          <div ref={mainRef} className="absolute left-0 top-1/2 flex">
            {GALLERY_ITEMS.map((it, i) => (
              <div
                key={i}
                className="relative shrink-0 overflow-hidden"
                style={{
                  width: `calc(${GATE_W} * var(--gu, 1vh))`,
                  height: `calc(${GATE_H} * var(--gu, 1vh))`,
                }}
              >
                {/* The tilt goes on an inner wrapper, not on the card:
                    the card is what the gate clips against, and rotating
                    that would rotate the clip. */}
                <div
                  ref={(el) => {
                    innersRef.current[i] = el;
                  }}
                  className="absolute inset-0"
                >
                  <Image src={it.src} alt={it.alt} fill sizes="62vh" className="object-cover" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div ref={frameRef} className={styles.gate} aria-hidden />
      </div>
    </div>
  );
};
