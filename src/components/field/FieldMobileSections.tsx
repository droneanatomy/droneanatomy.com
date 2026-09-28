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
import React from 'react';
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
  /* NO VIDEO HERE, AND NO PLAYBACK MACHINERY EITHER.

     This component only ever renders below 768px — FieldHero drops the
     bench from the scrubbed acts on a phone and it becomes an ordinary
     section — so what this branch chooses is what every phone downloads.
     It was choosing three clips: 16.73 MB against 2.01 MB of stills the
     plates already carry, and 15.08 MB of that is p10-spray.mp4 alone.

     The stills are not a fallback bolted on for this. BenchPlate.src is
     required precisely because it doubles as the video's poster, so every
     plate already had the picture; the video branch was simply loading a
     film on top of a photograph the reader had already been shown.

     The observer that used to live here tied play() to attention so only
     the panel on screen decoded. That was the right fix for the wrong
     question — it rationed a cost that did not need paying on a phone at
     all. Gone with the videos it drove; the desktop bench in FieldBench
     keeps its own copy, where the timeline makes the motion worth it. */
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
            {plate ? (
              /* lazy throughout: the first of these is already several
                 screens below the hero, so there is nothing here worth
                 fetching before the reader is on their way to it. */
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

    <p className="flex items-baseline justify-between gap-4 px-[var(--pad-x,5vw)] pb-[clamp(28px,8vw,48px)] font-display">
      <span className="text-[clamp(10px,2.7vw,13px)] font-bold uppercase tracking-[0.1em] opacity-70">
        {bench.footnote.label}
      </span>
      <span className="text-[clamp(20px,5.6vw,30px)] leading-none">{bench.footnote.value}</span>
    </p>
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
