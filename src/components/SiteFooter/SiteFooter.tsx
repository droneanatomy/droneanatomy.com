'use client';

import React from 'react';
import Link from 'next/link';

/* ============================================================
   SiteFooter — the ground floor.

   Lusion's arrangement, which is worth copying because of what it leaves
   out: three columns of small, quiet type across the top, one bottom rule,
   and a great deal of air. Their footer works as the release after a busy
   site, and the emptiness IS the design — anything added to it takes that
   away rather than adding to it.

   Deliberately ONE footer for every page. A footer is navigational
   furniture, and a site whose ground floor changes depending on where you
   are reads as two sites stitched together — at exactly the moment someone
   is deciding whether to write to you.

   Ordinary document flow, not a fixed layer. Everything above it on the
   field route is pinned and scrubbed; this simply arrives at the end and
   scrolls like a page, which is the point. After nineteen screens of
   choreography the most surprising thing left is something that behaves
   normally.
   ============================================================ */

const SOCIAL = [
  { label: 'LinkedIn', href: 'https://linkedin.com/company/droneanatomy' },
  /* Handle GUESSED from the pattern of the other two — confirm before ship. */
  { label: 'X', href: 'https://x.com/droneanatomy' },
  { label: 'YouTube', href: 'https://youtube.com/@droneanatomy' },
];

/* The middle column, in the room the address used to take.

   ROUTES THAT EXIST, all five checked against src/app — a footer is where
   people go when they have given up finding something in the nav, so a
   dead link here is worse than no link. The labels are the header's own
   (Systems / Mission / Careers / Updates / Contact) rather than new
   wording, because two different names for one destination is how a site
   starts feeling larger than it is.

   Privacy is deliberately NOT here. It already sits in the bottom rule,
   and listing it twice makes the shorter list look like an oversight. */
