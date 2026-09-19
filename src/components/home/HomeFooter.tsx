/* The homepage's own footer. The shared Footer stays suppressed on this route
   via ChromeGate and is not restyled.

   Built in the big-type studio idiom: mono column labels over a hairline rule,
   a meta row, and an oversized wordmark bled to the bottom edge. Everything is
   sized from the page's own tokens (--page-pad-*, font-display, the theme arc)
   rather than transplanted values, so it moves with the rest of the site. */

import React from 'react';
import Link from 'next/link';
import { PRODUCT_LINKS, COMPANY_LINKS } from '@/lib/nav';

interface FooterColumn {
  label: string;
  links: { label: string; href: string }[];
}

const COLUMNS: FooterColumn[] = [
  { label: 'Platforms', links: PRODUCT_LINKS },
  { label: 'Company', links: COMPANY_LINKS },
  {
    label: 'Connect',
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
      { label: 'Instagram', href: 'https://www.instagram.com/' },
      { label: 'YouTube', href: 'https://www.youtube.com/' },
    ],
  },
];

const YEAR = 2026;

export const HomeFooter: React.FC = () => (
  <footer className="home-surface relative overflow-hidden px-[var(--page-pad-x)] pt-[clamp(60px,10vh,120px)]">
    {/* Contact line — the one thing the footer should make easy. */}
    <div className="home-rule border-t pt-[clamp(28px,4vh,48px)]">
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">
            Get in touch
          </span>
          <Link
            href="/contact"
            className="mt-4 block font-display text-[clamp(28px,4.2vw,58px)] uppercase leading-[1.02] tracking-[-0.02em] no-underline transition-opacity hover:opacity-60"
          >
            droneanatomy@gmail.com
          </Link>
        </div>

        <address className="not-italic text-[clamp(13px,1vw,15px)] leading-[1.6] opacity-55">
          Designed and manufactured
          <br />
          in India
        </address>
      </div>
    </div>

    {/* Link columns */}
    <nav
      aria-label="Footer"
      className="mt-[clamp(56px,9vh,110px)] grid gap-x-[clamp(24px,3vw,64px)] gap-y-[clamp(36px,5vh,56px)] sm:grid-cols-2 lg:grid-cols-3"
    >
      {COLUMNS.map((col) => (
        <div key={col.label} className="home-rule border-t pt-6">
          <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">
            {col.label}
          </h2>
          <ul className="flex flex-col gap-3">
            {col.links.map((l) => {
              const external = l.href.startsWith('http');
              const cls =
                'inline-block text-[clamp(15px,1.25vw,19px)] no-underline opacity-80 transition-opacity hover:opacity-100';
              return (
                <li key={l.href}>
                  {external ? (
                    <a href={l.href} target="_blank" rel="noreferrer noopener" className={cls}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={cls}>
                      {l.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>

    {/* Meta row */}
    <div className="home-rule mt-[clamp(56px,9vh,110px)] flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t py-6 font-mono text-[11px] uppercase tracking-[0.16em] opacity-45">
      <span>&copy; {YEAR} DroneAnatomy</span>
      <Link href="/privacy" className="no-underline transition-opacity hover:opacity-100">
        Privacy
      </Link>
    </div>

    {/* Oversized wordmark, bled to the bottom edge. Sized in vw so it always
        spans the gutters; clipped by the footer's overflow-hidden. */}
    <div aria-hidden="true" className="select-none pt-[clamp(16px,3vh,40px)]">
      <span className="block font-display text-[13.4vw] uppercase leading-[0.78] tracking-[-0.045em] opacity-[0.09]">
        DroneAnatomy
      </span>
    </div>
  </footer>
);

export default HomeFooter;
