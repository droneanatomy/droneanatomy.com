/* Server component. First fully-dark beat — by the time this is centred,
   --page-progress has reached 1. */

import React from 'react';
import { Reveal, SplitHeading } from '@/components/motion';

export interface Capability {
  /** Two-digit ordinal, e.g. "01". */
  index: string;
  title: string;
  body: string;
}

export interface CapabilityGridProps {
  heading: string;
  capabilities: Capability[];
}

export const CapabilityGrid: React.FC<CapabilityGridProps> = ({ heading, capabilities }) => (
  <section
    id="capabilities"
    className="home-surface px-[var(--page-pad-x)] py-[clamp(80px,14vh,180px)]"
  >
    <div className="mx-auto w-full max-w-[1400px]">
      <SplitHeading
        as="h2"
        text={heading}
        className="mb-[clamp(48px,8vh,110px)] max-w-[900px] font-display text-[clamp(28px,4.4vw,64px)] uppercase leading-[1.02] tracking-[-0.02em]"
      />

      <div className="grid gap-x-[clamp(20px,2.4vw,40px)] gap-y-[clamp(36px,5vh,64px)] md:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((cap, i) => (
          <Reveal key={cap.index} delay={(i % 3) * 0.08}>
            <article className="home-rule flex h-full flex-col gap-4 border-t pt-7">
              <span className="font-mono text-xs tracking-[0.2em] opacity-45">{cap.index}</span>
              <h3 className="font-display text-[clamp(18px,1.7vw,25px)] uppercase tracking-[-0.01em]">
                {cap.title}
              </h3>
              <p className="text-[clamp(14px,1.05vw,16px)] leading-[1.55] opacity-65">{cap.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default CapabilityGrid;
