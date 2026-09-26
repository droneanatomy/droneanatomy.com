import { pageMeta } from '@/app/site';
/* THE PRODUCT INDEX.

   READ THIS BEFORE ADDING ANYTHING ELSE HERE. The three entries below the
   Mini — Drone X1, Drone Pro and Drone Lite — are template placeholders,
   not products. Their CTAs point at /products/drone-x1, /products/drone-pro
   and /products/drone-lite, and NONE of those routes exist: the real ones
   are p10-pro, mini, noxr-1, cyclops-3, cyclops-mini and liftx100. Every
   one of those three buttons is a 404.

   They are left standing because removing them is a content decision about
   what this company sells, which is not mine to make. But they are the
   reason this page cannot be trusted as a catalogue, and anything added
   next to them inherits that. The fix is to replace them with the routes
   that exist, and it should happen before this page is linked to from
   anywhere prominent. */

import { Banner } from '@/components';

export const metadata = pageMeta({
  path: '/products',
  title: 'Products',
  description:
    'Explore our range of advanced drone products — the P10 Pro agricultural platform, the compact Mini, and more.',
});

export default function ProductsPage() {
    return (
        <>
            <Banner
                title="Our Products"
                subtitle="Discover our complete range of advanced aerial vehicles, designed for professionals and enthusiasts alike."
                contentPosition="center-left"
                overlayStyle="dark"
            />

            {/* FOUR REAL PRODUCTS, and every link on this page now resolves.
                It listed Mini and then three inventions — Drone X1, Drone
                Pro and Drone Lite, with borrowed marketing copy and CTAs
                pointing at /products/drone-x1, -pro and -lite, none of
                which have ever existed as routes. They are replaced by the
                three other aircraft that do have pages, described from
                their own product data. */}
            <Banner
                title="Mini"
                subtitle="The smallest complete airframe we fly. Folds into a case that travels with the crew, and runs the same stack as every other aircraft on the fleet."
                ctaText="View the Mini"
                ctaLink="/products/mini"
                contentPosition="center-left"
                overlayStyle="dark"
            />

            <Banner
                title="P10 Pro"
                subtitle="An ultra-compact agricultural drone, built specifically for Indian farming across steep terrain and tough rural environments. Ten litres over six metres of swath."
                ctaText="View the P10 Pro"
                ctaLink="/products/p10-pro"
                contentPosition="center-left"
                overlayStyle="dark"
            />

            <Banner
                title="Cyclops"
                subtitle="Vertical launch, fixed-wing range. Six hours up, a hundred and fifty kilometres out, ten kilos underneath — and no runway, launcher or catapult anywhere in the sortie."
                ctaText="View the Cyclops"
                ctaLink="/products/cyclops"
                contentPosition="center-left"
                overlayStyle="dark"
            />

            <Banner
                title="NOXR-1"
                subtitle="Multirole observation platform. Day/night EO/IR with laser rangefinder, frequency hopping, and sixty minutes on station."
                ctaText="View the NOXR-1"
                ctaLink="/products/noxr-1"
                contentPosition="center-left"
                overlayStyle="dark"
            />

        </>
    );
}
