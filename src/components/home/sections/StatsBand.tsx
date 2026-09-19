/* Server component. Carries id="stats-band", which HomeMotionProvider uses as
   the trigger for the light-to-dark arc — the page darkens while these are
   still on screen. */

import React from 'react';
import { Reveal } from '@/components/motion';
import { HomeCounter } from '../HomeCounter';

export interface HomeStat {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}

export interface StatsBandProps {
  stats: HomeStat[];
}

export const StatsBand: React.FC<StatsBandProps> = ({ stats }) => (
  <section
    id="stats-band"
    className="home-surface px-[var(--page-pad-x)] py-[clamp(80px,14vh,160px)]"
  >
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-x-8 gap-y-[clamp(40px,6vh,72px)] lg:grid-cols-4">
      {stats.map((stat, i) => (
        <Reveal key={stat.label} delay={i * 0.08}>
          <HomeCounter {...stat} />
        </Reveal>
      ))}
    </div>
  </section>
);

export default StatsBand;
