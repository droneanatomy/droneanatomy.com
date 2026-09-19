'use client';

/* ============================================================
   FieldMenu — the overlay menu, three panels.

   Ported from GreenSock's "Timeline clear() and rebuild" pen. The part
   worth keeping is the ASYMMETRY, not the choreography:

     ONE timeline, reused. tl.clear() on every toggle, then rebuilt as
     either the entrance or the exit.

     The ENTRANCE is built from fromTo tweens, so every open starts from a
     known state. That is the whole reason this beats one timeline played
     forwards and backwards: interrupt a close halfway and the panels are
     at some arbitrary y and rotation, and a reversed timeline would resume
     from its own recorded start values and fight that. fromTo simply
     states where the frame begins.

     The EXIT is built from to tweens, so it picks up wherever things are.
     Interrupting an open mid-stagger closes from the half-open frame
     rather than snapping to fully-open first.

   Mounted only where FieldHero is asked for menu="overlay". Nothing does
   today — the P10 Pro page, which was the trial, ships menu="mega"
   instead. FieldHero keeps its inline corner nav everywhere else, and
   nothing outside this file knows the menu exists beyond the one prop
   that asks for it.
   ============================================================ */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { gsap, useGSAP } from '@/components/motion/gsap-setup';

export type MenuLink = { label: string; href: string };

type Props = {
  nav: MenuLink[];
  /** Named in the accent panel, so the menu says which page it belongs to. */
  productName: string;
};

const SOCIALS: MenuLink[] = [
  { label: 'LinkedIn', href: 'https://linkedin.com/company/droneanatomy' },
  { label: 'X', href: 'https://x.com/droneanatomy' },
  { label: 'YouTube', href: 'https://youtube.com/@droneanatomy' },
];

/* Bar geometry, in one place.

   The hamburger becomes an X by tweening the LINE ENDPOINTS, not by
   rotating the bars. Rotation would need a wrapper per bar and still would
   not let the two strokes meet at a true crossing; moving the actual
   coordinates draws the X rather than faking it. */
/* How far off-frame the panels park.

   101% was not enough, and the reason is the container, not the panel: the
   stack sits in a padded, items-end flex column, so a panel's right edge
   rests a padding-width INSIDE the viewport. Translating by 101% of its own
   width therefore lands the left edge about a padding short of the screen
   edge, and a sliver stayed visible on first paint — measured 1% of the
   panel still on screen at mount, which on a cream panel against black is a
   bright line down the edge.

   110% clears the padding at every clamp value with room to spare. It is
   deliberately generous rather than exact: the padding is a clamp and the
   panel width is capped at 700px, so the shortfall is not one number, and
   the cost of overshooting is nothing — the extra travel is off-screen.

   Used for BOTH the CSS resting state and the entrance's fromTo start, so
   the two cannot drift. If they disagree the panel visibly jumps at the
   first frame of the open. */
const OFF_X = '110%';

const BARS = {
  top: {
    open: { x1: 5, y1: 5, x2: 15, y2: 15 },
    closed: { x1: 3, y1: 7, x2: 17, y2: 7 },
  },
  bot: {
    open: { x1: 15, y1: 5, x2: 5, y2: 15 },
    closed: { x1: 3, y1: 13, x2: 17, y2: 13 },
  },
};

