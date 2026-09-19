'use client';

/* Full-screen navigation. Rendered OUTSIDE HomeMotionProvider because it is
   position:fixed — ScrollSmoother's transform on #smooth-content would
   otherwise anchor it to the content rather than the viewport. */

import React, { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/components/motion/gsap-setup';
import { PRODUCT_LINKS, COMPANY_LINKS } from '@/lib/nav';

export const OverlayMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* The trigger lives in the hero, a server component, so they communicate via
     a custom event rather than shared React state. */
  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener('da:toggle-menu', onToggle);
    return () => window.removeEventListener('da:toggle-menu', onToggle);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  useGSAP(
    () => {
      if (!open) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-menu-link]', {
          opacity: 0,
          yPercent: 60,
          duration: 0.65,
          ease: 'power3.out',
          stagger: 0.045,
        });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [open] }
  );

  const linkClass =
    'block font-display text-[clamp(26px,3.6vw,52px)] uppercase leading-[1.05] no-underline opacity-85 transition-opacity hover:opacity-100';

  return (
    <div
      ref={ref}
      aria-hidden={!open}
      className={`fixed inset-0 z-50 bg-card text-white transition-opacity duration-500 ${
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="flex h-full flex-col px-[var(--page-pad-x)] py-[var(--page-pad-y)]">
        <div className="flex items-center justify-between">
          <span className="font-display text-[clamp(19px,1.8vw,26px)] uppercase">DroneAnatomy</span>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full bg-white/10 px-6 py-3.5 text-sm uppercase tracking-[0.02em] transition-colors hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <div className="mt-auto grid gap-[clamp(32px,6vh,64px)] md:grid-cols-2">
          <nav aria-label="Products">
            <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">Products</h2>
            <ul className="flex flex-col gap-3">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href} className="overflow-hidden">
                  <a data-menu-link href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] opacity-45">Company</h2>
            <ul className="flex flex-col gap-3">
              {COMPANY_LINKS.map((l) => (
                <li key={l.href} className="overflow-hidden">
                  <a data-menu-link href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default OverlayMenu;
