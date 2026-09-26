'use client';

/* ============================================================
   FieldNav — mega menu, sized and structured off the coda.co reference.

   The shape that matters, and the one I got wrong first time: THE BAR IS
   PART OF THE SHEET. Opening a section does not drop a panel beneath a dark
   bar — the whole header becomes one cream card, and the logo, the section
   names and the CTA all invert onto it. That is what makes the reference
   read as a single object rather than as a page with a menu laid over it.

   The body is columns of title + description under small tracked kickers.
   No promo card: the reference has none, and the descriptions are what
   earn the columns their width. No icons either — see the note on Row.

   Radii: the sheet takes a soft 12px and the buttons stay pills, both by
   request.

   HREFS. This began as a shape-and-sizing preview with every href set to
   '#'. It is now the site-wide header, so the items whose pages exist are
   wired: P10 Pro, NOXR-1, Mini, Cyclops, Mission, Updates, Careers,
   Enquiries, the Contact pill and the logo.

   Cyclops took over what was a 'VTOL' placeholder in both lists — the
   description already written for it ("Fixed-wing endurance, vertical
   launch") is that airframe, so the page filled the slot rather than
   adding a second VTOL entry beside a dead one.

   THE REST STILL POINT AT '#', because those pages do not exist yet —
   the payload and defence items, the whole Systems and Software
   columns, and every Service. They are a roadmap rendered as a menu. Give
   an item a page and wire it here; until then a visitor clicking it gets
   nothing. Three product pages that DO exist are also absent from these
   lists entirely: cyclops-3, cyclops-mini and liftx100.

   The descriptions are written to fill the columns honestly; they are
   drafts, not approved copy.

   NOTE on colour: nothing here uses [&_a]:text-inherit, unlike SiteFooter
   and FieldMenu. Those need it because their links carry no colour of their
   own and would otherwise take the one globals.css sets on `a`. Here every
   element names its own ink — simpler, and necessary, because the blanket
   override is a DESCENDANT selector and so outranks a colour set on the
   element itself.
   ============================================================ */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useChromeTone } from '@/components/Chrome/useChromeTone';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

export interface FieldNavProps {
  /* Tone of the CLOSED bar.

     Closed, this nav paints entirely in cream — white logo, cream section
     labels, cream burger — because it was built to sit on the field
     hero's dark opening frame. That is invisible on a light ground, so
     when it is used as site-wide chrome it has to be able to flip.

     'auto' asks useChromeTone, which watches what is actually behind the
     bar. Pass 'light' to pin the original behaviour — that is what the
     preview routes do, since they own their own dark hero. */
  tone?: 'auto' | 'light' | 'ink';
}

type NavItem = { label: string; desc: string; href: string };
type NavGroup = { kicker: string; items: NavItem[] };
type NavSection = {
  label: string;
  groups: NavGroup[];
  /** Optional sign-up block, filling the columns the groups do not use. */
};

