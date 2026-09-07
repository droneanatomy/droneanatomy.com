'use client';

/* ============================================================
   ViewerHotspots — the annotation for the selected feature.

   ONE AT A TIME. Every hotspot used to be drawn at once, which made the dots
   a way to CHOOSE a feature; only the selected one is drawn now, so they are
   a way to SEE the one you chose. The list is the control, and the mark on
   the aircraft is what connects a row to a place on it.

   The cost is that nothing on the model advertises that there are four
   points — that job moves entirely to the list beside it, and to the "Four
   points" caption above the frame. The gain is that the render carries one
   mark instead of a constellation competing with the aircraft.

   THE ANNOTATION DRAWS ITSELF, in three beats: the dot lands, a leader line
   extends out and bends, and the label arrives at the end of it. The point of
   the sequence is that the interface looks like it is MARKING UP the
   aircraft rather than labelling it — which is only legible if the beats are
   separated in time.

   ONE PATH, NOT TWO SEGMENTS. The leader is a single polyline that goes
   up-left and then turns horizontal, revealed by animating one
   stroke-dashoffset. The elbow needs no sequencing of its own: it happens
   partway through the draw because the path bends there. `pathLength={1}`
   normalises the geometry so the offset runs 1 -> 0 whatever the lengths.

   THE ELBOW ALWAYS GOES LEFT, and that is reliable rather than lucky. The
   pivot springs onto the anchor and the camera looks at the pivot, so a
   settled hotspot projects to almost exactly the centre of the panel —
   measured at 0.500, 0.500. The whole left half is therefore always free,
   and the feature list on the right is never collided with. This stops being
   true the day a pose frames its anchor off-centre; that is the thing to
   check if the label ever runs off the frame.

   They are DOM rather than sprites. The reference draws its labels into the
   canvas with an MSDF font atlas, which is the right call when the label has
   to survive being composited over geometry and the site already ships the
   atlas. Here it would buy a font pipeline and cost the thing that matters
   more: a real <button> takes focus, answers Enter and Space, and announces
   itself.

   POSITIONED BY THE RENDER LOOP, NOT BY REACT. sync() is called from the
   same rAF that draws the frame and writes styles straight to refs. Routing
   four positions per frame through setState would re-render the tree sixty
   times a second to move four absolutely-positioned marks.
   ============================================================ */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { facing, ndcToPanel, type Vec3 } from './orbit';
import type { ViewerHotspot } from './product';

export type HotspotsHandle = {
  sync: (camera: THREE.PerspectiveCamera, settled: boolean) => void;
};

type Props = {
  hotspots: ViewerHotspot[];
  selected: number | null;
  onSelect: (i: number) => void;
};

/* Opacity for the SELECTED dot while its own anchor is turned away — which
   now only happens mid-flight, since every authored pose ends up looking at
   its own hotspot. Faded rather than hidden so the mark reads as travelling
   round the aircraft with the camera rather than blinking out and back. */
const AWAY = 0.15;

/* THE LEADER'S GEOMETRY, in panel pixels from the anchor.

   DIAG is the 45-degree run out of the dot; RUN is the horizontal that
   follows it. Both negative in x because the elbow goes left — see the note
   at the top of the file for why that is safe.

   The label sits ABOVE the horizontal rather than beyond its end, so a long
   caption grows back toward the dot instead of off the left edge of the
   panel. "30 MIN FLIGHT TIME" is the longest here at roughly 150px, which
   still stops short of the anchor. */
const HIT = 22; // clickable square, centred on the anchor
const DIAG = 30;
const RUN = 124;
const LABEL_GAP = 6;

/* The button is a FIXED square rather than sized by its contents, and that
   is a correction as much as a convenience. It used to be a flex row of
   dot-gap-label, and `translate(-50%,-50%)` centres whatever box it is given
   — so the box being centred on the anchor was 95px wide and the visible dot
   sat 43px to the LEFT of the point it was marking. Measured, not guessed. A
   square of known size puts the dot exactly on the anchor, and everything
   else hangs off the middle of it. */
const HALF = HIT / 2;

