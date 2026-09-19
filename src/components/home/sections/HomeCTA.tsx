import React from 'react';
import { SplitHeading } from '@/components/motion';

export interface HomeCTAProps {
  headline: string;
  href?: string;
  label?: string;
}

export const HomeCTA: React.FC<HomeCTAProps> = ({
  headline,
  href = '/contact',
  label = "Let's talk",
}) => (
  <section className="home-surface px-[var(--page-pad-x)] py-[clamp(90px,18vh,220px)]">
    <div className="mx-auto w-full max-w-[1400px]">
      <SplitHeading
        as="h2"
        text={headline}
        className="max-w-[1100px] font-display text-[clamp(32px,5.6vw,86px)] uppercase leading-[0.98] tracking-[-0.02em]"
      />
      <a
        href={href}
        className="mt-[clamp(32px,5vh,64px)] inline-flex items-center gap-2.5 rounded-full bg-pill-dark px-8 py-4 text-sm uppercase tracking-[0.02em] text-white no-underline transition-transform duration-300 hover:-translate-y-0.5"
      >
        {label}
        <i className="h-1.5 w-1.5 rounded-full bg-flare" />
      </a>
    </div>
  </section>
);

export default HomeCTA;
