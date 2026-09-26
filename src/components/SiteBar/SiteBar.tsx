'use client';

/* ============================================================
   SiteBar — the global header.

   The bar that was built into the homepage hero, lifted out and put on
   every route. It carries no background of its own and floats over
   whatever the page paints, so the one thing it has to get right is
   tone: near-black type over a light ground, near-white over a dark one.

   TONE IS NOT A PROPERTY OF THE ROUTE. That was the first attempt and it
   is wrong, because a single page can have both grounds: the homepage is
   a cream hero above a near-black footer, and a bar pinned in ink tone
   measured 1.08:1 against that footer — present in the DOM, invisible on
   screen, which reads to anyone scrolling as "the header is gone".

   So the route only supplies the FIRST guess, for the prerendered HTML
   and the moment before JS runs. After that an IntersectionObserver
   watches a one-pixel band at the bar's own eye-line and asks what is
   crossing it. Any section that paints light marks itself with
   data-chrome="ink" and the bar goes dark while that section is under
   it. Nothing else needs to coordinate.

   This deliberately does NOT reproduce the legacy Header's product and
   news dropdowns; it is four links. Header.tsx is still on disk if any
   of it needs porting back.
   ============================================================ */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './SiteBar.module.css';

export type Tone = 'ink' | 'light';

export interface SiteBarProps {
  /* The tone to start in, before the observer has measured anything.
     Should match whatever the top of the route paints. */
  initialTone?: Tone;
  label?: string;
  links?: { label: string; href: string }[];
}

/* Every href here must resolve. This bar is on every route, so a dead
   link in it is a dead link site-wide.

   'Services' used to sit where 'Updates' now is, pointing at /actions —
   which is an EMPTY directory under src/app with no page.tsx, so it
   404s. There is no services page yet; when there is one, it belongs
   here in place of Updates or alongside it. */
export const SITE_LINKS = [
  { label: 'Drones', href: '/products' },
  { label: 'Updates', href: '/updates' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const SiteBar: React.FC<SiteBarProps> = ({
  initialTone = 'light',
  label = 'Aerial systems, built in India',
  links = SITE_LINKS,
}) => {
  const pathname = usePathname();
  const barRef = useRef<HTMLElement>(null);
  const [tone, setTone] = useState<Tone>(initialTone);

  /* Re-seed on navigation. The observer settles a frame later, and
     without this the bar would carry the previous route's tone across
     the transition — most visibly going from the homepage to a dark
     page, where ink type would flash invisible.

     DURING RENDER, not in an effect, which is React's own pattern for
     "reset state when a prop changes" and is better here than the effect
     it replaces: an effect runs AFTER paint, so the stale tone was being
     shown for a frame — exactly the flash this is meant to prevent. React
     re-runs this component immediately, before touching the DOM. */
  const [seed, setSeed] = useState({ initialTone, pathname });
  if (seed.initialTone !== initialTone || seed.pathname !== pathname) {
    setSeed({ initialTone, pathname });
    setTone(initialTone);
  }

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    /* Count intersections rather than tracking a boolean: light sections
       can overlap or sit flush against each other, and a plain
       "isIntersecting" flag would flicker at every boundary as one
       leaves before the next arrives. */
    const lit = new Set<Element>();
    let io: IntersectionObserver | null = null;

    const build = () => {
      io?.disconnect();
      lit.clear();

      /* A one-pixel band at the bar's eye-line. rootMargin crops the
         viewport down to just that line, so a section counts only while
         it is genuinely behind the bar — not merely somewhere on screen. */
      const eye = Math.round(bar.getBoundingClientRect().height / 2) || 30;
      const below = Math.max(0, window.innerHeight - eye - 1);

      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) lit.add(e.target);
            else lit.delete(e.target);
          }
          setTone(lit.size > 0 ? 'ink' : 'light');
        },
        { rootMargin: `-${eye}px 0px -${below}px 0px`, threshold: 0 }
      );

      document.querySelectorAll('[data-chrome="ink"]').forEach((el) => io!.observe(el));
    };

    build();

    /* The band is computed from the viewport, so it has to be rebuilt
       when that changes. Sections also arrive late on routes that mount
       their hero lazily (the homepage does — ssr:false), so watch the
       DOM for them rather than assuming they exist on first run. */
    const onResize = () => build();
    window.addEventListener('resize', onResize);

    const mo = new MutationObserver(() => build());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io?.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [pathname]);

  return (
    <header ref={barRef} className={`${styles.bar} ${tone === 'ink' ? styles.ink : ''}`}>
      <div className={styles.left}>
        {/* The brand anchor. Without it the bar was a tagline and four
            small links in opposite corners of a very wide page — present,
            measurably legible, and still not reading as a header.

            The asset is WHITE on transparent, drawn for the dark theme,
            so it is invisible on a light ground as-is; .ink inverts it.
            Same approach FieldNav already uses for this logo. */}
        <Link href="/" className={styles.brand} aria-label="DroneAnatomy, home">
          <Image src="/images/logo.png" alt="DroneAnatomy" width={686} height={225} priority />
        </Link>
        <p className={styles.label}>{label}</p>
      </div>
      <nav className={styles.nav} aria-label="Primary">
        {links.map((l) => {
          /* Mark the section, not just the exact page, so /products/p10-pro
             still shows Drones as current. */
          const current = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link key={l.href} href={l.href} aria-current={current ? 'page' : undefined}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
};

export default SiteBar;
