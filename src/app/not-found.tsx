import Link from 'next/link';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

/* ============================================================
   404.

   REPLACES NEXT'S DEFAULT, which was shipping as "404: This page could
   not be found." in Times New Roman on white — the one screen on the
   site that looked like a different site, reached by exactly the person
   who is already unsure they are in the right place.

   IT GETS THE CHROME FOR FREE. The root layout wraps every route in
   HeaderGate / FooterGate, and the gate only withholds the nav from the
   four product pages that mount their own. An unmatched URL is not on
   that list, so this page arrives with the real nav and the real footer
   — which is the actual repair here. A reader who mistypes a URL lands
   somewhere they can still navigate out of.

   NO data-chrome="ink". useChromeTone reports 'light' unless a section
   that paints LIGHT marks itself, and this ground is #090b07 — the same
   near-black the product pages open on. Cream chrome over it is correct,
   so the right amount of wiring is none.

   It is deliberately the quietest page on the site: no canvas, no
   sequence, no GSAP. A 404 that has to boot a WebGL context before it
   can apologise is worse than the default it replaced.
   ============================================================ */

export const metadata = {
  title: 'Page not found',
  description: 'That page is not here.',
  /* Not pageMeta(), and the exception is the point: pageMeta throws for
     any path outside ROUTES, because a page with metadata and no sitemap
     entry is a page that quietly went missing. This one is genuinely not
     a route — it is what unmatched URLs render — so it is the one page
     that should never be listed or indexed.

     canonical is null to CANCEL the layout's inherited `/`. Left alone
     it would tell a crawler this error page is the homepage.

     `robots` IS NOT REDUNDANT HERE, though it looks it. Next emits its
     own <meta name="robots" content="noindex"> for a not-found route, so
     the head carries two robots tags either way and this cannot be
     reduced to one. What it controls is whether they AGREE: the root
     layout sets `index: true`, every page inherits it, and dropping this
     key does not remove a tag — it publishes `index, follow` next to
     Next's `noindex` and leaves the page arguing with itself. Crawlers
     take the most restrictive reading, so it resolves to noindex either
     way; it is simply not worth shipping a contradiction to find out. */
  alternates: { canonical: null },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="flex min-h-[100svh] flex-col items-center justify-center bg-[#090b07] px-[clamp(20px,5vw,68px)] text-center text-[#f2ecd9]">
      {/* Mono, because every small label on this site is mono and this is
          a label — the number is not the message, the sentence below is. */}
      <p className="font-mono text-[clamp(11px,0.9vw,14px)] uppercase tracking-[0.36em] text-[#f2ecd9]/45">
        404
      </p>

      {/* The one line that does the work. Tracking goes slightly NEGATIVE
          because it is set large and uppercase: the display face opens up
          at size, and the 0.12em the small caps elsewhere use would pull
          this into three words that do not read as one phrase. */}
      <h1 className="mt-[clamp(18px,2.2vw,34px)] font-display text-[clamp(44px,8.5vw,148px)] font-bold uppercase leading-[0.92] tracking-[-0.02em]">
        Out of range
      </h1>

      {/* 46ch is the same measure the homepage intro settled on, and for
          the same reason: it is the width at which this lands on two
          lines instead of one long one or three short ones. `balance`
          keeps those two lines close to even rather than leaving a
          single orphaned word on the second. */}
      <p className="mt-[clamp(16px,1.8vw,28px)] max-w-[46ch] text-[clamp(14px,1.15vw,19px)] leading-[1.6] text-pretty text-[#f2ecd9]/65 [text-wrap:balance]">
        There is no page at this address. The link may be out of date, or the page may have
        moved.
      </p>

      {/* The same pair the P10's closing act ends on — one filled, one
          dashed — so the way out of an error looks like the way forward
          everywhere else. The dashed one repeats PrimaryButton's padding
          and type scale rather than importing it, because it is
          deliberately the quieter of the two and a second filled slab
          here would make neither of them primary. */}
      <div className="mt-[clamp(28px,3.4vw,52px)] flex flex-wrap items-center justify-center gap-[clamp(10px,1.2vw,18px)]">
        <PrimaryButton href="/">Back to home</PrimaryButton>
        <Link
          href="/products"
          className="inline-flex items-center justify-center rounded-[3px] border border-dashed border-[#f2ecd9]/40 px-[clamp(18px,2vw,34px)] py-[clamp(9px,1vw,15px)] font-display text-[clamp(10px,0.82vw,15px)] font-bold uppercase tracking-[0.12em] no-underline transition-colors hover:border-[#f2ecd9]/70 max-md:min-h-[44px]"
        >
          See the aircraft
        </Link>
      </div>
    </section>
  );
}
