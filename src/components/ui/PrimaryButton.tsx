import React from 'react';
import Link from 'next/link';

/* ============================================================
   PrimaryButton — the site's one filled call to action.

   PROMOTED FROM THE P10 PRO PAGE, where it was the closing act's "Book a
   demo": a cream slab with a 3px radius, the display face at bold, set
   uppercase and tracked 0.12em. It was written inline there and had
   already been copied, near enough, into the mobile version of the same
   act — which is the usual way a style becomes two styles.

   Before this, a reader crossing the site met three different primary
   buttons: this slab on the product pages, a 999px mono pill in the
   homepage's enquiry section, and a full-width near-white block on the
   contact form, each with its own hover. They were not variants of one
   idea; they were three ideas, and the difference said nothing.

   WHAT THIS IS NOT. It is not every button on the site. The nav's CONTACT
   pill is chrome rather than a page's call to action, and the dashed
   outline that sits beside this one in the closing act is deliberately the
   quieter of a pair. A primary button that appears three times on one
   screen has stopped being primary.

   Renders an <a>, a next/link <Link> or a <button> depending on what it is
   given — the styling is the constant, the element is not.
   ============================================================ */

/* What every one of them shares. Shape, face, weight, tracking, hover.

   max-md:min-h-[44px] is the only part not inherited from the original: on
   a phone the mobile copy of this button measured about 37px tall against
   Apple's 44, and a shared component is the right place to fix that once.
   Desktop keeps its own height, where a pointer is precise and the extra
   7px would show. */
const BASE = [
  'inline-flex items-center justify-center gap-2',
  'rounded-[3px] font-display font-bold uppercase tracking-[0.12em]',
  'no-underline transition-opacity hover:opacity-85',
  'focus-visible:outline-2 focus-visible:outline-offset-[3px]',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'max-md:min-h-[44px]',
].join(' ');

/* WHICH WAY ROUND THE FILL RUNS, and it is not decoration.

   Everywhere this button started out, the ground was dark, so cream fill
   and near-black text was the only case there was. The nav carries the
   same button across both — it paints in ink over the homepage hero's
   cream sheet and in cream everywhere else (see data-chrome) — and a
   cream slab on a cream sheet is not a quieter button, it is an absent
   one. The focus ring inverts with it for the same reason. */
const TONE = {
  cream: 'bg-[#f2ecd9] text-[#090b07] focus-visible:outline-[#f2ecd9]',
  ink: 'bg-[#10140b] text-[#f2ecd9] focus-visible:outline-[#10140b]',
} as const;

/* HOW BIG, and `compact` exists for one reason: in the nav this button IS
   the bar's height. Measured at 1440, the pill and the bar around it are
   both 42px, so the default padding (14.4px a side at that width) would
   have grown the site's chrome to 53 — every page, on every scroll, to
   restyle one button. Compact keeps the padding and type scale the nav
   already had and takes only the shape, weight, tracking and hover. */
const SIZE = {
  default: 'px-[clamp(18px,2vw,34px)] py-[clamp(9px,1vw,15px)] text-[clamp(10px,0.82vw,15px)]',
  compact: 'px-[clamp(12px,1.2vw,22px)] py-[9px] text-[clamp(10px,0.78vw,14px)]',
} as const;

/* An href the router cannot own. mailto: and tel: are not routes, and an
   absolute URL leaves the site — next/link would prefetch a page that does
   not exist in either case. */
const isExternal = (href: string) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);

type Base = {
  children: React.ReactNode;
  /* Cream on a dark ground, ink on a light one. See TONE. */
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  /* Appended, not merged — for the one thing a caller legitimately owns:
     where the button sits (w-full, pointer-events-auto). Anything here
     that restyles the button defeats the point of the component. */
  className?: string;
};

type AsLink = Base & {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  target?: string;
  rel?: string;
};

type AsButton = Base & {
  href?: undefined;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

export const PrimaryButton: React.FC<AsLink | AsButton> = (props) => {
  const { children, className = '', tone = 'cream', size = 'default' } = props;
  const cls = `${BASE} ${TONE[tone]} ${SIZE[size]}${className ? ` ${className}` : ''}`;

  if (props.href !== undefined) {
    const { href, onClick, target, rel } = props;
    if (isExternal(href)) {
      return (
        <a href={href} onClick={onClick} target={target} rel={rel} className={cls}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} onClick={onClick} target={target} rel={rel} className={cls}>
        {children}
      </Link>
    );
  }

  const { type = 'button', disabled, onClick } = props;
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cls}>
      {children}
    </button>
  );
};

export default PrimaryButton;
