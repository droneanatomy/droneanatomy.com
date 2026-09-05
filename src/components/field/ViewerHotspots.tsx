'use client';

/* ============================================================
   ViewerHotspots — the dots, and they are DOM rather than sprites.

   The reference draws its labels into the canvas with an MSDF font atlas,
   which is the right call when the label has to survive being composited
   over geometry and the site already ships the atlas. Here it would buy a
   font pipeline and cost the thing that matters more: a real <button> takes
   focus, answers Enter and Space, and announces itself. Four dots is not
   enough geometry to be worth losing that over.

   POSITIONED BY THE RENDER LOOP, NOT BY REACT. sync() is called from the
   same rAF that draws the frame and writes transforms straight to refs.
   Routing four positions per frame through setState would re-render the
   tree sixty times a second to move four absolutely-positioned dots.
   ============================================================ */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { facing, ndcToPanel, type Vec3 } from './orbit';
import type { ViewerHotspot } from './product';

export type HotspotsHandle = {
  sync: (camera: THREE.PerspectiveCamera) => void;
};

type Props = {
  hotspots: ViewerHotspot[];
  selected: number | null;
  onSelect: (i: number) => void;
};

/* Opacity for a dot whose anchor has turned away. Faded rather than hidden:
   the reference hides its own, but with four dots on a small airframe a dot
   that vanishes reads as a glitch where one that fades reads as depth. */
const AWAY = 0.15;

export const ViewerHotspots = forwardRef<HotspotsHandle, Props>(function ViewerHotspots(
  { hotspots, selected, onSelect },
  ref
) {
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
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
    sync(camera) {
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
        /* Pixels for the projection, then a percentage translate to centre
           the dot on the point. The percentage is correct HERE precisely
           because it is meant to resolve against the element's own box —
           which is the same rule that made it wrong for the projection. */
        el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;

        const visible = facing(h.normal as Vec3, cam, h.anchor as Vec3);
        el.style.opacity = visible ? '1' : String(AWAY);
        /* A dot on the far side must not be clickable or tabbable THROUGH
           the airframe — otherwise the keyboard order runs round the back
           of an aircraft the reader cannot see. */
        el.style.pointerEvents = visible ? 'auto' : 'none';
        el.tabIndex = visible ? 0 : -1;
        /* Nearer dots draw over farther ones. NDC z runs 0..1 across the
           frustum, so this is just its inverse, scaled to something CSS
           will take. */
        el.style.zIndex = String(Math.round((1 - v.z) * 1000));
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
          className={
            'absolute left-0 top-0 flex items-center gap-2 transition-opacity duration-200 ' +
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 ' +
            'focus-visible:outline-[#f2ecd9]'
          }
          style={{ opacity: 0 }}
        >
          <span
            aria-hidden
            className={
              'block rounded-full transition-all duration-300 ' +
              (selected === i
                ? 'size-[9px] bg-[#c9e265] ring-4 ring-[rgba(201,226,101,0.28)]'
                : 'size-[7px] bg-[#f2ecd9] ring-0')
            }
          />
          <span
            className={
              'whitespace-nowrap font-display text-[10px] font-bold uppercase tracking-[0.14em] ' +
              'text-[#c9e265] transition-opacity duration-300 ' +
              (selected === i ? 'opacity-100' : 'pointer-events-none opacity-0')
            }
          >
            {h.label}
          </span>
        </button>
      ))}
    </div>
  );
});

export default ViewerHotspots;
