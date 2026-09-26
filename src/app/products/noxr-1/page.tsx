/* THE NOXR PRODUCT PAGE — act one, then the model itself.

   The same arrangement as /products/mini, and that is the point of it being
   the second one: FieldHero and MiniViewer are handed a ProductPage and
   render it, so a new product is data plus a route rather than a fork. If
   this file ever needs to differ from mini/page.tsx by more than the
   constant it imports, something has leaked out of product.ts that belongs
   in it.

   WHAT REPLACED WHAT. This route used to be a ComingSoonBanner with a
   newsletter block and four icon cards — a placeholder for a product with
   no render and no model. It has both now. The path is unchanged on
   purpose: the overlay menu, FieldNav's Defence group and the products
   listing all already point here, and moving the URL to match a shorter
   name would have broken three working links to fix a cosmetic one.

   menu="mega" means FieldHero renders its own FieldNav, so this path has to
   stay in ChromeGate's OWN_NAV_ROUTES or the page gets two navs stacked —
   the fault that list exists to prevent.

   STANDALONE, for the same reason the Mini and the P10 Pro are: the hero
   owns the viewport and runs its own ScrollTrigger, so it must not be
   wrapped in HomeMotionProvider, whose ScrollSmoother transform would break
   every fixed layer inside it. */

import { FieldHero } from '@/components/field/FieldHero';
import { MiniViewer } from '@/components/field/MiniViewer';
import { NOXR } from '@/components/field/product';

export const metadata = {
  /* Deliberately factual and short while the page's copy is still
     placeholder. A description that made claims here would be the one piece
     of unwritten copy that escaped the page and reached search results. */
  title: 'Noxr | DroneAnatomy',
  description: 'Noxr — an airframe from DroneAnatomy.',
};

export default function NoxrPage() {
  return (
    <>
      <FieldHero product={NOXR} layout="centred" menu="mega" />
      {/* Guarded rather than asserted: `viewer` is optional on ProductPage
          for the same reason the acts are, and a page that has not declared
          one should simply not mount it. */}
      {NOXR.viewer && <MiniViewer name={NOXR.name} viewer={NOXR.viewer} />}
    </>
  );
}
