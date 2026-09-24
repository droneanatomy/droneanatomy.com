'use client';

/* ============================================================
   TopoBlock — the scrolling shell around TopoSection.

   Same arrangement as the flight: a tall root for scroll distance and
   one sticky stage so the scene is confined to its own section rather
   than covering the document.

   The copy is real DOM, and the summit labels are DOM too, positioned
   from points the scene projects each frame. Drawing labels into WebGL
   would have cost a font atlas and made them unselectable and invisible
   to a screen reader, for type that is the actual content of the beat.
   ============================================================ */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap, SplitText } from '@/components/motion/gsap-setup';
import { TopoSection } from './TopoSection';
import { PLATE_IN, copyLift, copyOn, revealAt, scrimOn, titleOn, writtenHeight, type Line } from './topoBeats';
import styles from './TopoBlock.module.css';

/* How lit a word is before its turn comes. ZERO, matching the reference:
   the lines below the writing edge are not there at all, so the paragraph
   grows line by line and only the word or two at the leading edge is ever
   caught mid-fade. A faint ghost of the unwritten text was tried first and
   read as a paragraph already printed and being highlighted — the
   opposite of watching it being written. */
const UNWRITTEN = 0;

/* How many words the leading edge spans. One word at a time reads as a
   typewriter; a soft edge a few words wide reads as the page being
   written, which is what the reference does. */
const EDGE_WORDS = 4;

type Marker = { name: string; note: string; x: number; y: number; on: number };

/* Four screens. The reference takes about 3.25 to reach overhead; the
   extra gives the plate a moment to be read before the section ends
   rather than snapping straight into whatever follows. */
const SCREENS = 4;

