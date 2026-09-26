import type { MetadataRoute } from 'next';
import { SITE_URL } from './site';

/* REQUIRED BY output:'export'. These are route handlers, and Next treats a
   handler as dynamic until told otherwise — with a static export that is a
   build error rather than a fallback, because there is no server to run it
   on. Saying so turns it into a file written once at build. */
export const dynamic = 'force-static';


/* ============================================================
   robots.txt, generated at build into out/robots.txt.

   EVERYTHING IS ALLOWED, which is the honest setting now: the routes
   that should not have been indexed — the four /preview staging pages,
   /launches and three unfinished product pages — are deleted rather than
   hidden. A Disallow is a request, not a control; anything that must not
   be public should not be built.

   The sitemap line is the only reliable way to tell a crawler where the
   sitemap is without submitting it by hand, and it has to be absolute.
   ============================================================ */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
