'use client';

import { useEffect, useState } from 'react';

/* ============================================================
   usePhone — is this a phone, asked from React.

   gpuBudget.isPhone() answers the same question for code that runs once
   inside an effect, where there is a window to ask. This is for the
   other case: deciding WHAT TO RENDER, which happens during render,
   where there may not be.

   IT RETURNS null BEFORE IT KNOWS, and that third state is the whole
   point. The obvious version reads matchMedia in a useState initializer,
   which is what FieldHero does — but FieldHero only uses the answer to
   pick between layouts of markup that exists either way. Here the answer
   decides whether a WebGL scene mounts at all, and a server that guessed
   'not a phone' would emit the scene into the HTML and then have the
   client tear it down on a phone: a hydration mismatch over the single
   most expensive thing on the page.

   So it admits it does not know yet. Callers render nothing, or the
   cheap thing, until it does — which costs them nothing, because every
   caller today already sits behind a dynamic(ssr:false) boundary and so
   renders nothing on the server regardless.

   Tracked live rather than read once: a tablet rotating across 768px
   should get the other treatment, and unlike the pixel-ratio cap there
   is no cost to switching — it is a different subtree, not a
   re-rasterised render target.
   ============================================================ */
export function usePhone(): boolean | null {
  const [phone, setPhone] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return phone;
}
