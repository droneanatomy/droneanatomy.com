/* THE P10 PRO PRODUCT PAGE — the scroll-driven field hero, promoted.

   This route used to be the legacy composition: Banner / Slider / Banner /
   Banner / FeatureShowcase / Newsletter, built from the old site's section
   kit. The hero that replaces it lived at /preview/p10 while it was being
   worked out, and is now the page itself; that preview route is gone, so
   there is one P10 Pro URL rather than a real one and a better one.

   FieldHero is not a hero in the usual sense — it is the whole page. It
   composes four acts out of P10_PRO's own data (the eighteen-minute pack
   swap, the eleven-part teardown, the ten-litre payload, the close) and
   ends on its own call to action, so there is nothing left for the legacy
   sections to add underneath. Stacking them below it would also put two
   different design languages on one page, which is the exact failure the
   footer gate's comment argues against.

   THE OLD PAGE IS NOT LOST. It is committed at e6aff0f and comes back with
   `git show e6aff0f:src/app/products/p10-pro/page.tsx` — worth knowing,
   because it carries copy and spec figures that have no home anywhere else
   yet: the 5 L/min flow rate, the night-flying LED section, and the
   GPS-assisted-navigation and 4-6 m spray-width numbers. If any of those
   need to survive, they belong in P10_PRO's act data rather than in a
   second page bolted underneath this one.

   STANDALONE, and that is load-bearing. It owns the viewport and runs its
   own ScrollTrigger, so it must not be mounted inside HomeMotionProvider,
   whose ScrollSmoother transform would break every fixed layer in here.
   The app has exactly one layout and it does not wrap children in that
   provider, which is why this route can take the component unchanged.

   menu="mega" means it renders its own header, so ChromeGate has to keep
   this path in OWN_NAV_ROUTES or the page gets two navs stacked. */

import { FieldHero } from '@/components/field/FieldHero';
import { P10_PRO } from '@/components/field/product';

export const metadata = {
  title: 'P10 Pro | DroneAnatomy',
  description:
    'P10 Pro — an ultra-compact agricultural drone engineered for Indian farming conditions. Ten litres over six metres of swath, eighteen minutes on four packs, eleven parts one driver.',
};

export default function P10ProPage() {
  return <FieldHero product={P10_PRO} layout="centred" menu="mega" />;
}
