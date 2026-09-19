'use client';

/* ============================================================
   HoldToFly — the hero's hidden way into the flight sim.

   Press and hold anywhere on the ink for HOLD_MS and the page hands you
   /fly. Nothing announces it; a ring draws itself at the pointer once a
   press has outlasted RING_DELAY_MS, which is the only tell there is.
   The rules for both live in holdTiming.ts, tested there.

   IT LEANS ON A RULE THAT IS ALREADY TRUE. InkHero's text layer is
   `pointer-events: none` with only links and buttons re-enabling, so a
   press on the hero lands on the ink whatever is drawn over it — there
   is no "was that the headline?" test to get wrong, and no way to start
   a hold by trying to select the tagline. The one guard left is for the
   elements that DO take the pointer.

   NO REACT STATE, not once, between the press and the navigation. The
   ring is written straight onto its own nodes from the rAF loop. State
   here would re-render InkHero about seventy times during a single hold,
   reconciling the whole lockup and the SVG underline with it — the same
   reason FlightPreview drives its scroll work through refs.

   NO PREFETCH, by request. Holding does not touch the network; the route
   loads when the ring closes, like any other navigation.

   POINTER-FINE ONLY. FlyGame tells touch visitors the sim needs a
   keyboard, so spending the discovery on a phone spends it on a dead
   end — and a long press there fights the context menu and the
   selection callout to do it.
   ============================================================ */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isComplete, ringProgress, ringVisible } from './holdTiming';
import styles from './HoldToFly.module.css';

/* The arc turns from white to flare over the last stretch, so the ring
   reads as closing rather than merely filling. */
const FLARE_AT = 0.82;
const RING_WHITE = '#ffffff';

export const HoldToFly: React.FC = () => {
  const router = useRouter();
  const ringRef = useRef<SVGSVGElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const ring = ringRef.current;
    const arc = arcRef.current;
    if (!ring || !arc) return;

    /* The hero itself, found through the ring rather than passed in: the
       ring is its child, so this cannot go stale or point at the wrong
       section if the hero is ever rendered twice. */
    const hero = ring.parentElement;
    if (!hero) return;

    const fine = window.matchMedia('(pointer: fine)');
    let raf = 0;
    let start = 0;

    const place = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      ring.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
    };

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ring.style.opacity = '0';
    };

    const frame = (now: number) => {
      const elapsed = now - start;

      if (isComplete(elapsed)) {
        stop();
        router.push('/fly');
        return;
      }

      if (ringVisible(elapsed)) {
        const p = ringProgress(elapsed);
        ring.style.opacity = '1';
        arc.style.strokeDashoffset = String(1 - p);
        arc.style.stroke = p > FLARE_AT ? 'var(--flare)' : RING_WHITE;
      }

      raf = requestAnimationFrame(frame);
    };

    const down = (e: PointerEvent) => {
      /* Secondary buttons, second fingers and anything that can take a
         click of its own are somebody else's event. */
      if (!fine.matches || !e.isPrimary || e.button !== 0) return;
      if ((e.target as Element | null)?.closest('a, button')) return;

      stop();
      place(e);
      arc.style.strokeDashoffset = '1';
      start = performance.now();
      raf = requestAnimationFrame(frame);
    };

    /* The ring FOLLOWS the pointer rather than cancelling on it. The ink
       under it is already dissolving wherever the cursor goes; a hold
       that broke on a few pixels of drift would feel like a fault. */
    const move = (e: PointerEvent) => {
      if (raf) place(e);
    };

    hero.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    window.addEventListener('scroll', stop, { passive: true });
    window.addEventListener('keydown', stop);

    return () => {
      stop();
      hero.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      window.removeEventListener('scroll', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [router]);

  /* aria-hidden and out of the tab order: an easter egg that announces
     itself to a screen reader is not one, and there is nothing here to
     operate with a keyboard. */
  return (
    <svg ref={ringRef} className={styles.ring} viewBox="-30 -30 60 60" aria-hidden="true" focusable="false">
      <circle className={styles.track} r="22" />
      <circle ref={arcRef} className={styles.arc} r="22" pathLength={1} />
    </svg>
  );
};

export default HoldToFly;
