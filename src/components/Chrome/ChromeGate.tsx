'use client';

/* Gates the global Header / Footer so the homepage can present its own
   full-bleed hero chrome (Lusion-style) without a doubled nav. Every
   other route renders the shared chrome unchanged. */

import { usePathname } from 'next/navigation';
import { Header, Footer } from '@/components';

const BARE_ROUTES = ['/'];

export function HeaderGate() {
  const pathname = usePathname();
  if (BARE_ROUTES.includes(pathname)) return null;
  return <Header />;
}

export function FooterGate() {
  const pathname = usePathname();
  if (BARE_ROUTES.includes(pathname)) return null;
  return <Footer />;
}
