'use client';

/* Fades and lifts children as they enter the viewport.

   Children are server-rendered and arrive as props, so this client boundary
   costs nothing in the static export — the copy is still in the HTML. */

import React, { useRef } from 'react';
import { gsap, useGSAP } from './gsap-setup';

export interface RevealProps {
  children: React.ReactNode;
  y?: number;
  delay?: number;
  className?: string;
}

export const Reveal: React.FC<RevealProps> = ({ children, y = 28, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(ref.current, {
          opacity: 0,
          y,
          duration: 0.9,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 88%' },
        });
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.from(ref.current, {
          opacity: 0,
          duration: 0.3,
          delay,
          scrollTrigger: { trigger: ref.current, start: 'top 95%' },
        });
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

export default Reveal;
