'use client';

/* Per-character headline reveal.

   Takes `text` as a string rather than children because SplitText rewrites the
   DOM inside the element; passing arbitrary children would let it shred nested
   markup. The plain text still server-renders inside the heading. */

import React, { useRef } from 'react';
import { gsap, SplitText, useGSAP } from './gsap-setup';

export interface SplitHeadingProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}

export const SplitHeading: React.FC<SplitHeadingProps> = ({ text, className = '', as = 'h2' }) => {
  const ref = useRef<HTMLHeadingElement>(null);
  const Tag = as;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const split = new SplitText(ref.current, { type: 'chars,words,lines' });
        gsap.from(split.chars, {
          opacity: 0,
          yPercent: 110,
          duration: 0.8,
          ease: 'power4.out',
          stagger: 0.012,
          scrollTrigger: { trigger: ref.current, start: 'top 85%' },
        });
        return () => split.revert();
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.from(ref.current, {
          opacity: 0,
          duration: 0.3,
          scrollTrigger: { trigger: ref.current, start: 'top 92%' },
        });
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <Tag ref={ref} className={className}>
      {text}
    </Tag>
  );
};

export default SplitHeading;