const SECTIONS: NavSection[] = [
  {
    label: 'Drones',
    groups: [
      {
        kicker: 'Airframes',
        items: [
          { label: 'P10 Pro', desc: 'Ten litres over six metres of swath', href: '/products/p10-pro' },
          { label: 'NOXR-1', desc: 'Multirole observation platform', href: '/products/noxr-1' },
          /* Also in Systems > Compact. This section is not rendered today
             — only Systems has a dropdown — but every airframe that
             appears in both is listed in both, and the two disagreeing is
             exactly the fault that shows up the day Drones is surfaced. */
          { label: 'Mini', desc: 'The smallest complete airframe', href: '/products/mini' },
          { label: 'Cyclops', desc: 'Fixed-wing endurance, vertical launch', href: '/products/cyclops' },
          { label: 'Under 250g', desc: 'Sub-250g class', href: '#' },
        ],
      },
      {
        kicker: 'Defence',
        items: [
          { label: 'Defence platforms', desc: 'Built for the field, serviced in it', href: '#' },
          { label: 'Grenade release', desc: 'Precision drop system', href: '#' },
        ],
      },
      {
        kicker: 'Payloads',
        items: [
          { label: 'Spray tank', desc: 'Quick-release, ninety seconds', href: '#' },
          { label: 'Cargo hook', desc: 'Payload carrying and delivery', href: '#' },
          { label: 'AI detection pod', desc: 'Onboard object detection', href: '#' },
        ],
      },
      {
        kicker: 'Support',
        items: [
          { label: 'Spares & modules', desc: 'Eleven parts, one driver', href: '#' },
          { label: 'Pilot training', desc: 'Certification and handover', href: '#' },
        ],
      },
    ],
  },
  /* SYSTEMS IS THE CATALOGUE NOW, and its groups are submenus rather than
     side-by-side columns — the dropdown renders them as a rail of names
     with the selected one's items beside it.

     No new type was needed for that. A group already carries a name and a
     list of items, which is exactly a submenu; only the rendering changed.

     FOUR GROUPS: Agri, VTOL, Defence, Compact. It was seven — Observation,
     Ground systems and Integration have been removed, and NOXR-1 moved out
     of Observation into Defence before it went.

     NOTHING IN HERE POINTS AT '#' ANY MORE. Every remaining row is a page
     that exists, which is why each group holds exactly one: the four
     product pages this site actually has. Gone with the groups above, and
     then from the groups that stayed: Ground systems' three rows,
     Integration's three, Observation's AI detection pod, Spray tank,
     Defence platforms, Grenade release and 'Under 250g'.

     The cost of the rule is worth stating. A menu that only lists what
     exists cannot advertise what is coming — so anything to be named
     before it has a page needs somewhere real to land, even a section of
     an existing page, rather than a '#'. */
  {
    label: 'Systems',
    groups: [
      {
        kicker: 'Agri',
        items: [
          { label: 'P10 Pro', desc: 'Ten litres over six metres of swath', href: '/products/p10-pro' },
        ],
      },
      {
        kicker: 'VTOL',
        items: [
          { label: 'Cyclops', desc: 'Fixed-wing endurance, vertical launch', href: '/products/cyclops' },
        ],
      },
      {
        /* NOXR-1 SITS HERE NOW, and it leads the group: it is the only
           item in it with a page behind it, and a rail whose first row is
           a '#' reads as a menu of things that do not exist yet. */
        kicker: 'Defence',
        items: [
          { label: 'NOXR-1', desc: 'Multirole observation platform', href: '/products/noxr-1' },
        ],
      },
      {
        kicker: 'Compact',
        items: [
          { label: 'Mini', desc: 'The smallest complete airframe', href: '/products/mini' },
        ],
      },
    ],
  },
  {
    label: 'Software',
    groups: [
      {
        kicker: 'In the field',
        items: [{ label: 'GCS app', desc: 'Plan, fly, log', href: '#' }],
      },
      {
        kicker: 'In the office',
        items: [{ label: 'Fleet platform', desc: 'Aircraft, pilots, hours', href: '#' }],
      },
      {
        kicker: 'Intelligence',
        items: [{ label: 'AI object detection', desc: 'Detect and track, live', href: '#' }],
      },
    ],
  },
  {
    label: 'Services',
    groups: [
      {
        kicker: 'Survey & mapping',
        items: [
          { label: 'Mapping', desc: 'Orthomosaics and terrain models', href: '#' },
          { label: 'Surveying', desc: 'Control points and volumes', href: '#' },
          { label: 'Data processing', desc: 'Capture in, deliverables out', href: '#' },
        ],
      },
      {
        kicker: 'Operations',
        items: [
          { label: 'Contract spraying', desc: 'We fly it for you, per season', href: '#' },
          { label: 'Survey flights', desc: 'Crewed and scheduled', href: '#' },
        ],
      },
    ],
  },
  {
    label: 'Company',
    groups: [
      {
        kicker: 'About',
        items: [
          { label: 'Mission', desc: 'Designed and assembled in India', href: '/about' },
          { label: 'Updates', desc: 'Releases and field notes', href: '/updates' },
          { label: 'Careers', desc: 'Ghaziabad, Uttar Pradesh', href: '/careers' },
        ],
      },
      {
        /* One mailbox, so one row. This was a Sales / Support pair against
           two addresses that do not exist — the company publishes a single
           one, and the second row would have promised a routing nothing
           behind it performs. The address takes the freed slot. */
        kicker: 'Talk to us',
        items: [
          { label: 'Enquiries', desc: 'info@droneanatomy.com', href: '/contact' },
          { label: 'Visit', desc: 'Sahibabad, Ghaziabad 201005', href: '#' },
        ],
      },
    ],
  },
];

/* Hover intent. Opening on a bare mouseenter flickers as the pointer crosses
   the bar on its way elsewhere; closing on a bare mouseleave shuts the sheet
   while the pointer is travelling from a section name down into it. The
   close delay is the longer of the two because that journey is slower. */
const OPEN_MS = 90;
const CLOSE_MS = 220;

/* Deltas under EPS are ignored AND do not move the baseline, so slow scrolls
   still accumulate into a real direction rather than being swallowed.
   TOP_ZONE keeps the bar down over the opening of the page. */
