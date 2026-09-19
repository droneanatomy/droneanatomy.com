'use client';

/* Counts up when scrolled into view. Renders the final value as its initial
   text so the real number is in the static HTML and stays correct if JS never
   runs. */

import React, { useEffect, useRef, useState } from 'react';

export interface HomeCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export const HomeCounter: React.FC<HomeCounterProps> = ({
  value,
  label,
  prefix = '',
  suffix = '',
  duration = 1800,
}) => {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* The reset to 0 happens inside the observer callback rather than here:
       calling setState synchronously in an effect body triggers a cascading
       render, and it also means the final value stays on screen until the
       counter is actually scrolled to. */
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || done.current) return;
          done.current = true;
          setDisplay(0);

          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.floor(value * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <span className="font-display text-[clamp(40px,5.4vw,84px)] leading-none tracking-[-0.02em] tabular-nums">
        {prefix}
        {display}
        {suffix}
      </span>
      <span className="text-[clamp(11px,0.9vw,13px)] uppercase tracking-[0.16em] opacity-60">
        {label}
      </span>
    </div>
  );
};

export default HomeCounter;
