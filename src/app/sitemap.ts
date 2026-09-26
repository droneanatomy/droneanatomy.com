import type { MetadataRoute } from 'next';
import { ROUTES, SITE_URL } from './site';

/* REQUIRED BY output:'export'. These are route handlers, and Next treats a
   handler as dynamic until told otherwise — with a static export that is a
   build error rather than a fallback, because there is no server to run it
   on. Saying so turns it into a file written once at build. */
export const dynamic = 'force-static';


/* ============================================================
   sitemap.xml, generated at build into out/sitemap.xml.

   lastModified is the BUILD time, not a per-page date. Nothing in this
   project records when a page's content last changed — the git history
   knows, but a static export does not carry it — and a made-up per-page
   date is worse than an honest shared one: it teaches a crawler that the
   dates here mean nothing.
   ============================================================ */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
