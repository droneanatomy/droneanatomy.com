/* Server component. The one claim the page makes before it starts listing
   capabilities. Motion lives entirely in the imported client primitives, so
   this copy is present in the static export. */

import React from 'react';
import { SplitHeading, Reveal } from '@/components/motion';

export interface PositioningStatementProps {
  headline: string;
  sub: string;
}

export const PositioningStatement: React.FC<PositioningStatementProps> = ({ headline, sub }) => (
  <section
    id="positioning"
    className="home-surface flex min-h-svh items-center px-[var(--page-pad-x)] py-[clamp(80px,14vh,180px)]"
  >
    <div className="mx-auto w-full max-w-[1400px]">
      <SplitHeading
        as="h2"
        text={headline}
        className="max-w-[1200px] font-display text-[clamp(34px,6.2vw,92px)] uppercase leading-[0.98] tracking-[-0.02em]"
      />
      <Reveal delay={0.15} className="mt-[clamp(24px,4vh,56px)] max-w-[640px]">
        <p className="text-[clamp(15px,1.35vw,21px)] leading-[1.5] opacity-70">{sub}</p>
      </Reveal>
    </div>
  </section>
);

export default PositioningStatement;
