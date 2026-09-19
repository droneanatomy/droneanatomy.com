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
import { TopoSection } from './TopoSection';
import styles from './TopoBlock.module.css';

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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0, queued = false;
    const measure = () => {
      raf = 0; queued = false;
      const r = root.getBoundingClientRect();
      const travel = Math.max(1, r.height - window.innerHeight);
      const v = Math.min(1, Math.max(0, -r.top / travel));
      progressRef.current = v;
      setP((prev) => (Math.abs(prev - v) > 0.008 ? v : prev));
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

  /* Copy fades out as the plate arrives; the plate has its own labels and
     a headline over it would fight them. */
  const introOn = 1 - Math.min(1, Math.max(0, (p - 0.5) / 0.22));
  const plateOn = Math.min(1, Math.max(0, (p - 0.74) / 0.18));

  return (
    <div ref={rootRef} className={styles.root} style={{ height: `${SCREENS * 100}vh` }}>
      <div className={styles.stage}>
        <TopoSection progressRef={progressRef} onMarkers={onMarkers} className={styles.canvas} />

        <div className={styles.chrome}>
          <p className={styles.coords}>
            <span>28.6139&deg; N</span>
            <span>77.2090&deg; E</span>
          </p>

          <div className={styles.intro} style={{ opacity: introOn }}>
            <h2 className={styles.title}>
              <span className={styles.line}>The ground,</span>
              <span className={styles.line}>measured.</span>
            </h2>
            <p className={styles.body}>
              Every flight comes back with a surface. Elevation, slope, canopy — the
              same terrain the aircraft just crossed, turned into something you can plan on.
            </p>
          </div>

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