export const ViewerHotspots = forwardRef<HotspotsHandle, Props>(function ViewerHotspots(
  { hotspots, selected, onSelect },
  ref
) {
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const leaders = useRef<(SVGPathElement | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const projected = useRef(new THREE.Vector3());
  const boxRef = useRef<HTMLDivElement>(null);
  /* The panel's size, CACHED. sync() runs every frame and reading
     clientWidth there would force a layout flush sixty times a second for a
     number that only changes on resize. */
  const size = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    sync(camera, settled) {
      const cam: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
      /* Named panelW/panelH rather than w/h because `h` is the hotspot in
         the loop below, and the shadowing silently fed a ViewerHotspot into
         a number parameter. TypeScript caught it; the names keep it caught. */
      const { w: panelW, h: panelH } = size.current;
      /* Before the first measure there is nowhere to put anything, and
         placing at 0,0 would flash all four in the corner. */
      if (!panelW || !panelH) return;

      hotspots.forEach((h, i) => {
        const el = dots.current[i];
        if (!el) return;

        const v = projected.current.set(h.anchor[0], h.anchor[1], h.anchor[2]).project(camera);

        /* Behind the near plane: NDC z leaves [-1, 1] and x/y become
           meaningless — a point behind the camera projects to a mirrored
           position in front of it. Parked rather than placed. */
        if (v.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.tabIndex = -1;
          return;
        }

        const [px, py] = ndcToPanel(v.x, v.y, panelW, panelH);
        /* Pixels for the projection, then a fixed half-square to centre the
           button on the point. HALF rather than a percentage translate,
           because the box is a known size now and a literal is clearer than
           a percentage that has to be reasoned about. */
        el.style.transform = `translate3d(${px - HALF}px, ${py - HALF}px, 0)`;

        /* ONLY THE SELECTED HOTSPOT IS DRAWN.

           An unselected mark is hidden outright rather than dimmed, so the
           render carries one annotation at a time and the aircraft is not
           read through a constellation of points competing with it.

           It is still POSITIONED above, though, and that is the reason this
           returns here rather than earlier: a mark that stopped tracking
           while hidden would be holding a stale projection from whenever it
           was last selected, and would visibly jump across the panel at the
           moment it came back. It follows the model in the dark and simply
           fades up already in the right place. */
        if (selected !== i) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.tabIndex = -1;
          /* Rewound while invisible, so the next selection draws the leader
             from nothing instead of revealing one already finished. */
          const path = leaders.current[i];
          const label = labels.current[i];
          if (path) path.style.strokeDashoffset = '1';
          if (label) label.style.opacity = '0';
          return;
        }

        /* The facing test still applies to the one that IS shown. Selecting
           a hotspot on the far side starts a flight from where the camera
           happens to be, so for the first part of that move its own anchor
           can still be turned away — it comes up as the aircraft turns. */
        const visible = facing(h.normal as Vec3, cam, h.anchor as Vec3);
        el.style.opacity = visible ? '1' : String(AWAY);
        /* A dot on the far side must not be clickable or tabbable THROUGH
           the airframe — otherwise the keyboard order runs round the back
           of an aircraft the reader cannot see. */
        el.style.pointerEvents = visible ? 'auto' : 'none';
        el.tabIndex = visible ? 0 : -1;

        /* THE SECOND AND THIRD BEATS, gated on the camera having arrived
           rather than on a timer. A fixed delay would be wrong by however
           much the flight's length varies, and it varies by design: the
           spring takes longer to cross the aircraft than to nudge round it.
           See ElasticRig.settled(). */
        const path = leaders.current[i];
        const label = labels.current[i];
        if (path) path.style.strokeDashoffset = settled ? '0' : '1';
        if (label) label.style.opacity = settled ? '1' : '0';
      });
    },
  }));

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {hotspots.map((h, i) => (
        <button
          key={h.label}
          type="button"
          ref={(el) => {
            dots.current[i] = el;
          }}
          onClick={() => onSelect(i)}
          aria-pressed={selected === i}
          style={{ opacity: 0, width: HIT, height: HIT }}
          className={
            'absolute left-0 top-0 transition-opacity duration-200 ' +
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 ' +
            'focus-visible:outline-[var(--color-flare)]'
          }
        >
          {/* THE DOT, on the anchor itself. Centred in the hit square rather
              than being the square, so the target stays comfortably larger
              than the 7px mark it carries. */}
          <span
            aria-hidden
            className={
              'absolute left-1/2 top-1/2 block size-[7px] -translate-x-1/2 -translate-y-1/2 ' +
              'rounded-full bg-[var(--color-flare)]'
            }
          />

          {/* A ZERO-SIZE ORIGIN AT THE ANCHOR. Everything that hangs off the
              dot is positioned from here in negative coordinates, so the
              leader and the label share one frame of reference and cannot
              drift apart when the geometry constants are tuned. Without it
              the label's `left` would resolve against the hit square's edge
              while the path resolved against its centre. */}
          <span aria-hidden className="absolute left-1/2 top-1/2 block size-0">
            {/* THE LEADER. overflow-visible because the path is drawn out of
                the top-left in negative coordinates. */}
            <svg className="absolute left-0 top-0 h-px w-px overflow-visible" viewBox="0 0 1 1">
            <path
              ref={(el) => {
                leaders.current[i] = el;
              }}
              d={`M 0 0 L ${-DIAG} ${-DIAG} L ${-(DIAG + RUN)} ${-DIAG}`}
              fill="none"
              stroke="var(--color-flare)"
              /* Dimmer than the dot and the label so the hierarchy is
                 read in the right order: the point, then what it says,
                 then the line that joins them. */
              strokeOpacity={0.75}
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              /* Normalised, so one offset drives the reveal whatever DIAG
                 and RUN are set to. Without it the dash values would have to
                 be recomputed from the geometry every time it is tuned. */
              pathLength={1}
              strokeDasharray={1}
              style={{ strokeDashoffset: 1 }}
              className="transition-[stroke-dashoffset] duration-[520ms] ease-out motion-reduce:transition-none"
            />
            </svg>

            {/* THE LABEL, sitting above the horizontal run and left-aligned
                to its far end. `bottom` rather than `top` so the text grows
                UPWARD off the line — anchored by its baseline edge, the gap
                to the leader stays constant whatever the font size does. */}
            <span
              ref={(el) => {
                labels.current[i] = el;
              }}
              style={{ left: -(DIAG + RUN), bottom: DIAG + LABEL_GAP, opacity: 0 }}
              className={
                'absolute whitespace-nowrap font-display text-[10px] ' +
                'font-bold uppercase tracking-[0.14em] text-[var(--color-flare)] ' +
                'transition-opacity duration-[260ms] delay-[420ms] ease-out ' +
                'motion-reduce:transition-none motion-reduce:delay-0'
              }
            >
              {h.label}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
});

export default ViewerHotspots;
