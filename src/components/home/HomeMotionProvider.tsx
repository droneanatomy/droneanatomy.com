'use client';

/* Owns exactly two things: ScrollSmoother, and the single --page-progress
   scalar the light-to-dark theme arc derives from. It knows nothing about any
   section's internals.

   position:fixed elements MUST render outside this component. Smoother
   transforms #smooth-content, creating a new containing block, so fixed
   children would anchor to the content instead of the viewport. */

import React, { useRef } from 'react';
import { gsap, ScrollSmoother, ScrollTrigger, useGSAP } from '../motion/gsap-setup';

export interface HomeMotionProviderProps {
  children: React.ReactNode;
  arcTrigger?: string;
}

export const HomeMotionProvider: React.FC<HomeMotionProviderProps> = ({
  children,
  arcTrigger = '#stats-band',
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const smoother = ScrollSmoother.create({
          wrapper: '#smooth-wrapper',
          content: '#smooth-content',
          smooth: 1.2,
          effects: true,
        });

        const root = document.documentElement;
        const trigger = document.querySelector(arcTrigger);

        const arc = trigger
          ? gsap.to(root, {
              '--page-progress': 1,
              /* inOut, not linear. A linear blend parks the page at mid-grey
                 through the middle of the range, where background and text are
                 both mid-tone and contrast collapses. inOut lingers at the two
                 legible ends and traverses the ambiguous zone quickly. */
              ease: 'power3.inOut',
              scrollTrigger: {
                trigger,
                start: 'top 75%',
                end: 'bottom 30%',
                scrub: 0.6,
              },
            })
          : null;

        /* Late-arriving content changes the document height after triggers are
           measured: the hero canvas is a dynamic ssr:false import, product
           images are lazy, and custom fonts reflow text. Without re-measuring,
           every trigger stays anchored to the initial (shorter) layout — which
           silently shifts the whole arc by roughly one viewport. */
        const refresh = () => ScrollTrigger.refresh();

        window.addEventListener('load', refresh);

        /* Debounced, not rAF. A single frame is not enough for layout to
           settle after a size change: the refresh lands mid-reflow, Smoother
           keeps a stale scroll length, and native scrolling then double-applies
           on top of the content transform — the page ends up one full
           scroll-length out and the footer disappears off the top. */
        const content = document.querySelector('#smooth-content');
        let timer: ReturnType<typeof setTimeout>;
        const debouncedRefresh = () => {
          clearTimeout(timer);
          timer = setTimeout(refresh, 160);
        };
        const ro = new ResizeObserver(debouncedRefresh);
        if (content) ro.observe(content);

        if (document.fonts?.ready) document.fonts.ready.then(refresh);

        return () => {
          window.removeEventListener('load', refresh);
          clearTimeout(timer);
          ro.disconnect();
          arc?.scrollTrigger?.kill();
          arc?.kill();
          smoother.kill();
        };
      });

      /* Reduced motion: no smoothing, no scrub. The page still darkens, but as
         a discrete step rather than a scrubbed gradient. */
      mm.add('(prefers-reduced-motion: reduce)', () => {
        const root = document.documentElement;
        const trigger = document.querySelector(arcTrigger);
        if (!trigger) return;

        const st = ScrollTrigger.create({
          trigger,
          start: 'bottom 60%',
          onEnter: () => gsap.set(root, { '--page-progress': 1 }),
          onLeaveBack: () => gsap.set(root, { '--page-progress': 0 }),
        });

        return () => st.kill();
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref}>
      <div id="smooth-wrapper">
        <div id="smooth-content">{children}</div>
      </div>
    </div>
  );
};

export default HomeMotionProvider;
