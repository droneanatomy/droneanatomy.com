'use client';

/* Registers GSAP plugins exactly once. registerPlugin is idempotent, so every
   motion component can import from here without worrying about order. */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, useGSAP);

/* Dev-only handle so scroll choreography can be inspected from the console /
   automated checks. GSAP is module-bundled, so it is otherwise unreachable. */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__gsap = {
    gsap,
    ScrollTrigger,
    ScrollSmoother,
  };
}

export { gsap, ScrollTrigger, ScrollSmoother, SplitText, useGSAP };
