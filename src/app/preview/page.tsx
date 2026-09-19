/* PREVIEW ROUTE — the redesigned homepage, at /preview.
   The live homepage at / is untouched while this is being judged. */

import { LazyHeroCluster } from '@/components/HeroCluster/LazyHeroCluster';
import { HomeMotionProvider } from '@/components/home/HomeMotionProvider';
import { PositioningStatement } from '@/components/home/sections/PositioningStatement';
import { StatsBand, type HomeStat } from '@/components/home/sections/StatsBand';
import { CapabilityGrid, type Capability } from '@/components/home/sections/CapabilityGrid';
import { ProductRow, type ProductCard } from '@/components/home/sections/ProductRow';
import { HomeCTA } from '@/components/home/sections/HomeCTA';
import { OverlayMenu } from '@/components/home/nav/OverlayMenu';
import { StickyMiniNav } from '@/components/home/nav/StickyMiniNav';
import { FluidCursor } from '@/components/motion/fluid/FluidCursor';

export const metadata = {
  title: 'DroneAnatomy — Preview',
  description: 'Redesign preview.',
};

/* PLACEHOLDER — real figures required before this goes live. */
const STATS: HomeStat[] = [
  { value: 12, label: 'Systems in field', suffix: '+' },
  { value: 4200, label: 'Flight hours logged', suffix: '+' },
  { value: 98, label: 'Mission success rate', suffix: '%' },
  { value: 5, label: 'Platforms in production' },
];

/* PLACEHOLDER — these make specific technical claims that must be verified
   as true before publication. */
const CAPABILITIES: Capability[] = [
  {
    index: '01',
    title: 'Autonomous navigation',
    body: 'GNSS-denied flight with onboard state estimation, so missions continue when the signal does not.',
  },
  {
    index: '02',
    title: 'EO/IR sensing',
    body: 'Day and thermal imaging on a single gimbal, with operator-selectable palettes and onboard capture.',
  },
  {
    index: '03',
    title: 'Extended endurance',
    body: 'Airframes and power systems designed around loiter time rather than peak speed.',
  },
  {
    index: '04',
    title: 'Ruggedised airframes',
    body: 'Field-serviceable structures rated for high-altitude and high-wind operation.',
  },
  {
    index: '05',
    title: 'Secure datalink',
    body: 'Encrypted command and telemetry with graceful degradation and autonomous return-to-home.',
  },
  {
    index: '06',
    title: 'Indigenous manufacture',
    body: 'Designed and built in India, reducing supply-chain dependency and export exposure.',
  },
];

const PRODUCTS: ProductCard[] = [
  { label: 'P10 Pro', href: '/products/p10-pro', image: '/images/liftx100.jpg', blurb: 'Long-endurance survey and inspection platform.' },
  { label: 'NOXR-1', href: '/products/noxr-1', image: '/images/NOXR-COMING-SOON.jpg', blurb: 'Autonomous system for contested and GNSS-denied airspace.' },
  { label: 'Cyclops 3', href: '/products/cyclops-3', image: '/images/CYCLOPS3.jpg', blurb: 'EO/IR observation platform for persistent surveillance.' },
  { label: 'Cyclops Mini', href: '/products/cyclops-mini', image: '/images/CYCLOPS.jpg', blurb: 'Compact short-range reconnaissance airframe.' },
  { label: 'LiftX100', href: '/products/liftx100', image: '/images/liftx100.jpg', blurb: 'Heavy-lift platform for payload and logistics missions.' },
];

export default function Preview() {
  return (
    <>
      {/* position:fixed — must stay outside the smoother */}
      <FluidCursor />
      <StickyMiniNav />
      <OverlayMenu />

      <HomeMotionProvider>
        <div className="home">
          <LazyHeroCluster
            wordmark="DroneAnatomy"
            tagline="We build the autonomous systems that define the next era of flight."
            imageSrc="/images/terrain-day.webp"
            thermalSrc="/images/terrain-thermal.webp"
          />

          <PositioningStatement
            headline="Outcomes, not specifications."
            sub="We design from failure to prevention to reliability, building the systems that make autonomous aviation dependable at scale."
          />

          <StatsBand stats={STATS} />

          <CapabilityGrid heading="What our systems do" capabilities={CAPABILITIES} />

          <ProductRow heading="Platforms" products={PRODUCTS} />

          <HomeCTA headline="Tell us what you need to fly." />

        </div>
      </HomeMotionProvider>
    </>
  );
}
