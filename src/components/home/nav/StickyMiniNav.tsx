'use client';

/* Fades in once the hero is scrolled past. Colours derive from --page-progress
   so the bar stays legible across the light-to-dark transition without needing
   its own ScrollTrigger.

   Rendered OUTSIDE HomeMotionProvider — position:fixed. */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export const StickyMiniNav: React.FC = () => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-[var(--page-pad-x)] py-4 transition-all duration-500 ${
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'
      }`}
      style={{
        background: 'color-mix(in oklab, var(--page-bg) 82%, transparent)',
        color: 'var(--page-fg)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Link href="/" className="font-display text-base uppercase tracking-[0.01em] no-underline">
        DroneAnatomy
      </Link>
      <div className="flex items-center gap-2.5">
        <a
          href="/contact"
          className="rounded-full bg-pill-dark px-5 py-2.5 text-xs uppercase tracking-[0.02em] text-white no-underline"
        >
          Let&rsquo;s talk
        </a>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('da:toggle-menu'))}
          className="rounded-full px-5 py-2.5 text-xs uppercase tracking-[0.02em]"
          style={{ background: 'color-mix(in oklab, var(--page-fg) 12%, transparent)' }}
        >
          Menu &middot;&middot;
        </button>
      </div>
    </div>
  );
};

export default StickyMiniNav;
