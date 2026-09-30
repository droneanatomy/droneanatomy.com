'use client';

/* ============================================================
   The mobile page, below the hero.

   On a wide screen acts two and three are scroll-CHOREOGRAPHED: fixed
   layers, a scrubbed timeline, a carousel that travels sideways as the
   reader scrolls down. That is the whole idea of the page and it works
   there, because a wide screen has room for a strip to be a strip and the
   sideways move reads as deliberate.

   On a phone it does not. Scrolling down while content moves sideways is an
   axis mismatch, and the fix is not a gentler version of the same move — I
   tried cross-fading the cards in place and it is still a carousel driven
   by scroll, still fighting the thumb, just quieter about it.

   So on mobile these stop being a timeline and become a PAGE: ordinary
   sections in normal document flow, scrolled natively, with scroll-snap so
   each picture comes to rest. No GSAP, no fixed layers, no progress scalar.
   The hero keeps its scrubbed sequence — that one earns the complexity and
   reads correctly at any width — and everything under it is just content.

   Snap is `proximity`, not `mandatory`. The hero's spacer sits directly
   above these and has no snap points of its own; mandatory would fight the
   scrub every time the reader crossed the boundary, dragging them into the
   first panel mid-animation. Proximity settles a panel that is nearly in
   place and leaves the hero alone.
   ============================================================ */

import Image from 'next/image';
import React, { useEffect, useRef } from 'react';
import type { ProductPage } from './product';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

/* Each panel is one screen, minus a sliver so the next one peeks and the
   reader can see there is more. dvh rather than vh: this IS ordinary
   scrolling, so the address bar collapsing should reflow it — the opposite
   of the hero's spacer, where a reflow mid-scrub would jump the timeline. */
const PANEL = 'h-[86dvh] w-full snap-start';

