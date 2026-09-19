/* Single source of truth for site navigation, shared by the legacy Header and
   the new homepage overlay menu so the two cannot drift when a product ships. */

export interface NavLink {
  label: string;
  href: string;
}

export const PRODUCT_LINKS: NavLink[] = [
  { label: 'P10 Pro', href: '/products/p10-pro' },
  /* Distinct from 'Cyclops Mini' below, and the ambiguity is the product's
     own: this is MINI.name from product.ts, which is also the page wordmark.
     Renaming it here without renaming it there would put a different name in
     the menu from the one on the page it opens. */
  { label: 'Mini', href: '/products/mini' },
  { label: 'NOXR-1', href: '/products/noxr-1' },
  /* The VTOL airframe, and a third product carrying the Cyclops name —
     not Cyclops 3 or Cyclops Mini below, which are separate pages at their
     own routes. Plain 'Cyclops' because it is CYCLOPS.name, the wordmark on
     the page this opens; the same rule the Mini entry above follows. */
  { label: 'Cyclops', href: '/products/cyclops' },
  { label: 'Cyclops 3', href: '/products/cyclops-3' },
  { label: 'Cyclops Mini', href: '/products/cyclops-mini' },
  { label: 'LiftX100', href: '/products/liftx100' },
];

export const COMPANY_LINKS: NavLink[] = [
  { label: 'Mission', href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Updates', href: '/updates' },
  { label: 'Contact', href: '/contact' },
];