const SCROLL_EPS = 6;
const TOP_ZONE = 120;

/* The open sheet and the light hero are BOTH #f2ecd9, so without this the
   menu has no edge at all — it reads as the page changing shape rather
   than as a panel laid over it.

   Two layers on purpose: a wide soft one for lift, and a tight dark one
   to draw the actual edge. A single large blur cannot do the edge on
   same-on-same colour, and a single tight one has no depth.

   Tinted with the ink (16,20,11) rather than pure black so it sits in the
   palette instead of greying the cream.

   Written as an inline style, NOT a shadow-[...] utility: the comma that
   separates two box-shadow layers does not survive Tailwind's arbitrary
   value parser, which silently emitted six fully transparent layers
   instead. Inline style has no parser to lose it. */
const SHEET_SHADOW =
  '0 24px 60px -18px rgba(16, 20, 11, 0.30), 0 2px 10px -3px rgba(16, 20, 11, 0.16)';

/* WHAT THE DESKTOP BAR SHOWS.

   The bar used to render every section in SECTIONS, each with a mega
   panel behind it. It now shows one dropdown and three plain links, so
   these two constants are the whole of that decision — SECTIONS is left
   intact as the catalogue it is.

   THAT MEANS FOUR SECTIONS ARE CURRENTLY UNSURFACED: Drones, Software,
   Services and Company. Their items are still here and still correct,
   and the phone drawer is driven from the same two constants so it
   cannot drift from the bar. Deleting them would have thrown away real
   copy for a layout change; naming them here is the honest version of
   "not in the header right now". Point DROPDOWN_LABEL at another one, or
   add to PLAIN_LINKS, and it comes straight back. */
const DROPDOWN_LABEL = 'Systems';

/* Hoisted out of FieldNav with the Signup form that used to share it. The
   form is gone — it was gated on a section's `newsletter`, only Company
   declared one, and the nav only ever surfaces Systems, so it never
   reached a screen. This still labels the panel's groups. */
const KICKER_CLS =
'font-display text-[clamp(10px,0.78vw,14px)] uppercase tracking-[0.08em] text-[#10140b]/55';


/* Every item in the bar wears this: the dropdown's trigger, which is a
   button, and the three plain links, which are anchors. Shared so the two
   element types cannot drift apart — they sit side by side and any
   difference in padding or tracking shows immediately. */
const BAR_ITEM =
  'rounded-full px-[clamp(9px,0.9vw,16px)] py-[8px] font-display text-[clamp(10px,0.78vw,14px)] uppercase tracking-[0.08em] transition-colors';

