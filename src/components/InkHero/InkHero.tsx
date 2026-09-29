'use client';

/* ============================================================
   InkHero — the homepage hero shell.

   A sheet of ink (InkReveal) fills the section; the cursor opens it
   onto a still photograph of the aircraft. All type is real DOM over
   the canvas, so the hero is legible to crawlers and screen readers
   despite looking like one rendered surface.

   Mounted through LazyInkHero (ssr:false) so WebGL never runs on the
   server and three stays off the server bundle — the same arrangement
   HeroCluster uses.
   ============================================================ */

import React, { useId } from 'react';
import { InkReveal } from './InkReveal';
import styles from './InkHero.module.css';

export interface InkHeroProps {
  className?: string;
  /* The three parts of the lockup. `wordmark` is the large line; the
     other two are the small words tucked above-left and below-right of
     it. Both optional — pass neither and it renders as the single
     centred word it was before. */
  lead?: string;
  wordmark?: string;
  trail?: string;
  tagline?: string;
  /* The photograph hiding under the ink. */
  imageSrc?: string;
  /* The hero's call to action. Until this existed the section had no
     clickable element at all — the only way onward was the nav or a
     thirteen-screen scroll. */
  /* Contrast of the marbling against the paper. See InkReveal. */
  inkDepth?: number;
  /* Which way round the sheet runs.

     'light' — cream sheet, black marbling, black type. The default.
     'dark'  — near-black sheet, cream marbling, cream type.

     This is a genuine inversion, not a filter: the shader's paper and ink
     swap, the type's blend source is re-derived for the new backdrop, and
     the section stops advertising itself as a light ground so the global
     header keeps its own cream treatment instead of going to ink. */
  scheme?: 'light' | 'dark';
}

/* Paper, marbling ink, and the SOURCE COLOUR for the differenced type.

   That third value is derived, not chosen: mix-blend-mode difference
   gives |source - backdrop|, so source = backdrop + whatever colour the
   type should land on. Both were measured off the rendered sheet.

     light  backdrop rgb(240,234,216) + black  = rgb(240,234,216)
     dark   backdrop rgb( 16, 20, 11) + cream  = rgb(258,256,228) -> clips

   The dark one clips on red by 3 levels, which costs about 3 levels of
   the type's red channel over the sheet. Invisible against cream, and the
   alternative is a source colour that cannot be expressed. */
/* THE LIGHT PAPER IS #e8e2d0, ten levels below the site's cream.

   It was #f2ecd9 — the same value the nav sheet and the enquiry section
   use — and at that level the hero read as a near-white field. Ten levels
   is a small move in numbers and a large one in the eye, because this is
   the only full-bleed pale surface on the page and there is nothing
   beside it to judge it against.

   Deliberately NOT the palette cream any more, and the knock-on is worth
   knowing: the nav dropdown is still #f2ecd9 and now floats a shade
   lighter than the sheet under it, which gives that panel an edge it
   previously had to fake with a shadow.

   markBlend MOVED WITH IT, because it is derived rather than chosen. The
   shader darkens the paper MULTIPLICATIVELY — mix(paper, black, k), so
   the backdrop is paper x (1 - k) — and the measured factor across the
   wordmark's band is 0.9917. That is where #e6e0ce comes from, not from
   subtracting a constant. Get it wrong and the differenced type lifts off
   black by however many levels the error is. */
const SCHEMES = {
  light: { paper: '#e8e2d0', ink: '#000000', fg: '#000000', markBlend: '#e6e0ce' },
  dark: { paper: '#10140b', ink: '#f2ecd9', fg: '#f2ecd9', markBlend: '#ffffe4' },
} as const;

