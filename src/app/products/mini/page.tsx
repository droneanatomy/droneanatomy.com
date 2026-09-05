/* THE MINI PRODUCT PAGE — act one, then the model itself.

   Composed from the same FieldHero as /products/p10-pro, but MINI declares
   only the hero act (see product.ts), so the timeline runs the grass, the
   void, the rendered sequence, the statement and the coda and then ends.
   Where P10 Pro continues into the gallery, the bench and the closing
   card, this dissolves into MiniViewer and hands the aircraft over.

   THE ORDER IS THE POINT. The hero argues and the viewer answers: a scrub
   gives the reader one verb, and the page owes them a second one before it
   asks for anything. Everything after MiniViewer is the site's, not this
   page's — the footer is mounted once in the root layout by FooterGate and
   scrolls up over both, exactly as it already does over the hero alone.

   menu="mega" means FieldHero renders its own FieldNav, so this path has
   to stay in ChromeGate's OWN_NAV_ROUTES or the page gets two navs stacked
   — the fault that list exists to prevent.

   STANDALONE, and load-bearing for the same reason /products/p10-pro is:
   the hero owns the viewport and runs its own ScrollTrigger, so it must
   not be wrapped in HomeMotionProvider, whose ScrollSmoother transform
   would break every fixed layer inside it. The app's one layout does not
   wrap children in that provider, which is why this route can take the
   component unchanged. */

import { FieldHero } from '@/components/field/FieldHero';
import { MiniViewer } from '@/components/field/MiniViewer';
import { MINI } from '@/components/field/product';

export const metadata = {
  title: 'Mini | DroneAnatomy',
  description:
    'Mini — the smallest complete airframe we fly. Folds into a case that travels with the crew, and runs the same stack as every other aircraft on the fleet.',
};

export default function MiniPage() {
  return (
    <>
      <FieldHero product={MINI} layout="centred" menu="mega" />
      {/* Guarded rather than asserted: `viewer` is optional on ProductPage
          for the same reason the acts are, and a page that has not declared
          one should simply not mount it. */}
      {MINI.viewer && <MiniViewer name={MINI.name} viewer={MINI.viewer} />}
    </>
  );
}