export const TopoBlock: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [p, setP] = useState(0);

  /* Throttled into state: the labels only need to move a few times a
     second, and the camera reads the ref directly at full rate. */
  const lastPush = useRef(0);
  const onMarkers = useCallback((m: Marker[]) => {
    const now = performance.now();
    if (now - lastPush.current < 60) return;
    lastPush.current = now;
    setMarkers(m);
  }, []);

  const titleRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLParagraphElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const copy = copyRef.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* THE WRITING. The paragraph is split into words and each word gets
       its own short fade, staggered so the leading edge is EDGE_WORDS
       wide and the last word lands exactly at the end of the timeline.
       The timeline is paused and SCRUBBED from scroll, never played.

       autoSplit re-splits on resize and on late font loads, and throws the
       old timeline away with it, so the new one is put straight back at
       wherever the reader already is — the same arrangement ProductLoop
       uses for its statement. */
    let story: gsap.core.Timeline | null = null;
    let at = reduced ? 1 : 0;

    /* The laid-out lines, for the climb. Re-measured on every split, which
       autoSplit triggers on resize and late font loads — exactly the two
       things that re-wrap the paragraph and change where its lines fall. */
    let lines: Line[] = [];
    let wordStep = 0;
    let wordFade = 1;

    const split = copy
      ? SplitText.create(copy, {
          type: 'words',
          autoSplit: true,
          aria: 'auto',
          onSplit: (self) => {
            const words = self.words as HTMLElement[];
            const n = Math.max(1, words.length);
            const fade = Math.min(0.25, EDGE_WORDS / n);
            const step = n > 1 ? (1 - fade) / (n - 1) : 0;
            wordStep = step;
            wordFade = fade;

            /* A line starts wherever a word sits lower than the one before
               it. Read from offsetTop, which the transform applied every
               frame does not affect, so measuring mid-scroll is safe. The
               threshold is half a word's height rather than a pixel count,
               so the keyword's box padding cannot split a line in two. */
            const starts: number[] = [];
            let lastTop = -Infinity;
            words.forEach((w, i) => {
              if (w.offsetTop - lastTop > w.offsetHeight * 0.5) {
                starts.push(i);
                lastTop = w.offsetTop;
              }
            });
            lines = starts.map((first, j) => ({
              first,
              h:
                j < starts.length - 1
                  ? words[starts[j + 1]].offsetTop - words[first].offsetTop
                  : words[first].offsetHeight,
            }));

            story = gsap.timeline({ paused: true });
            words.forEach((w, i) => {
              story!.fromTo(w, { opacity: UNWRITTEN }, { opacity: 1, duration: fade, ease: 'none' }, i * step);
            });

            /* The keyword's box arrives WITH its word rather than sitting
               there from the start — a solid yellow block in an unwritten
               paragraph would be read first and give the line away. */
            const key = copy.querySelector('mark');
            const first = key ? words.findIndex((w) => key.contains(w)) : -1;
            if (key && first >= 0) {
              story.fromTo(
                key,
                { '--key': 0 },
                { '--key': 1, duration: fade, ease: 'none' },
                first * step
              );
            }
            story.progress(at);
            return story;
          },
        })
      : null;

    let raf = 0, queued = false;
    const measure = () => {
      raf = 0; queued = false;
      const r = root.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      const v = Math.min(1, Math.max(0, -r.top / travel));
      progressRef.current = v;
      setP((prev) => (Math.abs(prev - v) > 0.008 ? v : prev));

      /* Written straight onto the nodes, every frame the scroll moves.
         Through React state this would re-render the whole block —
         markers, rail and all — for every word of the paragraph. */
      if (titleRef.current) titleRef.current.style.opacity = String(titleOn(v));
      if (scrimRef.current) scrimRef.current.style.opacity = String(scrimOn(v));
      if (!reduced) {
        at = revealAt(v);
        story?.progress(at);
      }
      if (copy) {
        /* Two lifts, added. The CLIMB keeps the written part of the
           paragraph centred on the anchor its CSS `top` sets — half the
           written height, so a new line pushes the block up by half a line.
           The DISSOLVE carries it the last little way up as it leaves. */
        const lift = copyLift(v);
        const climb = writtenHeight(at, lines, wordStep, wordFade) / 2;
        copy.style.opacity = String(copyOn(v));
        copy.style.transform = `translate3d(0, ${(-climb - lift * 28).toFixed(2)}px, 0)`;
        copy.style.filter = lift > 0 ? `blur(${(lift * 5).toFixed(2)}px)` : '';
      }
    };
    const schedule = () => { if (!queued) { queued = true; raf = requestAnimationFrame(measure); } };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      split?.revert();
    };
  }, []);

  const plateOn = Math.min(1, Math.max(0, (p - PLATE_IN) / 0.18));

  return (
    <div ref={rootRef} className={styles.root} style={{ height: `${SCREENS * 100}vh` }}>
      <div className={styles.stage}>
        <TopoSection progressRef={progressRef} onMarkers={onMarkers} className={styles.canvas} />

        {/* Takes the terrain down behind the paragraph. Between the canvas
            and the chrome, so it darkens the mountain and never the words. */}
        <div ref={scrimRef} className={styles.scrim} style={{ opacity: 0 }} aria-hidden="true" />

        <div className={styles.chrome}>
          <p className={styles.coords}>
            <span>28.6139&deg; N</span>
            <span>77.2090&deg; E</span>
          </p>

          <div ref={titleRef} className={styles.intro}>
            <h2 className={styles.title}>
              <span className={styles.line}>We know,</span>
              <span className={styles.line}>what&apos;s inside.</span>
            </h2>
          </div>

          {/* PLACEHOLDER COPY, drafted to be rewritten. Keep exactly one
              <mark>: it is the word that gets the yellow box, and its box
              is timed to its own first word. */}
          {/* <p ref={copyRef} className={styles.copy} style={{ opacity: 0 }}>
            Every flight comes back with more than footage. It comes back with the
            ground itself — every <mark className={styles.key}>ridgeline</mark>, gully
            and treeline measured to the centimetre, the slope that floods and the one
            that holds. You don&apos;t learn terrain like this from a map. You fly it
            once, and then you can plan on it.
          </p> */}
          <p ref={copyRef} className={styles.copy} style={{ opacity: 0 }}>
            Most drone companies assemble. We started by taking them apart. 
            Since 2015 we have serviced <mark className={styles.key}>12,000+</mark> drones and 
            documented 100+ ways they fail in the field, and every one of those lessons is 
            built into our own. The flight controller, the sensors, the autonomy stack: 
            we design what goes inside, not just the airframe around it. 
            America has Skydio. China has DJI. India doesn&apos;t yet. We&apos;re building it.
          </p>

          <p className={styles.plate} style={{ opacity: plateOn }}>
            Plan view &middot; 1 m contour
          </p>

          {markers.map((m) => (
            <div
              key={m.name}
              className={styles.marker}
              style={{ left: `${m.x}%`, top: `${m.y}%`, opacity: m.on }}
            >
              <span className={styles.dot} />
              <span className={styles.name}>{m.name}</span>
              <span className={styles.note}>{m.note}</span>
            </div>
          ))}
        </div>

        <div className={styles.rail}>
          <span>Scroll to survey</span>
          <span className={styles.pct}>{Math.round(p * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default TopoBlock;
