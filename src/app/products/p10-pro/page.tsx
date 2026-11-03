import { pageMeta } from '@/app/site';
/* THE P10 PRO PRODUCT PAGE — the scroll-driven field hero, promoted.

   This route used to be the legacy composition: Banner / Slider / Banner /
   Banner / FeatureShowcase / Newsletter, built from the old site's section
   kit. The hero that replaces it lived at /preview/p10 while it was being
   worked out, and is now the page itself; that preview route is gone, so
   there is one P10 Pro URL rather than a real one and a better one.

   FieldHero is not a hero in the usual sense — it is the whole page. It
   composes four acts out of P10_PRO's own data (the pack
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
import { P10Facts } from './P10Facts';
import { P10_FACTS, P10_SPEC, P10_META_DESCRIPTION } from './spec';
import { SITE_URL, SITE_NAME } from '@/app/site';

const URL = `${SITE_URL}/products/p10-pro`;

/* PRODUCT STRUCTURED DATA. Every value is read from spec.ts, so it cannot
   disagree with the visible spec table — unconfirmed (null) rows are left
   out of both. `offers` appears only once a price is set there; until
   then this is valid Product markup but not eligible for Google's price
   snippet, which needs offers, a review or a rating. */
const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: `${P10_FACTS.brand} ${P10_FACTS.name}`,
  description: P10_META_DESCRIPTION,
  category: P10_FACTS.category,
  url: URL,
  image: [`${SITE_URL}/images/og.jpg`, `${SITE_URL}/images/p10pro-spray.png`],
  brand: { '@type': 'Brand', name: SITE_NAME },
  manufacturer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  countryOfOrigin: 'IN',
  additionalProperty: P10_SPEC.flatMap((g) =>
    g.rows
      .filter((r) => r.value)
      .map((r) => ({ '@type': 'PropertyValue', name: r.label, value: r.value })),
  ),
  ...(P10_FACTS.priceInr && {
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: P10_FACTS.priceInr.low,
      highPrice: P10_FACTS.priceInr.high,
      availability: 'https://schema.org/InStock',
      url: URL,
    },
  }),
};

/* The description is built from spec.ts. It used to be hand-written here
   and said "six metres" and "eighteen minutes" while the page said 4–6 m
   and 30 — the first thing a crawler read disagreed with the page. */
export const metadata = pageMeta({
  path: '/products/p10-pro',
  title: 'P10 Pro Agricultural Spraying Drone',
  description: P10_META_DESCRIPTION,
});

/* P10Facts sits UNDER the film, not inside it. The film is the pitch;
   this is the spec sheet and FAQ as plain server-rendered HTML — the only
   part of the page a crawler or an AI assistant can actually read. */
export default function P10ProPage() {
  return (
    <>
      {/* Static data from our own spec.ts; '<' escaped so no value can
          close the script tag early. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema).replace(/</g, '\\u003c'),
        }}
      />
      <FieldHero product={P10_PRO} layout="centred" menu="mega" />
      <P10Facts />
    </>
  );
}
