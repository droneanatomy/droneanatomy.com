/* Server component. Products link to their existing detail routes and reuse
   the imagery already in /public/images — no new photography.

   Plain <img>, not next/image: the project sets images.unoptimized under
   static export, so next/image adds nothing here. */

import React from 'react';
import { Reveal, SplitHeading } from '@/components/motion';

export interface ProductCard {
  label: string;
  href: string;
  image: string;
  blurb: string;
}

export interface ProductRowProps {
  heading: string;
  products: ProductCard[];
}

export const ProductRow: React.FC<ProductRowProps> = ({ heading, products }) => (
  <section
    id="products"
    className="home-surface px-[var(--page-pad-x)] py-[clamp(80px,14vh,180px)]"
  >
    <div className="mx-auto w-full max-w-[1400px]">
      <SplitHeading
        as="h2"
        text={heading}
        className="mb-[clamp(40px,7vh,90px)] font-display text-[clamp(28px,4.4vw,64px)] uppercase leading-[1.02] tracking-[-0.02em]"
      />

      <div className="grid gap-[clamp(16px,2vw,28px)] sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => (
          <Reveal key={p.href} delay={(i % 3) * 0.08}>
            <a href={p.href} className="group block no-underline">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[clamp(10px,1vw,16px)] bg-card">
                <img
                  src={p.image}
                  alt={p.label}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.3,1)] group-hover:scale-105"
                />
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-4">
                <h3 className="font-display text-[clamp(16px,1.5vw,22px)] uppercase tracking-[-0.01em]">
                  {p.label}
                </h3>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-45 transition-opacity group-hover:opacity-90">
                  View
                </span>
              </div>
              <p className="mt-2 text-[clamp(13px,1vw,15px)] leading-[1.5] opacity-60">{p.blurb}</p>
            </a>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default ProductRow;