export const FieldMenu: React.FC<Props> = ({ nav, productName }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);

  /* Scoped to rootRef, which is the main departure from the pen. Its tweens
     take strings like ".nav-panel" and query the whole document; scoped,
     the same strings resolve only inside this component, so nothing else on
     the page can be caught by them. */
  const { contextSafe } = useGSAP(
    () => {
      tlRef.current = gsap.timeline();
    },
    { scope: rootRef }
  );

  const build = contextSafe((isOpen: boolean) => {
    const tl = tlRef.current;
    if (!tl) return;
    tl.clear();

    /* Honour the OS setting. The pen does not, and three panels hurled
       across the viewport is exactly the motion this preference exists to
       stop. Same end state, no travel. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tl.set('[data-panel]', { x: '0%', y: 0, rotation: 0, opacity: isOpen ? 1 : 0 })
        .set('[data-item]', { opacity: isOpen ? 1 : 0, x: 0 }, 0)
        .set('[data-backdrop]', { opacity: isOpen ? 1 : 0 }, 0);
    } else if (isOpen) {
      tl.fromTo(
        '[data-backdrop]',
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'power2.out' },
        0
      )
        /* y and rotation are restored here as well as x, because the exit
           leaves the panels off-screen AND tilted. An entrance that only
           reset x would slide a rotated panel back into frame. */
        .fromTo(
          '[data-panel]',
          { x: OFF_X, y: 0, rotation: 0 },
          { x: '0%', duration: 0.6, ease: 'back.out(1.4)', stagger: 0.08 },
          0
        )
        .fromTo(
          '[data-item]',
          { opacity: 0, x: -20 },
          { opacity: 1, x: 0, duration: 1.2, ease: 'expo.out', stagger: 0.03 },
          0.1
        )
        .fromTo(
          '[data-bar="top"]',
          { attr: BARS.top.closed },
          { attr: BARS.top.open, duration: 0.35, ease: 'back.out(1.4)' },
          0.06
        )
        .fromTo(
          '[data-bar="bot"]',
          { attr: BARS.bot.closed },
          { attr: BARS.bot.open, duration: 0.35, ease: 'back.out(1.4)' },
          0.06
        )
        .fromTo('[data-bar="mid"]', { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0.06);
    } else {
      tl.to('[data-bar="top"]', { attr: BARS.top.closed, duration: 0.2, ease: 'power3.in' }, 0)
        .to('[data-bar="bot"]', { attr: BARS.bot.closed, duration: 0.2, ease: 'power3.in' }, '<')
        .to('[data-bar="mid"]', { opacity: 1, duration: 0.2 }, '<')
        /* The panels fall out of frame rather than retracing the entrance.
           from: 'end' so the topmost goes last, which reads as the stack
           collapsing from underneath rather than as a queue filing out. */
        .to(
          '[data-panel]',
          {
            y: '160vh',
            rotation: 'random(-15, 15)',
            duration: 1,
            ease: 'power3.in',
            stagger: { from: 'end', each: 0.02 },
          },
          '<'
        )
        .to('[data-backdrop]', { opacity: 0, duration: 0.3, ease: 'power2.in' }, '<0.1');
    }

    /* play(0), not just "build and hope".

       clear() empties a timeline but does NOT move its playhead. After a
       close finishes, tl sits at the end of the content it just played —
       so the rebuilt entrance was being rendered from a time PAST its own
       children, and the second open left the panels at x: 101% (measured
       L = 1274 in a 1280 viewport) while reporting itself complete. The
       first open worked only because the playhead happened to still be at
       zero from mount, which is why this survived the first test.

       Rewinding to 0 and playing is what makes the reuse actually reusable:
       every rebuild starts at the top of the new content, whichever
       direction it was built for. */
    tl.play(0);
  });

  /* A plain effect, NOT a second useGSAP with dependencies.

     useGSAP reverts everything created in its context each time its
     dependencies change, and it also runs once on mount. Driving the build
     from one cost both:

       - the entrance was reverted the moment it was built, so the panels
         stayed at their fromTo start values and opened stuck at x: 101%,
         measured 1274px into a 1280px viewport;
       - the mount run called build(false), so the CLOSE animation played
         against a menu that had never opened, leaving the panels parked at
         y: 160vh (measured 899 / 1369 / 1555).

     contextSafe already registers these tweens against the setup context
     above, which has no dependencies and therefore never re-runs, so they
     are still cleaned up on unmount — without being reverted mid-life.

     The guard tracks the last APPLIED state rather than counting renders.
     A plain first-run flag does not survive StrictMode, which in dev runs
     the effect, cleans up, and runs it again on the same instance: the flag
     was already spent by the second pass, so build(false) played the close
     animation against a menu that had never opened and parked the panels at
     y: 160vh (measured T = 917 / 1232 / 1419).

     Seeded false because that IS the rendered state — the panels start
     translated off-screen in CSS. So the effect is a no-op until something
     actually toggles, and it is idempotent however many times it re-runs. */
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current === open) return;
    applied.current = open;
    build(open);
  }, [open, build]);

  /* Scroll lock. Not cosmetic on THIS page.

     Everything under the menu is a scrubbed ScrollTrigger timeline, so a
     wheel gesture over an open menu would drive the hero's choreography
     behind it — the reader would close the menu onto a different frame than
     the one they opened it from.

     overflow:hidden on the documentElement, NOT position:fixed on the body.
     The body technique works by taking the document out of flow and
     offsetting it, which would re-anchor every position:fixed layer this
     hero is built from. Hiding overflow leaves scrollTop untouched and just
     stops new scrolling, so ScrollTrigger never fires and nothing
     re-lays-out. It is also what FieldHero already does while the sequence
     decodes, so the page has one way of doing this rather than two. */
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  /* Focus moves in on open. Without it the menu is visible but the keyboard
     is still on the page behind, and the first Tab goes somewhere the
     reader cannot see. */
  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  const gate = open ? 'pointer-events-auto' : 'pointer-events-none';

  return (
    <div ref={rootRef} className="pointer-events-none fixed inset-0 z-[100]">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        /* Shares --chrome-h with the logo opposite so the two sit on one
           optical line. The fallback keeps this usable if the menu is ever
           mounted outside a header that defines the token. */
        className="pointer-events-auto absolute right-[var(--pad-x,5vw)] top-[var(--pad-y,2.1vw)] z-[110] grid h-[var(--chrome-h,2.75rem)] w-[var(--chrome-h,2.75rem)] place-items-center"
      >
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
          <line data-bar="top" x1={3} y1={7} x2={17} y2={7} stroke="#f2ecd9" strokeWidth={1.5} strokeLinecap="round" />
          <line data-bar="mid" x1={3} y1={10} x2={17} y2={10} stroke="#f2ecd9" strokeWidth={1.5} strokeLinecap="round" />
          <line data-bar="bot" x1={3} y1={13} x2={17} y2={13} stroke="#f2ecd9" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </button>

      {/* inert does in one attribute what the pen does by looping every link
          and setting tabindex="-1". It also covers anything added later, and
          takes the closed menu out of the accessibility tree rather than
          only out of the tab order. */}
      <div
        inert={!open}
        className="absolute inset-0 flex flex-col items-end gap-2 p-[clamp(10px,1vw,16px)]"
      >
        <button
          type="button"
          data-backdrop
          tabIndex={-1}
          aria-label="Close menu"
          onClick={close}
          className={`absolute inset-0 bg-black/50 opacity-0 ${gate}`}
        />

        {/* Panel 1 — the light one, carrying the navigation.

            [&_a]:text-inherit is load-bearing, not defensive. globals.css
            sets `a { color: var(--color-text-primary) }`, and that ELEMENT
            rule outranks a colour inherited from this panel — so the links
            came out cream on a cream ground, invisible. SiteFooter carries
            the same override for the same reason — it overrides six element
            types, and a, p and span are the three that appear in here.
            Measurement did not catch this; only looking at it did.

            The link size is capped on BOTH axes: min(5.4vw, 9.5vh). Sized
            in vw alone it was 51px on an 853x396 window, where this panel
            is only 200px tall — the list overflowed, INTRO scrolled out of
            sight and CONTACT was cut off. A menu that has to be scrolled to
            find its first item is not a menu.

            justify-start, not justify-center. Centred content that overflows
            is cut at BOTH ends — that is what hid INTRO off the top while
            also clipping CONTACT at the bottom. Anchored to the top, an
            overflow only ever costs the tail, and the panel scrolls to
            reach it. On a normal-height window nothing overflows at all.

            min-h-0 and NOT a min-height. This is the flex-1 panel, so it is
            the one that has to absorb whatever the other two do not use.
            Giving it a floor of its own put the three minimums (180 + 150 +
            76, plus padding and gaps) over the height of a 396px window and
            pushed the socials panel off the bottom edge, measured at
            B = 432. The minimums belong on the content-sized panels; this
            one is the slack. */}
        <div
          data-panel
          /* Inline transform, NOT a Tailwind translate utility: v4 compiles
             those to the CSS `translate` property, which composes on top of
             the `transform` GSAP animates. The panels then never arrive —
             measured stuck off-frame with the entrance
             reporting complete. GSAP owns `transform` from the first tween
             onward; this is only the pre-JS state. */
          style={{ transform: `translateX(${OFF_X})` }}
          className={`relative z-[3] flex min-h-0 w-full max-w-[700px] flex-1 flex-col justify-start overflow-y-auto rounded-[10px] border-2 border-[#0e100f] bg-[#f2ecd9] px-[clamp(20px,4vw,40px)] py-[clamp(14px,2.4vw,40px)] text-[#10140b] [&_a]:text-inherit [&_p]:text-inherit [&_span]:text-inherit ${gate}`}
        >
          <ul className="flex flex-col">
            {nav.map((n, i) => (
              <li key={n.href} data-item className="overflow-hidden">
                <Link
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={n.href}
                  onClick={close}
                  className="block py-[clamp(2px,0.6vw,10px)] font-display text-[clamp(20px,min(5.4vw,8.5vh),52px)] uppercase leading-[1.06] tracking-[-0.02em] transition-opacity hover:opacity-60"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div
            data-item
            className="mt-[clamp(10px,2vw,32px)] font-display text-[clamp(10px,1.1vw,13px)] font-bold uppercase tracking-[0.12em] opacity-60"
          >
            info@droneanatomy.com
          </div>
        </div>

        {/* Panel 2 — the accent one, carrying the newsletter.

            Same field the footer uses, restated on yellow: a hairline rule
            rather than a filled box, sitting flush on the panel's own left
            edge. border-0 and appearance-none are copied across because
            they are copied for a REASON — this project's preflight resets
            borders on div but not on input, so without them the field
            paints the UA default (2px inset grey) straight onto the
            accent. bg-transparent and outline-none do not touch a border.

            [&_input]:text-inherit joins the a/p/span overrides for the same
            element-rule reason: globals.css colours input too, and the
            typed address would come out light on yellow. */}
        <div
          data-panel
          /* Inline transform, NOT a Tailwind translate utility: v4 compiles
             those to the CSS `translate` property, which composes on top of
             the `transform` GSAP animates. The panels then never arrive —
             measured stuck off-frame with the entrance
             reporting complete. GSAP owns `transform` from the first tween
             onward; this is only the pre-JS state. */
          style={{ transform: `translateX(${OFF_X})` }}
          className={`relative z-[2] min-h-[clamp(150px,19vh,215px)] w-full max-w-[700px] rounded-[10px] border-2 border-[#8a8800] bg-[var(--color-flare,#fffc00)] px-[clamp(20px,4vw,40px)] py-[clamp(18px,2.4vw,28px)] text-[#10140b] [&_a]:text-inherit [&_input]:text-inherit [&_p]:text-inherit [&_span]:text-inherit ${gate}`}
        >
          <p
            data-item
            className="font-display text-[clamp(9px,0.9vw,12px)] font-bold uppercase tracking-[0.14em] opacity-60"
          >
            {productName} field notes
          </p>
          <p
            data-item
            className="mt-2 font-display text-[clamp(18px,2.4vw,30px)] normal-case leading-[1.05] tracking-[-0.02em]"
          >
            Once a season
          </p>
          <form
            data-item
            onSubmit={(e) => e.preventDefault()}
            className="mt-[clamp(12px,2vw,22px)] flex items-center gap-3 border-b border-[#10140b]/25 pb-[clamp(8px,0.9vw,14px)] transition-colors focus-within:border-[#10140b]/60"
          >
            <label htmlFor="menu-email" className="sr-only">
              Your email
            </label>
            <input
              id="menu-email"
              type="email"
              required
              placeholder="Your email"
              className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-[clamp(13px,1.15vw,17px)] leading-[1.5] outline-none placeholder:text-[#10140b]/50"
            />
            <button
              type="submit"
              aria-label="Subscribe"
              className="shrink-0 text-[clamp(16px,1.4vw,24px)] leading-none transition-transform hover:translate-x-1"
            >
              &rarr;
            </button>
          </form>
        </div>

        {/* Panel 3 — the dark one. */}
        <div
          data-panel
          /* Inline transform, NOT a Tailwind translate utility: v4 compiles
             those to the CSS `translate` property, which composes on top of
             the `transform` GSAP animates. The panels then never arrive —
             measured stuck off-frame with the entrance
             reporting complete. GSAP owns `transform` from the first tween
             onward; this is only the pre-JS state. */
          style={{ transform: `translateX(${OFF_X})` }}
          className={`relative z-[1] flex min-h-[clamp(76px,10vh,116px)] w-full max-w-[700px] items-center rounded-[10px] border-2 border-[#42433d] bg-[#0e100f] px-[clamp(20px,4vw,40px)] py-[clamp(16px,2vw,24px)] ${gate}`}
        >
          <ul className="flex flex-wrap gap-x-[clamp(14px,2.4vw,32px)] gap-y-1">
            {SOCIALS.map((s) => (
              <li key={s.label} data-item>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-[clamp(10px,1.1vw,14px)] font-bold uppercase tracking-[0.1em] text-[#f2ecd9]/70 transition-opacity hover:text-[#f2ecd9]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FieldMenu;