export const InkHero: React.FC<InkHeroProps> = ({
  className = '',
  lead,
  wordmark = 'DroneAnatomy',
  trail,
  tagline = 'We build the autonomous systems that define the next era of flight.',
  imageSrc = '/images/hero-ink-p10.webp',
  inkDepth,
  scheme = 'light',
}) => {
  const s = SCHEMES[scheme];
  /* Generated, not literal. The id was hard-coded, which is fine for one
     hero and broken for two: duplicate ids are invalid, and both
     sections' aria-labelledby would resolve to whichever heading came
     first — so a screen reader would announce the second hero with the
     first one's title. */
  const titleId = useId();

  return (
    /* `home` is the scope globals.css uses to neutralise the legacy
       element rules (uppercase headings, near-white text, fixed sizes)
       that the old dark theme sets directly on h1/p/a. */
    <section
      className={`home ${styles.hero} ${className}`}
      aria-labelledby={titleId}
      style={
        {
          '--paper': s.paper,
          '--ink': s.ink,
          '--fg': s.fg,
          '--mark-blend': s.markBlend,
        } as React.CSSProperties
      }
      /* ONLY on the light scheme. This attribute means "a pale ground is
         behind the header", which makes the global FieldNav paint in ink.
         A dark sheet wants the opposite — FieldNav's own cream closed
         state — so the attribute has to be absent, not merely ignored. */
      data-chrome={scheme === 'light' ? 'ink' : undefined}
    >
      <InkReveal
        className={styles.canvas}
        imageSrc={imageSrc}
        inkDepth={inkDepth}
        paper={s.paper}
        ink={s.ink}
      />

      <div className={styles.layer}>
        {/* No top bar here any more — the global header (FieldNav) is
            fixed above this. The spacer keeps the wordmark optically
            centred in the room the bar leaves, exactly as it was when
            the bar was a child of this layer. */}
        <div className={styles.barSpace} aria-hidden="true" />

        <div className={styles.centre}>
          {/* ONE heading, three parts.

              The spans are display:block, so the whitespace between them
              generates no boxes and costs no layout — while still
              putting real spaces in the heading's text content, so the
              accessible name reads as the sentence it is rather than as
              "MakingAutonomous FlightInevitable". */}
          <h1 id={titleId} className={styles.wordmark}>
            {/* Two spans each: the outer is the mask the word rises or
                falls through, the inner is what moves. They cannot be one
                element — the mask has to hold still while its contents
                travel. */}
            {lead && (
              <span className={styles.lead}>
                <span className={styles.leadInk}>{lead}</span>
              </span>
            )}{' '}
            <span className={styles.main}>
              <span className={styles.mainInk}>{wordmark}</span>
              {/* Drawn, not a border — the same uneven stroke the enquiry
                  section ends on, so the page opens and closes on the
                  same mark.

                  A SIBLING of the differenced text, not a child of it.
                  mix-blend-mode blends an element together with all its
                  descendants, so a yellow stroke inside the heading would
                  be differenced along with the letters and land on blue.
                  Out here it paints flat. */}
              <svg
                className={styles.underline}
                viewBox="0 0 1000 200"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {/* FILLED, not stroked.

                    The mark tapers — pointed at both tips, heaviest
                    through the middle — and stroke-width is a single
                    number for a whole path, so a stroked line cannot do
                    that. This is the outline of the ribbon itself: out
                    along the top edge, back along the bottom, the two
                    meeting at each end. Filling also survives the
                    non-uniform stretch that preserveAspectRatio="none"
                    applies, where a diagonal stroke would have come out
                    thinning unevenly along its length.

                    THE LEFT TIP CLEARS THE BASELINE, sitting at y=116
                    against a baseline of 80 — about 23px under it at the
                    current size.

                    That 80 is measured rather than eyeballed, and it is
                    worth knowing how: there is no API for a baseline, but a
                    zero-height inline-block with vertical-align:baseline has
                    its box bottom exactly ON it. Dropped into the wordmark
                    and measured against this element's box, it lands at 80
                    of 200. The tip began life at 156, roughly 48px low, went
                    to 80 to touch the baseline, then to 98 and 116 to settle
                    clear beneath it, so the mark passes under the letters
                    rather than into them. The right tip has never moved
                    from y=8.

                    RE-DERIVED EACH TIME, NOT NUDGED. Moving one tip changes
                    the rise for the whole span — 148 units originally, 72
                    when the tip met the baseline, 108 now — so every control
                    point moves with it or the curve kinks. The path is built
                    from a centreline plus a thickness, which keeps the two
                    things that should not be confused apart: the
                    half-thicknesses at the four controls (10 / 12 / 9 / 7)
                    carry over untouched, because the ribbon's WEIGHT should
                    not change just because its ANGLE did. The sag — how far
                    the centreline bows below the straight line between the
                    tips — does scale with the rise, holding near an eighth
                    of it. Left at its original 18 units over a shallower
                    climb it reads as a banana rather than as a sweep. */}
                <path
                  d="M4 116C150 97 300 83 515 62C740 37 890 18 996 8C884 32 730 55 510 86C290 107 145 117 4 116Z"
                  fill="currentColor"
                />
              </svg>
            </span>{' '}
            {trail && (
              <span className={styles.trail}>
                <span className={styles.trailInk}>{trail}</span>
              </span>
            )}
          </h1>
          {/* Placed, not stacked. The lockup is centred on its own and
              this is positioned against the section — so it can never
              nudge the heading, however long the tagline runs. */}
          <p className={styles.intro}>{tagline}</p>
        </div>

        <div className={styles.rail}>
          <span>Scroll to explore</span>
        </div>
      </div>
    </section>
  );
};

export default InkHero;