export const FieldGalleryMobile: React.FC<{
  items: NonNullable<ProductPage['gallery']>;
}> = ({
  items,
}) => (
  <section aria-label="Gallery" className="relative w-full">
    {items.map((it, i) => (
      /* Same panel shape as the bench: media block on top, words beneath.
      
         The caption used to sit ON the photograph under a gradient, which is
         the conventional gallery treatment and the wrong one HERE — the two
         sections are adjacent on mobile and reading one as
         picture-with-overlay and the next as picture-then-text makes them
         look like they came from different pages. Consistency between the
         two beats the convention.
      
         It also removes a real problem: an overlaid caption has to be legible
         against whatever the photograph happens to be doing in its bottom
         third, which is why it needed the gradient. Below the image it is
         legible by construction, and these photographs are placeholders that
         will be replaced by ones nobody has graded for text yet. */
      <figure key={`${it.src}-${i}`} className={`${PANEL} relative m-0 flex flex-col`}>
        <div className="relative h-[52%] w-full overflow-hidden">
          <Image
            src={it.src}
            alt={it.alt}
            fill
            sizes="100vw"
            className="object-cover"
            /* Only the first is eager. The rest are a screen or more away and
               loading them all up front on cellular is the thing the tiered
               sequence builds were about. */
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </div>
        <figcaption className="flex flex-1 flex-col justify-center px-[var(--pad-x,5vw)] py-[clamp(20px,6vw,36px)]">
          <span className="font-display text-[clamp(10px,2.9vw,13px)] font-bold uppercase tracking-[0.12em] opacity-70">
            {String(i + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <span className="mt-[clamp(8px,2.4vw,14px)] font-display text-[clamp(20px,6vw,34px)] uppercase leading-[1.05] tracking-[-0.02em]">
            {it.alt}
          </span>
        </figcaption>
      </figure>
    ))}
  </section>
);

export const FieldBenchMobile: React.FC<{
  bench: NonNullable<ProductPage['bench']>;
}> = ({
  bench,
}) => {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  /* Plays the panel you are looking at, pauses the rest.

     Not `autoplay` on the element. That starts every clip the moment the
     page loads — three 1080p streams decoding at once, on a phone, for
     panels the reader is several screens away from — which is the same
     payload mistake the tiered sequence builds exist to avoid. An observer
     ties playback to attention instead: one stream at a time, and none at
     all until the section is reached.

     PAUSED, never reset. Scrolling back to a panel resumes it where it was;
     unloading or seeking to zero would make every reversal restart the clip,
     which reads as the page forgetting itself.

     The test is intersectionRatio, NOT isIntersecting.

     They are not the same thing and the difference is the whole bug I shipped
     first: `isIntersecting` is true when ANY part of the element overlaps the
     viewport, whatever the threshold says. The threshold only decides when
     the callback FIRES, never what it reports. So gating on isIntersecting
     played every clip that had a single pixel on screen — measured as two
     streams running at once, and all of them still running after scrolling
     away entirely, because the last crossing had reported "intersecting" on
     the way out.

     Thresholds at both ends: without a 0 entry the observer never fires as
     an element leaves completely, so the pause can be missed outright. */
  useEffect(() => {
    const vids = videoRefs.current.filter(Boolean) as HTMLVideoElement[];
    if (!vids.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.intersectionRatio >= 0.55) {
            /* play() rejects if the autoplay policy is unhappy — a poster
               is a fine outcome, so swallow it rather than throwing on
               every scroll. */
            void v.play().catch(() => {});
          } else if (!v.paused) {
            v.pause();
          }
        }
      },
      { threshold: [0, 0.55, 0.9] }
    );
    for (const v of vids) io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
  <section aria-label="Detail" className="relative w-full">
    {bench.panels.map((panel, i) => {
      /* Paired BY INDEX with the panels, the same rule the desktop bench
         follows — the keys are there to make a mismatch visible, not to
         look up by. */
      const plate = bench.plates[i];
      return (
        <article key={panel.key} className={`${PANEL} relative flex flex-col`}>
          <div className="relative h-[52%] w-full overflow-hidden">
            {plate?.video ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={plate.video}
                poster={plate.src}
                muted
                loop
                playsInline
                /* metadata, not none: the observer calls play() the moment
                   the panel is half on screen, and a clip that has not even
                   read its header yet shows a poster for a beat first. This
                   fetches enough to start without pulling the whole file. */
                preload="metadata"
                aria-label={plate.alt}
                className="size-full object-cover"
              />
            ) : plate ? (
              <Image src={plate.src} alt={plate.alt} fill sizes="100vw" className="object-cover" loading="lazy" />
            ) : null}
          </div>

          <div className="flex flex-1 flex-col justify-center px-[var(--pad-x,5vw)] py-[clamp(20px,6vw,36px)]">
            <p className="font-display text-[clamp(10px,2.9vw,13px)] font-bold uppercase tracking-[0.12em] opacity-70">
              <span aria-hidden className="mr-2">{panel.icon}</span>
              {panel.kicker}
            </p>
            <h3 className="mt-[clamp(8px,2.4vw,14px)] font-display text-[clamp(24px,7.4vw,40px)] uppercase leading-[1.02] tracking-[-0.02em]">
              {panel.title[0]}
              <br />
              {panel.title[1]}
            </h3>
            <hr className="my-[clamp(14px,4vw,22px)] border-0 border-t border-dashed border-[#f2ecd9]/30" />
            <p className="text-[clamp(13px,3.6vw,16px)] leading-[1.5] opacity-80">
              {/* Joined, not line-broken. The desktop panel reveals each
                  line separately so the array IS its line breaking; here
                  nothing animates and honouring those breaks would give a
                  ragged column at a width they were never measured for. */}
              {panel.desc.join(' ')}
            </p>
          </div>
        </article>
      );
    })}

    {/* The footnote that sat here is gone with the one on the desktop
        bench — ProductPage.bench no longer carries the field. This file is
        retired and unimported; it is kept compiling so that a type change
        still tells the truth about it rather than rotting quietly. */}
  </section>
  );
};

export const FieldClosingMobile: React.FC<{
  closing: NonNullable<ProductPage['closing']>;
}> = ({
  closing,
}) => (
  <section
    aria-label="Contact"
    className="flex min-h-[70dvh] w-full snap-start flex-col justify-center px-[var(--pad-x,5vw)] py-[clamp(48px,14vw,96px)] text-center"
  >
    <p className="font-display text-[clamp(10px,2.9vw,13px)] font-bold uppercase tracking-[0.14em] opacity-70">
      {closing.kicker}
    </p>
    <h2 className="mt-[clamp(12px,3.4vw,20px)] font-display text-[clamp(30px,9vw,52px)] uppercase leading-[0.98] tracking-[-0.03em]">
      {closing.headline}
    </h2>
    <p className="mx-auto mt-[clamp(14px,4vw,24px)] max-w-[42ch] text-[clamp(13px,3.6vw,17px)] leading-[1.5] opacity-75">
      {closing.body}
    </p>
    <div className="mt-[clamp(24px,7vw,40px)] flex flex-wrap items-center justify-center gap-3">
      <span className="rounded-[3px] border border-dashed border-[#f2ecd9]/40 px-5 py-3 font-display text-[clamp(10px,2.7vw,13px)] font-bold uppercase tracking-[0.12em]">
        {closing.label}
      </span>
      {/* Was a near-copy of the desktop closing CTA with its own padding
          and its own type scale. One component now, which is also how it
          picks up the 44px tap target it did not have. */}
      <PrimaryButton href={closing.cta.href}>{closing.cta.label}</PrimaryButton>
    </div>
  </section>
);
