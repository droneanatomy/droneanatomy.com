'use client';

import dynamic from 'next/dynamic';
import type { InkHeroProps } from './InkHero';

const InkHero = dynamic(() => import('./InkHero'), { ssr: false });

export const LazyInkHero: React.FC<InkHeroProps> = (props) => <InkHero {...props} />;

export default LazyInkHero;
