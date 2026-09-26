import type { Metadata } from 'next';

/* ============================================================
   site — the facts about this deployment that more than one file needs.

   ONE LIST OF ROUTES, because three things need it and they must not
   drift: the sitemap, robots, and anyone adding a page. A sitemap that
   quietly stops matching the site is worse than no sitemap — it tells a
   crawler the missing pages do not exist.

   THE ROUTES ARE WRITTEN OUT rather than read from the filesystem. This
   is a static export: the build has a filesystem, so a scan would work,
   but it would also happily publish anything that happened to be in
   src/app — which is how the preview pages and three unfinished product
   pages would have ended up in a sitemap. Listing them is the review
   step. Add a page, add it here.
   ============================================================ */

/* No trailing slash: everything below joins onto it. Override with
   NEXT_PUBLIC_SITE_URL for a preview deployment, so canonicals and OG
   urls point at the deployment being looked at rather than production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://droneanatomy.com').replace(/\/$/, '');

export const SITE_NAME = 'DroneAnatomy';

/* `priority` is a hint and search engines are free to ignore it; it is
   set here only so the four product pages and the homepage are not
   ranked alongside the privacy policy. `changeFrequency` is the same
   kind of hint — updates moves, the privacy policy does not. */
export const ROUTES: readonly {
  path: string;
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
}[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/products', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/products/p10-pro', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/products/cyclops', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/products/noxr-1', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/products/mini', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/careers', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/updates', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
];

/* 1200x630 is what every card reader crops to, so it is what is stored —
   a larger image is only bandwidth, and a smaller one is upscaled. */
export const OG_IMAGE = {
  url: '/images/og.jpg',
  width: 1200,
  height: 630,
  alt: 'A DroneAnatomy P10 Pro spraying a field at low level',
};

/* ============================================================
   pageMeta — one page's metadata, built whole.

   WHY A HELPER AND NOT FOUR FIELDS PER PAGE. Next merges metadata from
   the layout down SHALLOWLY, and that is sharper than it sounds: a page
   that sets `openGraph: { title }` does not add a title to the layout's
   openGraph, it REPLACES the object — losing og:image, og:site_name and
   og:locale with it. So every page that wants its own og:title has to
   restate all of it, and nine pages restating the same five fields is
   nine chances for them to disagree.

   WHAT THIS FIXES. Before it, every page inherited `canonical: '/'` from
   the layout, so all eleven told a crawler they were duplicates of the
   homepage and should be dropped in its favour — a sitemap listing pages
   whose own tags disown them. Titles had the same problem from the other
   end: each page hand-wrote "| DroneAnatomy", so the layout's template
   made it "About | DroneAnatomy | DroneAnatomy".

   The og:image stays site-wide on purpose. A per-product card would be
   better and is worth doing once there are four finished renders; one
   correct image beats four placeholders.
   ============================================================ */
export function pageMeta({
  path,
  title,
  description,
  /* Use `title` exactly, with no "| DroneAnatomy" appended — for the
     homepage, whose title already names the company. */
  absoluteTitle = false,
}: {
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
}): Metadata {
  /* The drift guard. This file's whole premise is that ROUTES is the one
     list, so a page metadata'd but not listed is a page missing from the
     sitemap — the exact failure the comment at the top warns about. Fail
     the build rather than ship a sitemap that is quietly short. */
  if (!ROUTES.some((r) => r.path === path)) {
    throw new Error(
      `pageMeta: "${path}" is not in ROUTES (src/app/site.ts). Add it there so it reaches the sitemap, or correct the path.`,
    );
  }

  const full = absoluteTitle ? title : `${title} | ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_IN',
      url: path,
      title: full,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: full,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