const QUICK = [
  { label: 'Systems', href: '/products' },
  { label: 'Mission', href: '/about' },
  { label: 'Updates', href: '/updates' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

export const SiteFooter: React.FC = () => (
  <footer
      className="relative z-20 overflow-hidden bg-[#050705] [&_a]:text-inherit [&_address]:text-inherit [&_h2]:text-inherit [&_input]:text-inherit [&_p]:text-inherit [&_span]:text-inherit"
      /* Stated inline, and the children forced to inherit it above.

         globals.css colours `a` and body copy for the site at large, and
         those element rules outrank a colour inherited from an ancestor —
         so without this the links and labels here take the site's value
         rather than the footer's, and a footer that only looks right
         because it happens to match its surroundings breaks the first time
         the surroundings change. */
      style={{ color: '#f2ecd9' }}
    >
    <div className="mx-auto w-full max-w-[1600px] px-[var(--pad-x,5vw)] pb-0 pt-[clamp(72px,11vw,180px)]">
      <div className="grid grid-cols-1 gap-[clamp(40px,5vw,88px)] md:grid-cols-3">
        {/* Who to reach, and how. FIRST COLUMN NOW — the postal address that
            stood here is gone. Nothing arrives by post and the four lines it
            took were the largest block in the footer, which put the heaviest
            thing in the quietest corner.

            TOUCH TARGETS, on phones only. These links sat ~27px apart and
            "X" was 9px wide — measured on a 390px screen, the smallest was
            9 x 19 against Apple's 44 x 44. Invisible padding cannot fix a
            stacked list that tight: neighbouring tap areas would overlap
            and a tap between two links would go to whichever painted last.
            So below md each link becomes a real 44px row (and at least
            44px wide), which makes the list taller on a phone. Desktop,
            where a pointer is precise, keeps the tight rhythm. */}
        <div className="text-[clamp(15px,1.15vw,21px)] leading-[1.55]">
          <ul className="space-y-1 max-md:space-y-0">
            {SOCIAL.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-80 transition-opacity hover:opacity-100 max-md:inline-flex max-md:min-h-[44px] max-md:min-w-[44px] max-md:items-center"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          {/* One address, one block. This carried a General enquiries /
              Sales split against two invented mailboxes; the company has a
              single published address, and the rest of the site — contact,
              careers, privacy, the newsletter — was already using it. Two
              labels pointing at the same inbox is a routing promise nothing
              behind them keeps. */}
          <div className="mt-[clamp(28px,3.4vw,56px)] space-y-1">
            <p className="opacity-55">Enquiries</p>
            <a
              href="mailto:info@droneanatomy.com"
              className="transition-opacity hover:opacity-70 max-md:inline-flex max-md:min-h-[44px] max-md:items-center"
            >
              info@droneanatomy.com
            </a>
          </div>
        </div>

        {/* QUICK LINKS — labelled, and ranged centre from md up.

            The label is the same small, dimmed line the Enquiries block
            uses, and space-y-1 sets it off the list by the same 4px, so the
            two labelled groups in this footer are built the same way rather
            than each inventing a rhythm.

            It costs a row: the left column still opens straight onto
            LinkedIn, so this column's first LINK now sits one line lower
            than its neighbour's. That is what a heading does, and the
            alternative — inventing a label for the socials so the tops line
            up — adds a word to a footer whose argument is how few it has.

            RANGED LEFT, like every other block here. It was briefly centred
            from md up; reverted. */}
        <nav
          aria-label="Quick links"
          className="space-y-1 text-[clamp(15px,1.15vw,21px)] leading-[1.55]"
        >
          <p className="opacity-55">Quick links</p>
          <ul className="space-y-1 max-md:space-y-0">
            {QUICK.map((q) => (
              <li key={q.label}>
                <Link
                  href={q.href}
                  className="opacity-80 transition-opacity hover:opacity-100 max-md:inline-flex max-md:min-h-[44px] max-md:min-w-[44px] max-md:items-center"
                >
                  {q.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* The one thing this page is asking for */}
        <div>
          {/* 64px -> 52px, and ONLY the ceiling moved.

              Past 1600 this heading went to three lines. The container is
              capped at max-w-[1600px] while its padding and the grid's gap
              are both 5vw and keep growing, so beyond that width the COLUMN
              gets narrower as the screen gets wider — 427px at 1600, 411 at
              1920, 389 at 2560, 360 at 3440 — while 3.4vw ran on to its
              64px ceiling. Widest screen, biggest type, smallest column.

              52px is the largest size that still sets two lines in the
              narrowest of those columns (measured: 3440 needs <=52, 2560
              <=57, 1920 <=60). It engages only above ~1529px, so every
              width that was already right is untouched. */}
          <h2 className="font-display text-[clamp(30px,3.4vw,52px)] normal-case leading-[1.02] tracking-[-0.02em]">
            See what we&apos;re 
            building next.
          </h2>

          {/* A ruled line, not a filled box.

              This was a rounded tinted chip — radius 6px over #f2ecd9/8 —
              and it was the only surface in the footer. Everything else
              here is type on the background with a single hairline under
              it, so a filled pill read as a control borrowed from another
              page rather than part of this one.

              px-5 also pushed the field 20px off its own column: measured
              at 1280, the heading above it sits at x=875 and the input text
              began at x=895, while every other block in the footer — both
              other columns, the bottom rule — starts flush on its column
              edge. Dropping the horizontal padding is what puts it back on
              that line; the rule below it now matches the border-t on the
              bottom row, one hairline in the same ink.

              border-0 and appearance-none are load-bearing, not tidying.
              This project's preflight resets borders on div but NOT on
              input, so the field was still painting the UA default — 2px
              inset, rgb(118,118,118), all four sides — inside the tint.
              bg-transparent and outline-none never touched it, because a
              border is neither a background nor an outline. */}
          <form
            className="mt-[clamp(24px,2.6vw,44px)] flex items-center gap-3 border-b border-[#f2ecd9]/20 pb-[clamp(10px,0.9vw,16px)] transition-colors focus-within:border-[#f2ecd9]/45"
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="footer-email" className="sr-only">
              Your email
            </label>
            <input
              id="footer-email"
              type="email"
              required
              placeholder="Your email"
              /* Type matched to the other two columns rather than kept a
                 size of its own — 1.15vw, not 1.1vw. */
              className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[clamp(15px,1.15vw,21px)] leading-[1.55] outline-none placeholder:text-[#f2ecd9]/45"
            />
            <button
              type="submit"
              aria-label="Subscribe"
              /* 44 x 44 on phones, with the arrow held at the right edge of
                 that box so it does not move — it was a 16 x 18 target. */
              className="shrink-0 text-[clamp(18px,1.4vw,26px)] leading-none transition-transform hover:translate-x-1 max-md:inline-flex max-md:min-h-[44px] max-md:min-w-[44px] max-md:items-center max-md:justify-end"
            >
              &rarr;
            </button>
          </form>
        </div>
      </div>

      {/* The bottom rule. Sits above the wordmark, not below it — the
          wordmark is the edge of the page, and anything under it reads as
          having fallen off. */}
      <div className="mt-[clamp(56px,7vw,120px)] flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-[#f2ecd9]/12 pt-6 font-display text-[clamp(10px,0.78vw,14px)] uppercase tracking-[0.08em] opacity-55">
        <span>&copy; {new Date().getFullYear()} DroneAnatomy</span>
        <Link
          href="/privacy"
          className="transition-opacity hover:opacity-100 max-md:inline-flex max-md:min-h-[44px] max-md:items-center"
        >
          Privacy
        </Link>
        <span>Designed and built in India</span>
      </div>
    </div>

    {/* The wordmark, sunk into the bottom of the page.

        Sized to the STRING, not picked, and to the PADDED BOX rather than
        to the viewport — changing the words means re-measuring it.

        It was 12.6vw, which is the width that spans the full viewport, but
        this block carries px-[--pad-x] like the rest of the footer, so the
        space it actually has is 90vw. Measured at 390: 396px of ink in a
        351px box, starting at the 19.5px padding and ending 25px past the
        screen edge — the wordmark read as shoved right, with the y cropped
        off. 11.1vw is that same measurement solved against 90vw instead,
        with about 2px to spare.

        Aligning to the padded box rather than dropping the padding is what
        puts its left edge on the same line as the columns above it.

        whitespace-nowrap so it never wraps into two lines on a narrow
        window.

        The fade is a mask rather than a gradient laid over the top. An
        overlay has to match the background colour exactly and stops
        matching the moment anything is ever placed behind it; a mask takes
        the type itself away, so it is right regardless of what is behind.

        -mb pulls the descender-less block below the page edge, so the fade
        and the crop finish the letterforms together rather than the fade
        landing on empty space above a hard edge. */}
    <div
      className="pointer-events-none select-none px-[var(--pad-x,5vw)]"
      style={{
        maskImage: 'linear-gradient(to bottom, #000 12%, rgba(0,0,0,0.22) 72%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, #000 12%, rgba(0,0,0,0.22) 72%, transparent 100%)',
      }}
      aria-hidden
    >
      <p className="mt-[clamp(24px,3vw,56px)] -mb-[0.14em] whitespace-nowrap font-display text-[11.1vw] uppercase leading-[0.78] tracking-[-0.035em]">
        DroneAnatomy
      </p>
    </div>
  </footer>
);
