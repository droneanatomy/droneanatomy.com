'use client';

/* ============================================================
   useChromeTone — what tone should fixed chrome paint in right now?

   Site chrome floats over whatever the page paints, and it is
   position:fixed, so it sits outside every page's subtree and can never
   inherit a colour from the content beneath it. It has to be told.

   The route is not enough. A single page can have both grounds — the
   homepage currently stacks a dark hero above a light one — so a
   per-route tone is wrong the moment anyone scrolls.

   So: any section that paints LIGHT marks itself `data-chrome="ink"`,
   and this hook reports 'ink' while one of them is crossing the chrome's
   own eye-line.

   DELIBERATELY STATELESS. The first version held a Set of intersecting
   elements and rebuilt an IntersectionObserver whenever the DOM changed.
   Two failure modes, and the second one shipped:

     - a section that is replaced rather than moved (a lazy mount, an HMR
       swap) leaves a stale element in the Set. An observer never reports
       a detached node as having left, so size stays above zero and the
       tone latches to 'ink' permanently.
     - rebuilding on every mutation could out-run the observer's own
       async first callback, so setTone was never reached at all.

   Asking "what is at this line, right now" is a direct geometric
   question, so it is answered directly. Nothing is remembered between
   frames, which means nothing can go stale.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export type ChromeTone = 'ink' | 'light';

export function useChromeTone(initial: ChromeTone = 'light') {
  const pathname = usePathname();
  const ref = useRef<HTMLElement | null>(null);
  const [tone, setTone] = useState<ChromeTone>(initial);

  useEffect(() => {
    let raf = 0;
    let stopped = false;

    const evaluate = () => {
      raf = 0;
      if (stopped) return;

      /* The chrome's own vertical midpoint, measured when we have the
         element and assumed otherwise. Being a few pixels out cannot
         matter — the sections being tested are viewport-sized. */
      const h = ref.current?.getBoundingClientRect().height;
      const eye = (h && h > 8 ? h : 60) / 2;

      let ink = false;
      const marked = document.querySelectorAll('[data-chrome="ink"]');
      for (const el of marked) {
        const b = el.getBoundingClientRect();
        if (b.top <= eye && b.bottom >= eye) {
          ink = true;
          break;
        }
      }
      setTone(ink ? 'ink' : 'light');
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(evaluate);
    };

    /* Settle once on mount, then follow scroll and resize. rAF-coalesced,
       so a burst of scroll events costs one measurement per frame, over a
       handful of sections. */
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    /* Sections arrive late on routes that mount their hero lazily (the
       homepage does — ssr:false), so re-measure when the DOM changes.
       This only schedules a measurement; it never rebuilds any state,
       which is what makes it safe to fire often. */
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [pathname]);

  return { tone, ref };
}

export default useChromeTone;
