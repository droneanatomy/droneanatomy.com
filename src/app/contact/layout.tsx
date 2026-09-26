import { pageMeta } from '@/app/site';

/* ============================================================
   WHY THIS FILE EXISTS. contact/page.tsx is a 'use client' component — it
   holds the form's useState — and a client component cannot export
   `metadata`; Next only reads that export from the server graph. Without
   this the page inherited the layout's default title, so /contact and
   /careers were both titled "DroneAnatomy — autonomous systems…" and both
   canonicalised to the homepage.

   A layout is the conventional answer: it is a server component by
   default, it wraps exactly this one route, and it renders its children
   untouched, so it adds a metadata slot and no markup.
   ============================================================ */
export const metadata = pageMeta({
  path: '/contact',
  title: 'Contact',
  /* The four topics the form itself offers, so the description and the
     page cannot drift apart. */
  description:
    'Contact DroneAnatomy — product enquiries, technical support, partnerships and careers.',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
