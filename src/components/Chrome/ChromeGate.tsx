'use client';

/* The site's chrome.

   HEADER. FieldNav on every route — the mega menu built against coda.co,
   previously only on /preview/p10. It is viewport-fixed and reads its
   spacing from --pad-y / --chrome-h with fallbacks, so it stands alone
   outside the field hero without changes.

   The one thing it could not do was tone. Closed, it paints entirely in
   cream — white logo, cream section labels, cream burger — because it was
   drawn for the field hero's dark opening frame. That is invisible on the
   homepage's cream sheet. It now takes tone="auto" and asks useChromeTone
   what is actually behind it, reusing the same ink swap it already
   performs when the sheet opens.

   SiteBar is retired but still on disk. It was the four-link bar this
   replaced.

   FOOTER. Not gated. It is one footer on every page, which is the whole
   argument in SiteFooter's own header comment: a site whose ground floor
   changes depending on where you are reads as two sites stitched
   together, at exactly the moment someone is deciding whether to write
   to you. Gating it was how that happened anyway — three different
   footers were in play (SiteFooter, the old Footer, HomeFooter), /
   rendered none at all, and /preview/p10 rendered two stacked. */

import { usePathname } from 'next/navigation';
import { SiteFooter } from '@/components';
import { FieldNav } from '@/components/field/FieldNav';

/* Routes that render their own nav inside their hero, and must not get a
   second one stacked on top. Both pass menu="mega", which mounts FieldNav
   themselves.

   /products/p10-pro is on this list because the field hero was promoted
   into it; it was /preview/p10 until then, and that route no longer
   exists. Miss this and the page renders two navs on top of each other,
   which is exactly what it used to do before this gate existed. */
const OWN_NAV_ROUTES = [
  '/products/p10-pro',
  '/products/mini',
  '/products/noxr-1',
  '/products/cyclops',
];

export function HeaderGate() {
  const pathname = usePathname();
  if (OWN_NAV_ROUTES.includes(pathname)) return null;
  return <FieldNav tone="auto" />;
}

export function FooterGate() {
  return <SiteFooter />;
}