const PLAIN_LINKS: { label: string; href: string }[] = [
  { label: 'Mission', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Updates', href: '/updates' },
];

export const FieldNav: React.FC<FieldNavProps> = ({ tone = 'light' }) => {
  const { tone: autoTone, ref: chromeRef } = useChromeTone('light');
  /* onLight === "the ground behind the closed bar is pale", so every cream
     element in the bar has to become ink. It is exactly the same swap the
     bar already performs when the sheet opens, which is why it feeds the
     same booleans below rather than introducing a parallel set. */
  const onLight = tone === 'ink' || (tone === 'auto' && autoTone === 'ink');

  const [active, setActive] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drill, setDrill] = useState<NavSection | null>(null);
  /* Which submenu the rail has selected. Null means "none chosen yet",
     which the derivation below reads as the first — so the panel always
     opens showing something rather than an empty pane beside a list. */
  const [subActive, setSubActive] = useState<string | null>(null);
  const [panelH, setPanelH] = useState(0);
  const [hidden, setHidden] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  /* Only one section can open now, so `active` is really a boolean with a
     label attached — kept as the label so the button's aria-expanded and
     the panel's contents stay derived from one value rather than two. */
  const section = active === DROPDOWN_LABEL
    ? SECTIONS.find((s) => s.label === DROPDOWN_LABEL) ?? null
    : null;
  const open = !!section;
  /* Falls back rather than being reset on open. A stale kicker from the
     last visit still resolves if it is still in the list, and if it is not
     the fallback catches it — no effect, and nothing to keep in sync. */
  const group = section
    ? section.groups.find((g) => g.kicker === subActive) ?? section.groups[0]
    : null;
  /* The sheet is painted by EITHER cause: a desktop section opening, or the
     phone drawer. On a phone the drawer is cream, so a dark bar above it
     left the logo and the close icon stranded on the page — two objects
     where there should be one panel. */
  /* `open` is NO LONGER part of this, and that is the whole shape of the
     change. The panel used to be the bar itself growing into a cream
     sheet, so opening it put every bar element on cream and they all had
     to swap to ink. The dropdown is now its own panel hanging below the
     bar, which leaves the bar exactly where it was, over whatever the
     page is — so its colours follow the ground behind it and nothing
     else. */
  const lit = mobileOpen || onLight;

  /* Reads the ground, not the menu state — see the note on `lit`. */
  const barTone = onLight
    ? ' text-[#10140b]/70 hover:text-[#10140b]'
    : ' text-[#f2ecd9] hover:text-[#f2ecd9]/70';

  const clearTimers = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);
  const openLater = (label: string) => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setActive(label), OPEN_MS);
  };
  const closeLater = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      setActive(null);
      setSubActive(null);
    }, CLOSE_MS);
  };
  const closeNow = useCallback(() => {
    clearTimers();
    setActive(null);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), []);

  /* Measured, not auto — auto is not animatable. An explicit px height is
     what lets the sheet grow and shrink between sections instead of
     snapping. */
  /* `group` is in here, not just `section`. Switching submenus swaps the
     pane's contents and therefore its height, and without this the panel
     would keep whatever height the FIRST submenu measured — taller ones
     clipped, shorter ones leaving a gap. */
  useLayoutEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- A
       measurement of laid-out DOM, which cannot exist before layout and
       must be applied before paint: this is what useLayoutEffect is for.
       Deferring it would show the panel at the previous submenu's height
       for a frame, which is the clipping this effect exists to stop. */
    setPanelH(section && innerRef.current ? innerRef.current.offsetHeight : 0);
  }, [section, group]);

  useEffect(() => {
    if (!section) return;
    const onResize = () => innerRef.current && setPanelH(innerRef.current.offsetHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [section]);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (Math.abs(dy) < SCROLL_EPS) return;
        lastY.current = y;
        if (y < TOP_ZONE) {
          setHidden(false);
          return;
        }
        if (dy > 0) {
          setHidden(true);
          setActive(null);
        } else {
          setHidden(false);
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeNow();
      setMobileOpen(false);
      setDrill(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeNow]);

  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeNow();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [active, closeNow]);

  useEffect(() => {
    if (!mobileOpen) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, [mobileOpen]);

  /* Type borrowed wholesale from SiteFooter, so the two ends of the page
     speak the same way.

     The footer's rules, and what they replace here:
       labels   font-display, clamp(10px,0.78vw,14px), 0.08em, opacity 55
                — was 0.72vw at 0.16em and bold
       links    BODY face, clamp(15px,1.15vw,21px), leading 1.55
                — was font-display at 1.06vw
       weight   the footer never bolds its uppercase type; hierarchy is
                carried by opacity (80 for live text, 55 for labels), so the
                font-bold on every kicker and chip comes off */
  /* Title over description, and nothing else.

     There was a hairline square tile in front of each row holding a
     geometric glyph — a stand-in, because the reference uses filled
     colour icons and this project has no icon set. Twenty-nine
     placeholder shapes drawn from the same handful of dingbats said
     nothing about the twenty-nine things they labelled, and a
     placeholder that never gets replaced stops reading as a placeholder
     and starts reading as the design.

     The wrapper column went with the tile. With one child left, the
     row's flex-and-gap had nothing to space, so the anchor is the column
     now — one element fewer per row. */
  const Row: React.FC<{ item: NavItem }> = ({ item }) => (
    <li>
      <a
        href={item.href}
        className="group/row flex flex-col py-[clamp(7px,0.6vw,10px)]"
      >
        <span className="text-[clamp(15px,1.15vw,21px)] leading-[1.55] text-[#10140b] transition-opacity group-hover/row:opacity-60">
          {item.label}
        </span>
        <span className="text-[clamp(12px,0.95vw,17px)] leading-[1.45] text-[#10140b]/55">
          {item.desc}
        </span>
      </a>
    </li>
  );

  return (
    <>
    {/* ---- backdrop for the open mega menu -------------------------- */}
    {/* A SIBLING of the root, not a child, for the reason the phone
        drawer below spells out: the root carries translateY for
        hide-on-scroll, and any transform makes an element the containing
        block for its position:fixed descendants. Nested in there this
        would resolve `inset-0` against the BAR's 60px-tall box instead
        of the viewport and blur a strip across the top of the page.

        z-[114] puts it under the phone drawer's own scrim at 115 and
        under the bar at 120, so the sheet, the logo and the nav links
        all stay sharp and only the page behind them softens.

        pointer-events-none throughout: the menu already closes on
        mouseleave, and swallowing clicks here would change how the
        header dismisses without being asked to.

        The tint is not decoration. Blur alone does almost nothing to
        the homepage hero, which is a nearly flat cream sheet — there is
        no detail there to smear. The scrim is what makes the page read
        as pushed back on every ground, light or dark. */}
    <div
      aria-hidden="true"
      className={
        'pointer-events-none fixed inset-0 z-[114] transition-opacity duration-300 ease-out ' +
        (open ? 'opacity-100' : 'opacity-0')
      }
      style={{
        backdropFilter: open ? 'blur(10px)' : 'blur(0px)',
        WebkitBackdropFilter: open ? 'blur(10px)' : 'blur(0px)',
        backgroundColor: 'rgba(16, 20, 11, 0.14)',
        transition: 'opacity 300ms ease-out, backdrop-filter 300ms ease-out',
      }}
    />

    <div
      ref={rootRef}
      style={{
        /* The sheet's closed bottom edge is margin + pt + chrome-h, and
           margin + pt sums to --pad-y by construction — so the padding
           cancels out of this distance and the travel is the same as it was
           before any of it existed. */
        transform: hidden
          ? 'translateY(calc(-1 * (var(--pad-y, 1rem) + var(--chrome-h, 2.75rem) + 24px)))'
          : 'translateY(0)',
      }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] transition-transform duration-300 ease-out"
      onMouseLeave={closeLater}
    >
      {/* The sheet. Outer margin plus inner padding are chosen to ADD UP TO
          --pad-x, so the logo and the first column sit on the same line the
          rest of the page uses whether the sheet is painted or not. If they
          did not, the logo would shift sideways as the menu opens, which is
          the tell that the bar and the panel are two different objects.

          That pairing is also how "more padding" was added: the margin came
          down by roughly what the padding went up, so the content stays put
          and the extra reads as cream around it rather than as everything
          being shoved inward. Checked at 853 (4 + 26 = 30) and 1280
          (6 + 38 = 45), against --pad-x of 30 and 45. Change one of the two
          clamps and the other has to move with it. */}
      <div
        className={
          /* box-shadow transitions with the background, not after it. A
             bare `transition-colors` leaves the shadow to snap in while
             the cream fades, which reads as the shadow arriving before
             the sheet it belongs to. */
          'rounded-[12px] transition-[background-color,box-shadow] duration-200 ' +
          /* ALWAYS TRANSPARENT NOW.

             This used to paint cream whenever a section opened, because
             the panel WAS this element growing downward — the bar and the
             mega sheet were one surface. The dropdown is its own panel
             hanging below the bar, and it carries the cream and the
             shadow, so painting here as well would put two cream
             rectangles on screen with a seam between them.

             What is left is a layout container: it owns the margins, the
             padding and the 12px radius that place the bar on the same
             line the rest of the page uses. Worth keeping for that alone
             — the margin/padding pairing documented below is what stops
             the logo shifting sideways, and it is easy to lose.

             On a phone it was already transparent: the DRAWER is the only
             cream there, and it reaches up behind the bar so the logo and
             the close icon sit on one surface rather than two. Painting
             both read as two boxes for a simple reason — this background
             switched in 200ms while the drawer takes 420ms to arrive, so
             for a fifth of a second there was a cream bar with nothing
             under it. One surface cannot disagree with itself. */
          'bg-transparent'
        }
        /* The margin gives back exactly what the padding takes.

           Adding pt alone pushed the bar 15px down the page, which moved
           the header off the line the rest of the chrome sits on. Padding
           can only push content down, so the only way to gain cream ABOVE
           the bar without moving the bar is for the sheet to start higher
           by the same amount — margin-top + padding-top always sums to
           --pad-y, leaving the bar exactly where it was and the extra
           showing as sheet above it.

           Third paired constraint in this file, and the same rule as the
           other two: change one side and the other has to move. */
        style={{
          /* ONE GAP, THREE SIDES, and the padding gives back whatever it
             takes.

             --sheet-gap is the only number here anyone should touch. The
             two paired constraints described above still hold, but they
             are now derived from it rather than hand-checked:

               top    gap + padding-top  = --bar-line
               sides  gap + padding-x    = --logo-line

             so the bar stays on the line the rest of the chrome sits on
             and the logo stays on the line the page's columns use, while
             the sheet floats inside an even inset on all three sides.

             The two "lines" are stated as literals because --pad-x and
             --pad-y are NOT actually defined on this element — measured,
             `var(--pad-y, 1rem)` had been falling back to 16px the whole
             time, which is exactly why the top gap collapsed to zero
             above 889px while the sides kept theirs. These clamps are
             the values that were really in force, written down. */
          ['--sheet-gap' as string]: 'clamp(8px, 0.9vw, 16px)',
          ['--bar-line' as string]: 'clamp(16px, 1.8vw, 30px)',
          ['--logo-line' as string]: 'clamp(22px, 3.5vw, 70px)',
          ['--sheet-inset-x' as string]: 'calc(var(--logo-line) - var(--sheet-gap))',

          marginTop: 'var(--sheet-gap)',
          marginLeft: 'var(--sheet-gap)',
          marginRight: 'var(--sheet-gap)',
          paddingTop: 'max(0px, calc(var(--bar-line) - var(--sheet-gap)))',
          /* None, ever. The shadow moved to the dropdown with the cream
             — see above. On a permanently transparent bar it would hang
             in the air with nothing casting it. */
          boxShadow: 'none',
        }}
        onMouseEnter={clearTimers}
      >
        <div
          ref={chromeRef as React.RefObject<HTMLDivElement>}
          className="pointer-events-none relative flex h-[var(--chrome-h,2.75rem)] items-center justify-between px-[var(--sheet-inset-x)]">
          <Link href="/" aria-label="DroneAnatomy — home" className="pointer-events-auto flex h-full items-center">
            {/* brightness(0) rather than a second asset. The mark is white
                line art on transparent, so it disappears on the cream sheet;
                brightness(0) drives every opaque pixel to black and leaves
                alpha alone, which is exactly an ink swap. invert() would work
                today and misbehave the day the logo stops being monochrome. */}
            <Image
              src="/images/logo.png"
              alt="DroneAnatomy"
              width={686}
              height={225}
              priority
              className="h-[clamp(24px,2.8vw,36px)] w-auto transition-[filter] duration-200"
              style={{ filter: lit ? 'brightness(0)' : 'none' }}
            />
          </Link>

          {/* Sections ride with the CTA on the right rather than floating
              in the centre. They were absolutely positioned at left-1/2 so
              they would stay centred regardless of what the logo and the
              button weighed; grouped, that independence is the wrong
              property — the group is now a normal flex child and
              justify-between on the row does the work, so the whole cluster
              stays put as one object. */}
          {/* RELATIVE, because the dropdown hangs off it.

              The panel is asked to be exactly as wide as the links plus
              the Contact button, and the only element that knows that
              width is this one — it is the flex container holding both.
              Anchoring the panel here with left-0 right-0 makes the width
              fall out of the layout rather than being a number somebody
              has to keep in step with the type scale. */}
          <div className="pointer-events-auto relative hidden items-center gap-[clamp(8px,1.4vw,26px)] md:flex">
          <nav
            aria-label="Primary"
            className="flex items-center gap-[2px]"
          >
            {/* The one section that still opens. A button rather than a
                link because on its own it goes nowhere. */}
            <button
              type="button"
              aria-expanded={open}
              onMouseEnter={() => openLater(DROPDOWN_LABEL)}
              onFocus={() => setActive(DROPDOWN_LABEL)}
              onClick={() => setActive(open ? null : DROPDOWN_LABEL)}
              className={
                BAR_ITEM +
                (open
                  ? /* Tone-aware, now that the bar stays over the page
                       while the panel is down. The old highlight was a
                       dark wash that only worked because opening had just
                       turned the whole bar cream underneath it. */
                    onLight
                    ? ' bg-[#10140b]/[0.07] text-[#10140b]'
                    : ' bg-[#f2ecd9]/[0.14] text-[#f2ecd9]'
                  : barTone)
              }
            >
              {DROPDOWN_LABEL}
            </button>

            {PLAIN_LINKS.map((l) => (
              <a key={l.label} href={l.href} className={BAR_ITEM + barTone}>
                {l.label}
              </a>
            ))}
          </nav>

          {/* THE SITE'S PRIMARY BUTTON, not a pill of its own any more.

              It was a rounded-full chip at weight 400 and 0.08em — near
              enough to the closing acts' call to action to look like a
              relative, different enough to look like an accident. What it
              keeps is the inversion, which is load-bearing rather than
              cosmetic: `onLight` is true over the homepage hero's cream
              sheet, and a cream button there would be invisible.

              compact holds the bar's geometry — this button is what sets
              the chrome's 42px height. */}
          <PrimaryButton
            href="/contact"
            tone={onLight ? 'ink' : 'cream'}
            size="compact"
            className="shrink-0"
          >
            Contact
          </PrimaryButton>

          {/* ---- the dropdown ----------------------------------------

              Its own panel now, rather than the bar growing into one.
              left-0/right-0 against the cluster is what makes it exactly
              as wide as the links and the button; top-full puts it
              directly beneath them.

              The cream and the shadow are gated on `open` rather than
              left painted, because at height 0 an unpainted box is
              invisible but its SHADOW is not — it would sit under the bar
              as a smudge with nothing casting it. */}
          <div
            style={{ height: panelH, boxShadow: open ? SHEET_SHADOW : 'none' }}
            className={
              'absolute left-0 right-0 top-full mt-[clamp(8px,0.9vw,14px)] overflow-hidden rounded-[12px] transition-[height] duration-300 ease-out ' +
              (open ? 'bg-[#f2ecd9]' : 'bg-transparent')
            }
          >
            <div
              ref={innerRef}
              className="px-[clamp(14px,1.5vw,26px)] pb-[clamp(16px,1.8vw,30px)] pt-[clamp(14px,1.5vw,24px)]"
            >
              {section && (
                /* RAIL AND PANE, not columns.

                   Side-by-side columns were right when the panel was the
                   full width of the page; in one this narrow, seven of them
                   would be seven 70px slivers. A rail of names with the
                   selected one's items beside it fits the shape the width
                   constraint imposes, and it is the same arrangement the
                   phone drawer already uses — one behind the other there,
                   side by side here. */
                <div className="flex gap-[clamp(10px,1.2vw,22px)]">
                  <ul className="w-[clamp(96px,10vw,150px)] shrink-0 border-r border-[#10140b]/12 pr-[clamp(8px,0.9vw,16px)]">
                    {section.groups.map((g) => {
                      const on = g.kicker === group?.kicker;
                      return (
                        <li key={g.kicker}>
                          <button
                            type="button"
                            /* Hover AND focus, so the rail works from the
                               keyboard as well as the mouse. No click
                               handler: there is nowhere for a category to
                               go on its own, the items beside it are the
                               destinations. */
                            onMouseEnter={() => setSubActive(g.kicker)}
                            onFocus={() => setSubActive(g.kicker)}
                            className={
                              'w-full rounded-[7px] px-[clamp(6px,0.6vw,10px)] py-[clamp(5px,0.5vw,8px)] text-left font-display text-[clamp(9px,0.7vw,12px)] uppercase tracking-[0.14em] transition-colors ' +
                              (on
                                ? 'bg-[#10140b]/[0.07] text-[#10140b]'
                                : 'text-[#10140b]/50 hover:text-[#10140b]')
                            }
                          >
                            {g.kicker}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {/* min-w-0 so a long description wraps inside the pane
                      instead of forcing the flex row wider than the panel
                      and pushing the rail off its left edge. */}
                  <ul className="min-w-0 flex-1">
                    {group?.items.map((it) => (
                      <Row key={it.label} item={it} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMobileOpen((v) => {
                /* Reset the drill-down only when OPENING. Doing it on every
                   toggle snapped the panes back to the root list while the
                   drawer was still sliding away, in full view. */
                if (!v) setDrill(null);
                return !v;
              });
            }}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="pointer-events-auto grid size-[var(--chrome-h,2.75rem)] place-items-center md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden>
              <line x1="3" y1={mobileOpen ? 10 : 7} x2="17" y2={mobileOpen ? 10 : 7}
                stroke={mobileOpen || onLight ? "#10140b" : "#f2ecd9"} strokeWidth="1.5" strokeLinecap="round"
                className="origin-center transition-transform duration-200"
                style={{ transform: mobileOpen ? 'rotate(45deg)' : 'none' }} />
              <line x1="3" y1={mobileOpen ? 10 : 13} x2="17" y2={mobileOpen ? 10 : 13}
                stroke={mobileOpen || onLight ? "#10140b" : "#f2ecd9"} strokeWidth="1.5" strokeLinecap="round"
                className="origin-center transition-transform duration-200"
                style={{ transform: mobileOpen ? 'rotate(-45deg)' : 'none' }} />
            </svg>
          </button>
        </div>

      </div>

      </div>

      {/* ---- phone sheet -------------------------------------------- */}
      {/* OUTSIDE the transformed root, deliberately.

          The root carries translateY for hide-on-scroll, and translateY(0)
          is not `none` — any transform makes an element the containing
          block for position:fixed descendants. Nested in there, this
          drawer's `fixed inset-0` resolved against the BAR's box rather
          than the viewport: measured 390x60, so the scrim darkened a 60px
          strip and a tap anywhere below it did not close the menu.

          As a sibling it is viewport-fixed again. The CSS vars it reads
          still inherit, because FieldNav is mounted inside the header that
          declares them.

          z-[115] is the cost of that move, and it is not optional. Inside
          the root the drawer inherited z-120; as a sibling it fell back to
          auto, which put it level with the model tab — and the tag comes
          later in the DOM, so it painted straight over the open drawer.

          The value sits BETWEEN the page and the bar on purpose: above the
          tag and the hero so nothing shows through, below the root's 120 so
          the backdrop darkens the page without dimming the logo and the
          close icon sitting on the sheet above it. */}
      <div
        inert={!mobileOpen}
        className={
          'fixed inset-0 z-[115] md:hidden ' +
          (mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')
        }
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className={
            'absolute inset-0 bg-black/55 transition-opacity duration-300 ' +
            (mobileOpen ? 'opacity-100' : 'opacity-0')
          }
        />
          <div /* Travels its own height PLUS its offset from the top, so it
                parks fully above the viewport whatever it happens to
                contain. A flat -100% would only clear its own box and leave
                a band of it showing above the bar. --pad-y is the upper
                bound of that offset, so this always clears.

                It slides BEHIND the bar — the overlay is z-115 against the
                bar's 120 — so it reads as coming out from under the header
                rather than as a card flying in over it. */
            style={{
              transform: mobileOpen
                ? 'translateY(0)'
                : 'translateY(calc(-100% - var(--pad-y,1rem) - 8px))',
              /* Unconditional here, unlike the desktop sheet: this panel
                 is always cream and always painted, it just parks off
                 screen. Gating it on mobileOpen would strip the shadow
                 while it is still visibly sliding away. */
              boxShadow: SHEET_SHADOW,
            }}
            className="absolute inset-x-[clamp(4px,0.5vw,12px)] top-[max(0px,calc(var(--pad-y,1rem)-clamp(12px,1.8vw,30px)))] max-h-[86dvh] overflow-y-auto overflow-x-hidden rounded-[12px] bg-[#f2ecd9] pt-[calc(var(--chrome-h,2.75rem)+clamp(12px,1.8vw,30px))] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
            <div
              className="flex w-[200%] transition-transform duration-300 ease-out"
              style={{ transform: drill ? 'translateX(-50%)' : 'translateX(0)' }}
            >
              {/* THE SAME FOUR ITEMS THE BAR SHOWS, driven from the same two
                  constants. This used to list every section in SECTIONS,
                  which would now put five drill-downs on the phone against
                  four items on the desktop — a header that disagrees with
                  itself across a breakpoint. Only the dropdown drills; the
                  rest navigate. */}
              <ul className="w-1/2 shrink-0 p-[clamp(6px,1.6vw,10px)]">
                {(SECTIONS.find((x) => x.label === DROPDOWN_LABEL)
                  ? [SECTIONS.find((x) => x.label === DROPDOWN_LABEL)!]
                  : []
                ).map((s) => (
                  <li key={s.label}>
                    <button type="button" onClick={() => setDrill(s)}
                      className="flex w-full items-center justify-between px-3 py-[13px] text-left text-[clamp(15px,1.15vw,21px)] leading-[1.55] text-[#10140b]">
                      {s.label}
                      <span aria-hidden className="opacity-40">&rsaquo;</span>
                    </button>
                  </li>
                ))}
                {PLAIN_LINKS.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}
                      className="block px-3 py-[13px] text-[clamp(15px,1.15vw,21px)] leading-[1.55] text-[#10140b]">
                      {l.label}
                    </a>
                  </li>
                ))}
                <li className="p-3 pt-4">
                  <a href="#" className="block rounded-full bg-[#10140b] px-4 py-[11px] text-center font-display text-[clamp(10px,0.78vw,14px)] uppercase tracking-[0.08em] text-[#f2ecd9]">
                    Contact
                  </a>
                </li>
              </ul>

              <div className="w-1/2 shrink-0 p-[clamp(6px,1.6vw,10px)]">
                <button type="button" onClick={() => setDrill(null)}
                  className="flex items-center gap-2 px-3 py-[11px] font-display text-[clamp(10px,0.78vw,14px)] uppercase tracking-[0.08em] text-[#10140b]/55">
                  <span aria-hidden>&lsaquo;</span> Back
                </button>
                {drill?.groups.map((g) => (
                  <div key={g.kicker} className="px-3 pb-2 pt-3">
                    <p className={KICKER_CLS}>{g.kicker}</p>
                    <ul className="mt-1">
                      {g.items.map((it) => (
                        <Row key={it.label} item={it} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>
    </>
  );
};

export default FieldNav;
