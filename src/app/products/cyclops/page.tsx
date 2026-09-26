import { pageMeta } from '@/app/site';
/* THE CYCLOPS PRODUCT PAGE — the sequence, a film, then the model.

   The Mini's arrangement with one step added between its two halves. The
   hero scrubs the aircraft, dissolves into ProductLoop's full-bleed film,
   and the film is then dissolved over by MiniViewer. Everything these three
   render comes from CYCLOPS in product.ts.

   ORDER IS LOAD-BEARING, not only editorial. ProductLoop overlaps the
   section after it by a viewport so the hero's pinned last frame never
   shows between the film and the viewer — see its header. Moving the
   viewer out from directly under it, or dropping the viewer while keeping
   the film, breaks that overlap.

   menu="mega" means FieldHero renders its own FieldNav, so this path has to
   stay in ChromeGate's OWN_NAV_ROUTES or the page gets two navs stacked.

   STANDALONE, like the other field-hero pages: the hero owns the viewport
   and runs its own ScrollTrigger, so it must not sit inside
   HomeMotionProvider, whose ScrollSmoother transform would break every
   fixed layer inside it. */

import { FieldHero } from '@/components/field/FieldHero';
import { MiniViewer } from '@/components/field/MiniViewer';
import { ProductLoop } from '@/components/field/ProductLoop';
import { CYCLOPS } from '@/components/field/product';

/* Factual and short while the copy is placeholder, for the reason given on
   the Noxr page: made-up claims here would be the one unwritten line that
   escaped the page and reached search results. */
export const metadata = pageMeta({
  path: '/products/cyclops',
  title: 'Cyclops',
  description: 'Cyclops — a VTOL airframe from DroneAnatomy.',
});

export default function CyclopsPage() {
  return (
    <>
      <FieldHero product={CYCLOPS} layout="centred" menu="mega" />
      {CYCLOPS.loop && <ProductLoop name={CYCLOPS.name} loop={CYCLOPS.loop} />}
      {CYCLOPS.viewer && <MiniViewer name={CYCLOPS.name} viewer={CYCLOPS.viewer} />}
    </>
  );
}
